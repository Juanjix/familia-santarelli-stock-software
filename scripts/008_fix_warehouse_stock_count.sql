-- ─── PARTE 1: Recálculo único de warehouses.stock_count ────────────────────
-- Sincroniza stock_count y total_value para TODOS los depósitos
-- desde product_stock (fuente de verdad).
-- Necesario porque el trigger anterior no cubría el path DELETE,
-- dejando valores stale de data de prueba.

UPDATE warehouses w
SET
  stock_count = COALESCE((
    SELECT SUM(ps.quantity)
    FROM product_stock ps
    WHERE ps.warehouse_id = w.id
  ), 0),
  total_value = COALESCE((
    SELECT SUM(ps.quantity * p.cost_price)
    FROM product_stock ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.warehouse_id = w.id
  ), 0),
  updated_at = now();

-- ─── PARTE 2: Trigger corregido ─────────────────────────────────────────────
-- El trigger original fallaba en DELETE:
--   · NEW es NULL → IF NEW.warehouse_id IS NOT NULL era siempre FALSE
--   · El depósito origen nunca se actualizaba al borrar una fila
--
-- Esta versión maneja los tres casos: INSERT/UPDATE (NEW), DELETE (OLD),
-- y transferencia (OLD != NEW).

CREATE OR REPLACE FUNCTION update_stock_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_new_wh_id  UUID;
  v_old_wh_id  UUID;
BEGIN
  -- Determinar product_id y warehouse IDs según operación
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);
  v_new_wh_id  := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.warehouse_id END;
  v_old_wh_id  := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.warehouse_id END;

  -- Actualizar products.total_stock (siempre)
  UPDATE products
  SET
    total_stock = COALESCE((
      SELECT SUM(quantity) FROM product_stock WHERE product_id = v_product_id
    ), 0),
    updated_at = now()
  WHERE id = v_product_id;

  -- Actualizar depósito destino / actual (INSERT o UPDATE)
  IF v_new_wh_id IS NOT NULL THEN
    UPDATE warehouses
    SET
      stock_count = COALESCE((
        SELECT SUM(quantity) FROM product_stock WHERE warehouse_id = v_new_wh_id
      ), 0),
      total_value = COALESCE((
        SELECT SUM(ps.quantity * p.cost_price)
        FROM product_stock ps
        JOIN products p ON p.id = ps.product_id
        WHERE ps.warehouse_id = v_new_wh_id
      ), 0),
      updated_at = now()
    WHERE id = v_new_wh_id;
  END IF;

  -- Actualizar depósito origen si cambió (DELETE o transferencia)
  IF v_old_wh_id IS NOT NULL AND v_old_wh_id IS DISTINCT FROM v_new_wh_id THEN
    UPDATE warehouses
    SET
      stock_count = COALESCE((
        SELECT SUM(quantity) FROM product_stock WHERE warehouse_id = v_old_wh_id
      ), 0),
      total_value = COALESCE((
        SELECT SUM(ps.quantity * p.cost_price)
        FROM product_stock ps
        JOIN products p ON p.id = ps.product_id
        WHERE ps.warehouse_id = v_old_wh_id
      ), 0),
      updated_at = now()
    WHERE id = v_old_wh_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger (ya existente, DROP IF EXISTS para evitar duplicado)
DROP TRIGGER IF EXISTS trigger_update_stock_totals ON product_stock;
CREATE TRIGGER trigger_update_stock_totals
AFTER INSERT OR UPDATE OR DELETE ON product_stock
FOR EACH ROW
EXECUTE FUNCTION update_stock_totals();
