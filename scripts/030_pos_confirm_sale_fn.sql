-- Migration 030: Función PG para confirmación atómica de venta
--
-- confirm_sale(p_sale_id) ejecuta en una sola transacción:
--   1. Verifica stock disponible por ítem
--   2. Inserta movements tipo 'sale' usando columnas reales: type, reason, warehouse_id
--   3. Actualiza product_stock (descuenta unidades)
--   4. Actualiza sales.status = 'confirmed'
--   5. Genera exchange_ticket con numeración TC-YYYYMMDD-NNNN
--   6. Registra comisión si el empleado tiene commission_pct configurado
--
-- Schema real de movements: type (no movement_type), reason (no notes),
--   warehouse_id = origen, to_warehouse_id = destino (no from_warehouse_id)
--
-- Devuelve jsonb: { ok, error_code?, error_detail?, ticket_number?, sale_number? }

CREATE OR REPLACE FUNCTION confirm_sale(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale           sales%ROWTYPE;
  v_item           sale_items%ROWTYPE;
  v_current_stock  INTEGER;
  v_ticket_seq     INTEGER;
  v_ticket_number  TEXT;
  v_commission_pct NUMERIC(5,2);
  v_seller_name    TEXT;
  v_today          DATE := CURRENT_DATE;
BEGIN
  -- ── Bloquear la fila de la venta para evitar doble-confirmación ──────────
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND',
      'error_detail', 'Venta no encontrada.');
  END IF;

  IF v_sale.status <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_STATUS',
      'error_detail', 'La venta no está en estado borrador.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sale_items WHERE sale_id = p_sale_id) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'EMPTY_CART',
      'error_detail', 'La venta no tiene ítems.');
  END IF;

  SELECT name INTO v_seller_name FROM employees WHERE id = v_sale.seller_id;

  -- ── Verificar stock por ítem ─────────────────────────────────────────────
  FOR v_item IN SELECT * FROM sale_items WHERE sale_id = p_sale_id LOOP
    SELECT COALESCE(quantity, 0) INTO v_current_stock
    FROM product_stock
    WHERE product_id = v_item.product_id
      AND warehouse_id = v_sale.warehouse_id;

    IF COALESCE(v_current_stock, 0) < v_item.quantity THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'INSUFFICIENT_STOCK',
        'error_detail', format(
          'Stock insuficiente para "%s". Disponible: %s, requerido: %s.',
          (v_item.product_snapshot->>'name'),
          COALESCE(v_current_stock, 0),
          v_item.quantity
        )
      );
    END IF;
  END LOOP;

  -- ── Descontar stock e insertar movimientos ───────────────────────────────
  FOR v_item IN SELECT * FROM sale_items WHERE sale_id = p_sale_id LOOP
    -- Descontar stock
    UPDATE product_stock
    SET quantity   = quantity - v_item.quantity,
        updated_at = now()
    WHERE product_id = v_item.product_id
      AND warehouse_id = v_sale.warehouse_id;

    -- Registrar movimiento (columnas reales: type, reason, warehouse_id = origen)
    INSERT INTO movements (product_id, type, quantity, warehouse_id, reason, user_name, sale_id)
    VALUES (
      v_item.product_id,
      'sale',
      v_item.quantity,
      v_sale.warehouse_id,
      format('Venta V-%s', LPAD(v_sale.sale_number::text, 4, '0')),
      v_seller_name,
      p_sale_id
    );
  END LOOP;

  -- ── Confirmar la venta ───────────────────────────────────────────────────
  UPDATE sales
  SET status = 'confirmed', confirmed_at = now(), updated_at = now()
  WHERE id = p_sale_id;

  -- ── Generar ticket de canje con numeración diaria TC-YYYYMMDD-NNNN ───────
  SELECT COALESCE(MAX(
    (regexp_match(ticket_number, 'TC-\d{8}-(\d+)'))[1]::integer
  ), 0) + 1
  INTO v_ticket_seq
  FROM exchange_tickets
  WHERE ticket_number LIKE 'TC-' || to_char(v_today, 'YYYYMMDD') || '-%';

  v_ticket_number := 'TC-' || to_char(v_today, 'YYYYMMDD') || '-' || LPAD(v_ticket_seq::text, 4, '0');

  INSERT INTO exchange_tickets (ticket_number, sale_id, credit_amount, valid_until)
  VALUES (
    v_ticket_number,
    p_sale_id,
    v_sale.total_amount,
    v_today + INTERVAL '30 days'
  );

  -- ── Registrar comisión si el empleado tiene porcentaje configurado ────────
  SELECT commission_pct INTO v_commission_pct
  FROM employees WHERE id = v_sale.seller_id;

  IF v_commission_pct IS NOT NULL AND v_commission_pct > 0 THEN
    INSERT INTO sale_commissions (
      sale_id, employee_id, commission_pct, commission_amount, basis_amount
    ) VALUES (
      p_sale_id,
      v_sale.seller_id,
      v_commission_pct,
      ROUND(v_sale.total_amount * v_commission_pct / 100, 2),
      v_sale.total_amount
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ticket_number', v_ticket_number,
    'sale_number', v_sale.sale_number
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error_code', 'UNEXPECTED_ERROR',
    'error_detail', SQLERRM
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- void_sale(p_sale_id, p_voided_by, p_reason)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION void_sale(
  p_sale_id   UUID,
  p_voided_by UUID,
  p_reason    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale         sales%ROWTYPE;
  v_item         sale_items%ROWTYPE;
  v_voider_name  TEXT;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND',
      'error_detail', 'Venta no encontrada.');
  END IF;

  IF v_sale.status <> 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_STATUS',
      'error_detail', 'Solo se pueden anular ventas confirmadas.');
  END IF;

  SELECT name INTO v_voider_name FROM employees WHERE id = p_voided_by;

  -- Devolver stock e insertar movimientos de reverso
  FOR v_item IN SELECT * FROM sale_items WHERE sale_id = p_sale_id LOOP
    UPDATE product_stock
    SET quantity   = quantity + v_item.quantity,
        updated_at = now()
    WHERE product_id = v_item.product_id
      AND warehouse_id = v_sale.warehouse_id;

    -- Para reverso: to_warehouse_id = destino del stock (warehouse de la venta)
    INSERT INTO movements (product_id, type, quantity, to_warehouse_id, reason, user_name, sale_id)
    VALUES (
      v_item.product_id,
      'sale_reversal',
      v_item.quantity,
      v_sale.warehouse_id,
      format('Anulación V-%s: %s', LPAD(v_sale.sale_number::text, 4, '0'), p_reason),
      v_voider_name,
      p_sale_id
    );
  END LOOP;

  -- Anular ticket de canje si está activo
  UPDATE exchange_tickets
  SET status = 'voided'
  WHERE sale_id = p_sale_id AND status = 'active';

  -- Anular comisión pendiente
  UPDATE sale_commissions
  SET status = 'voided', updated_at = now()
  WHERE sale_id = p_sale_id AND status = 'pending';

  -- Marcar venta como anulada
  UPDATE sales
  SET status      = 'voided',
      voided_at   = now(),
      voided_by   = p_voided_by,
      void_reason = p_reason,
      updated_at  = now()
  WHERE id = p_sale_id;

  RETURN jsonb_build_object('ok', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error_code', 'UNEXPECTED_ERROR',
    'error_detail', SQLERRM
  );
END;
$$;
