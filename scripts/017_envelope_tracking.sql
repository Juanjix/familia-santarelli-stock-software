-- ============================================================
-- Trazabilidad de Sobres — eventos enriquecidos + ubicación actual
-- ============================================================

-- Ubicación actual independiente del local de recepción
ALTER TABLE envelopes ADD COLUMN IF NOT EXISTS current_warehouse_id UUID NULL REFERENCES warehouses(id);
UPDATE envelopes SET current_warehouse_id = received_warehouse_id
  WHERE current_warehouse_id IS NULL AND received_warehouse_id IS NOT NULL;

-- Tabla de eventos (superset de envelope_status_log)
CREATE TABLE IF NOT EXISTS envelope_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id  UUID NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  title        TEXT NOT NULL,
  detail       TEXT NULL,
  created_by   TEXT NOT NULL DEFAULT 'Sistema',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE envelope_events DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_envelope_events_envelope_id ON envelope_events(envelope_id);

-- Migrar historial existente de envelope_status_log a envelope_events
INSERT INTO envelope_events (envelope_id, event_type, title, detail, created_by, created_at)
SELECT
  envelope_id,
  'status_changed',
  CASE to_status
    WHEN 'received'       THEN 'Sobre recibido'
    WHEN 'quote_pending'  THEN 'Presupuesto solicitado'
    WHEN 'quote_approved' THEN 'Presupuesto aprobado'
    WHEN 'in_workshop'    THEN 'Ingreso a taller'
    WHEN 'ready'          THEN 'Listo para retirar'
    WHEN 'delivered'      THEN 'Entregado al cliente'
    WHEN 'cancelled'      THEN 'Cancelado'
    ELSE to_status
  END,
  notes,
  changed_by,
  created_at
FROM envelope_status_log;
