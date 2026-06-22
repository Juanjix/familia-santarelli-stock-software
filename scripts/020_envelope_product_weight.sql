-- ============================================================
-- Peso del artículo (gramos) — relevante cuando el material es ORO
-- ============================================================

ALTER TABLE envelopes ADD COLUMN IF NOT EXISTS product_weight NUMERIC NULL;
