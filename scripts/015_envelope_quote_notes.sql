-- Agrega detalle textual del presupuesto
ALTER TABLE envelopes ADD COLUMN IF NOT EXISTS quote_notes TEXT NULL;
