-- Function to update product total stock and warehouse stats
CREATE OR REPLACE FUNCTION update_stock_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update product total stock
  UPDATE products
  SET total_stock = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM product_stock
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  -- Update warehouse stock count and value
  IF NEW.warehouse_id IS NOT NULL THEN
    UPDATE warehouses
    SET stock_count = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM product_stock
      WHERE warehouse_id = NEW.warehouse_id
    ),
    total_value = (
      SELECT COALESCE(SUM(ps.quantity * p.cost_price), 0)
      FROM product_stock ps
      JOIN products p ON p.id = ps.product_id
      WHERE ps.warehouse_id = NEW.warehouse_id
    ),
    updated_at = now()
    WHERE id = NEW.warehouse_id;
  END IF;

  IF OLD.warehouse_id IS NOT NULL AND OLD.warehouse_id != COALESCE(NEW.warehouse_id, OLD.warehouse_id) THEN
    UPDATE warehouses
    SET stock_count = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM product_stock
      WHERE warehouse_id = OLD.warehouse_id
    ),
    total_value = (
      SELECT COALESCE(SUM(ps.quantity * p.cost_price), 0)
      FROM product_stock ps
      JOIN products p ON p.id = ps.product_id
      WHERE ps.warehouse_id = OLD.warehouse_id
    ),
    updated_at = now()
    WHERE id = OLD.warehouse_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock updates
DROP TRIGGER IF EXISTS trigger_update_stock_totals ON product_stock;
CREATE TRIGGER trigger_update_stock_totals
AFTER INSERT OR UPDATE OR DELETE ON product_stock
FOR EACH ROW
EXECUTE FUNCTION update_stock_totals();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_warehouses_updated_at ON warehouses;
CREATE TRIGGER trigger_warehouses_updated_at
BEFORE UPDATE ON warehouses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
