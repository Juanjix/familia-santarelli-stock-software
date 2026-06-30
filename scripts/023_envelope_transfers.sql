-- ============================================================
-- Trazabilidad de traslados entre locales — separar "envío" de
-- "recepción confirmada" para responder quién confirmó que el
-- sobre llegó realmente a destino, no solo quién lo envió.
-- ============================================================

-- Historial completo de traslados (envío + recepción), para reportes
-- y auditoría ("tiempo promedio en tránsito", etc).
CREATE TABLE IF NOT EXISTS envelope_transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id       UUID NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  from_warehouse_id UUID NULL REFERENCES warehouses(id),
  to_warehouse_id   UUID NOT NULL REFERENCES warehouses(id),
  sent_by           TEXT NOT NULL DEFAULT 'Sistema',
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by       TEXT NULL,
  received_at       TIMESTAMPTZ NULL,
  status            TEXT NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'received'))
);

ALTER TABLE envelope_transfers DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_envelope_transfers_envelope_id ON envelope_transfers(envelope_id);
CREATE INDEX IF NOT EXISTS idx_envelope_transfers_status ON envelope_transfers(status);

-- Denormalizado en envelopes para no tener que hacer join/subquery en
-- cada fila del listado: mientras estos campos no son NULL, el sobre
-- está en tránsito y current_warehouse_id todavía refleja el origen.
ALTER TABLE envelopes ADD COLUMN IF NOT EXISTS pending_transfer_to_warehouse_id UUID NULL REFERENCES warehouses(id);
ALTER TABLE envelopes ADD COLUMN IF NOT EXISTS pending_transfer_sent_by TEXT NULL;
ALTER TABLE envelopes ADD COLUMN IF NOT EXISTS pending_transfer_sent_at TIMESTAMPTZ NULL;
