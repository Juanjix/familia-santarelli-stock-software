-- Migration 026: stock_transfers — transferencias de stock con confirmación de recepción

-- ── 1. Tabla principal ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number              TEXT UNIQUE NOT NULL,               -- TR-000001
  from_warehouse_id   UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
  status              TEXT NOT NULL DEFAULT 'in_transit'
                        CHECK (status IN ('in_transit', 'completed', 'with_differences', 'cancelled')),
  created_by          TEXT NOT NULL,
  dispatched_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by         TEXT,
  received_at         TIMESTAMPTZ,
  incident_notes      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT different_warehouses CHECK (from_warehouse_id <> to_warehouse_id)
);

-- ── 2. Items de transferencia ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id         UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  quantity_sent       INTEGER NOT NULL CHECK (quantity_sent > 0),
  quantity_received   INTEGER,                            -- NULL hasta confirmar
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Timeline de eventos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transfer_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id         UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  event_type          TEXT NOT NULL,
  title               TEXT NOT NULL,
  detail              TEXT,
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. Índices ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status       ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_wh      ON stock_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_wh        ON stock_transfers(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_dispatched   ON stock_transfers(dispatched_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_events_transfer ON stock_transfer_events(transfer_id);

-- ── 5. Secuencia para numeración TR-XXXXXX ───────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS stock_transfer_number_seq START 1;

-- ── 6. Función para generar el número correlativo ────────────────────────────
CREATE OR REPLACE FUNCTION next_stock_transfer_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'TR-' || LPAD(nextval('stock_transfer_number_seq')::TEXT, 6, '0');
END;
$$;

-- ── 7. RLS deshabilitado (consistente con el resto del proyecto) ─────────────
ALTER TABLE stock_transfers        DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items   DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_events  DISABLE ROW LEVEL SECURITY;
