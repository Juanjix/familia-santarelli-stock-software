-- Add explicit FK from movements to stock_transfers.
-- This allows filtering technical transfer movements from the functional view
-- without relying on the reason string.

ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS stock_transfer_id UUID REFERENCES stock_transfers(id);

-- Rebuild update_stock to accept and store stock_transfer_id on exit/entry movements.
-- Callers that generate transfer-related movements pass the transfer id;
-- all other callers (adjustStock, confirm_sale, etc.) leave it NULL.

CREATE OR REPLACE FUNCTION update_stock(
  p_product_id         UUID,
  p_warehouse_id       UUID,
  p_quantity           INTEGER,
  p_type               TEXT,
  p_reason             TEXT    DEFAULT NULL,
  p_user_name          TEXT    DEFAULT 'Usuario',
  p_to_warehouse_id    UUID    DEFAULT NULL,
  p_stock_transfer_id  UUID    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock INTEGER;
BEGIN

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a cero. Recibido: %', p_quantity;
  END IF;

  -- ─── ENTRY ──────────────────────────────────────────────────────────────────
  IF p_type = 'entry' THEN

    INSERT INTO product_stock (product_id, warehouse_id, quantity)
    VALUES (p_product_id, p_warehouse_id, p_quantity)
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET
      quantity   = product_stock.quantity + EXCLUDED.quantity,
      updated_at = now();

    -- p_to_warehouse_id = origin when called from a stock transfer receipt.
    -- p_stock_transfer_id links this technical movement to its transfer.
    INSERT INTO movements (product_id, type, quantity, warehouse_id, to_warehouse_id, reason, user_name, stock_transfer_id)
    VALUES (p_product_id, 'entry', p_quantity, p_to_warehouse_id, p_warehouse_id, p_reason, p_user_name, p_stock_transfer_id);

  -- ─── EXIT ───────────────────────────────────────────────────────────────────
  ELSIF p_type = 'exit' THEN

    SELECT quantity INTO v_current_stock
    FROM product_stock
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'No existe stock para este producto en el depósito seleccionado';
    END IF;

    IF v_current_stock < p_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', v_current_stock, p_quantity;
    END IF;

    UPDATE product_stock
    SET quantity   = quantity - p_quantity,
        updated_at = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    -- p_to_warehouse_id = destination when called from a stock transfer dispatch.
    -- p_stock_transfer_id links this technical movement to its transfer.
    INSERT INTO movements (product_id, type, quantity, warehouse_id, to_warehouse_id, reason, user_name, stock_transfer_id)
    VALUES (p_product_id, 'exit', p_quantity, p_warehouse_id, p_to_warehouse_id, p_reason, p_user_name, p_stock_transfer_id);

  -- ─── ADJUSTMENT ─────────────────────────────────────────────────────────────
  ELSIF p_type = 'adjustment' THEN

    SELECT quantity INTO v_current_stock
    FROM product_stock
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    IF v_current_stock IS NOT NULL AND (v_current_stock + p_quantity) < 0 THEN
      RAISE EXCEPTION 'El ajuste dejaría el stock en negativo. Stock actual: %, Ajuste: %', v_current_stock, p_quantity;
    END IF;

    INSERT INTO product_stock (product_id, warehouse_id, quantity)
    VALUES (p_product_id, p_warehouse_id, p_quantity)
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET
      quantity   = product_stock.quantity + EXCLUDED.quantity,
      updated_at = now();

    INSERT INTO movements (product_id, type, quantity, warehouse_id, reason, user_name)
    VALUES (p_product_id, 'adjustment', p_quantity, p_warehouse_id, p_reason, p_user_name);

  -- ─── TRANSFER ───────────────────────────────────────────────────────────────
  ELSIF p_type = 'transfer' THEN

    IF p_to_warehouse_id IS NULL THEN
      RAISE EXCEPTION 'Se requiere depósito destino para una transferencia';
    END IF;

    IF p_warehouse_id = p_to_warehouse_id THEN
      RAISE EXCEPTION 'El depósito origen y destino no pueden ser el mismo';
    END IF;

    SELECT quantity INTO v_current_stock
    FROM product_stock
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'No existe stock para este producto en el depósito origen';
    END IF;

    IF v_current_stock < p_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente en origen. Disponible: %, Solicitado: %', v_current_stock, p_quantity;
    END IF;

    UPDATE product_stock
    SET quantity   = quantity - p_quantity,
        updated_at = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    INSERT INTO product_stock (product_id, warehouse_id, quantity)
    VALUES (p_product_id, p_to_warehouse_id, p_quantity)
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET
      quantity   = product_stock.quantity + EXCLUDED.quantity,
      updated_at = now();

    INSERT INTO movements (
      product_id, type, quantity,
      warehouse_id, to_warehouse_id, reason, user_name
    )
    VALUES (
      p_product_id, 'transfer', p_quantity,
      p_warehouse_id, p_to_warehouse_id, p_reason, p_user_name
    );

  ELSE
    RAISE EXCEPTION 'Tipo de movimiento no válido: %. Valores aceptados: entry, exit, adjustment, transfer', p_type;

  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION update_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, UUID, UUID) TO anon;
