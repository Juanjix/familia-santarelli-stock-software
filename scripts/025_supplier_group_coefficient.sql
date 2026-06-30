-- ============================================================
-- Proveedores: grupo de precios + coeficiente (para cálculos
-- automáticos de precio en una mejora futura)
-- ============================================================

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS price_group TEXT NULL;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS coefficient NUMERIC(10,4) NULL;

-- Backfill de proveedores existentes con valores neutros para que
-- sigan funcionando sin intervención manual (coeficiente 1 = sin
-- ajuste de precio, grupo A = grupo por defecto)
UPDATE suppliers SET price_group = 'A' WHERE price_group IS NULL;
UPDATE suppliers SET coefficient = 1 WHERE coefficient IS NULL;

ALTER TABLE suppliers ALTER COLUMN price_group SET NOT NULL;
ALTER TABLE suppliers ALTER COLUMN coefficient SET NOT NULL;

ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_price_group_check;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_price_group_check
  CHECK (char_length(price_group) = 1 AND price_group = upper(price_group));

ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_coefficient_check;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_coefficient_check
  CHECK (coefficient > 0);
