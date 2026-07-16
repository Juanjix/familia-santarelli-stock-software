-- Migration 033: Fase 1 — Integridad de datos del POS
--
-- Fixes aplicados:
--   1. confirm_sale: bloqueo de product_stock con FOR UPDATE en orden determinístico
--      → previene stock negativo en ventas concurrentes del mismo artículo.
--   2. confirm_sale: validación de precio $0 antes de tocar la DB
--      → impide confirmar ventas con ítems sin precio configurado.
--   3. void_sale: columna correcta (warehouse_id, no to_warehouse_id) en movements
--      → los movimientos de reverso ahora son coherentes con los de venta.
--   4. void_sale: UPSERT en lugar de UPDATE para restaurar stock
--      → si la fila de product_stock no existe (edge case), se crea en lugar
--        de fallar silenciosamente con 0 rows affected.

-- ─────────────────────────────────────────────────────────────────────────────
-- confirm_sale — versión con integridad completa
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_customer_name  TEXT;
  v_customer_phone TEXT;
  v_today          DATE := CURRENT_DATE;
BEGIN
  -- ── Bloquear la fila de la venta (evita doble-confirmación) ──────────────
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

  -- ── Validar que ningún ítem tiene precio $0 ───────────────────────────────
  -- Previene ventas accidentales de productos sin precio configurado.
  IF EXISTS (SELECT 1 FROM sale_items WHERE sale_id = p_sale_id AND unit_price = 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'ZERO_PRICE',
      'error_detail', 'Hay ítems con precio $0. Corregí los precios antes de confirmar.'
    );
  END IF;

  SELECT name INTO v_seller_name FROM employees WHERE id = v_sale.seller_id;

  -- Datos de cliente para el coupon
  IF v_sale.customer_id IS NOT NULL THEN
    SELECT first_name || ' ' || last_name, phone
    INTO v_customer_name, v_customer_phone
    FROM customers WHERE id = v_sale.customer_id;
  END IF;
  IF v_customer_name IS NULL THEN
    v_customer_name := 'Venta — ' || v_seller_name;
  END IF;

  -- ── Bloquear filas de product_stock en orden determinístico ──────────────
  -- Orden por product_id previene deadlocks cuando dos transacciones concurrentes
  -- venden los mismos productos en distinto orden.
  PERFORM 1
  FROM product_stock
  WHERE product_id IN (SELECT product_id FROM sale_items WHERE sale_id = p_sale_id)
    AND warehouse_id = v_sale.warehouse_id
  ORDER BY product_id
  FOR UPDATE;

  -- ── Verificar stock suficiente (filas ya bloqueadas arriba) ───────────────
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
    UPDATE product_stock
    SET quantity   = quantity - v_item.quantity,
        updated_at = now()
    WHERE product_id = v_item.product_id
      AND warehouse_id = v_sale.warehouse_id;

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

  -- ── Generar número de ticket TC-YYYYMMDD-NNNN ────────────────────────────
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

  INSERT INTO coupons (
    code, amount, customer_name, customer_phone,
    is_used, expires_at, notes
  ) VALUES (
    v_ticket_number,
    v_sale.total_amount,
    v_customer_name,
    v_customer_phone,
    false,
    (v_today + INTERVAL '30 days')::timestamptz,
    format('Generado automáticamente desde venta V-%s', LPAD(v_sale.sale_number::text, 4, '0'))
  );

  -- ── Registrar comisión si aplica ─────────────────────────────────────────
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
-- void_sale — columna correcta + UPSERT en restauración de stock
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
  v_ticket_num   TEXT;
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
  SELECT ticket_number INTO v_ticket_num FROM exchange_tickets WHERE sale_id = p_sale_id;

  -- ── Restaurar stock y registrar movimientos de reverso ───────────────────
  FOR v_item IN SELECT * FROM sale_items WHERE sale_id = p_sale_id LOOP

    -- UPSERT: si por algún edge case la fila no existe, se crea en lugar de
    -- hacer 0 rows affected y perder el stock silenciosamente.
    INSERT INTO product_stock (product_id, warehouse_id, quantity, updated_at)
    VALUES (v_item.product_id, v_sale.warehouse_id, v_item.quantity, now())
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET
      quantity   = product_stock.quantity + EXCLUDED.quantity,
      updated_at = now();

    -- Movimiento de reverso — warehouse_id = depósito de origen (consistente con 'sale')
    INSERT INTO movements (product_id, type, quantity, warehouse_id, reason, user_name, sale_id)
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

  -- Anular exchange_ticket
  UPDATE exchange_tickets
  SET status = 'voided'
  WHERE sale_id = p_sale_id AND status = 'active';

  -- Marcar coupon como usado para que no pueda canjearse
  IF v_ticket_num IS NOT NULL THEN
    UPDATE coupons
    SET is_used  = true,
        used_at  = now(),
        notes    = COALESCE(notes, '') || format(' | ANULADO: %s', p_reason)
    WHERE code = v_ticket_num;
  END IF;

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
