-- ============================================================
-- Ticket de Cambio: datos de cliente + descuento de stock atómico
-- ============================================================

-- Datos del cliente (obligatorios a nivel app). Se dejan nullable en
-- la base para no romper tickets históricos sin estos datos.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Preparado para búsquedas futuras por teléfono / cliente (sin
-- implementar historial todavía, solo el índice).
CREATE INDEX IF NOT EXISTS idx_coupons_customer_phone ON coupons(customer_phone);
CREATE INDEX IF NOT EXISTS idx_coupons_customer_name ON coupons(customer_name);

ALTER TABLE coupons DISABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- issue_exchange_ticket(): crea el ticket y descuenta 1 unidad de
-- stock dentro de una sola transacción. Reutiliza update_stock()
-- (tipo 'exit') sin modificarlo — si no hay stock suficiente, la
-- función entera aborta y el ticket no llega a crearse.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION issue_exchange_ticket(
  p_code           TEXT,
  p_product_id     UUID,
  p_warehouse_id   UUID,
  p_amount         NUMERIC,
  p_customer_name  TEXT,
  p_customer_phone TEXT,
  p_expires_at     TIMESTAMPTZ DEFAULT NULL,
  p_notes          TEXT        DEFAULT NULL,
  p_user_name      TEXT        DEFAULT 'Usuario'
)
RETURNS coupons
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon coupons;
BEGIN
  -- Descuenta 1 unidad de stock; lanza excepción (y revierte todo) si no hay stock suficiente
  PERFORM update_stock(
    p_product_id      => p_product_id,
    p_warehouse_id    => p_warehouse_id,
    p_quantity        => 1,
    p_type            => 'exit',
    p_reason          => 'Ticket de cambio ' || p_code,
    p_user_name       => p_user_name,
    p_to_warehouse_id => NULL
  );

  INSERT INTO coupons (code, original_product_id, amount, customer_name, customer_phone, is_used, expires_at, notes)
  VALUES (p_code, p_product_id, p_amount, p_customer_name, p_customer_phone, false, p_expires_at, p_notes)
  RETURNING * INTO v_coupon;

  RETURN v_coupon;
END;
$$;

GRANT EXECUTE ON FUNCTION issue_exchange_ticket(TEXT, UUID, UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO anon;
