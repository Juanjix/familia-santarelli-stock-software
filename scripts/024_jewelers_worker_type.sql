-- ============================================================
-- Separar especialistas por tipo: joyero vs relojero, para que el
-- dropdown de asignación filtre según product_type del sobre
-- (joya → joyeros, reloj → relojeros).
-- ============================================================

-- Los joyeros existentes se consideran 'jeweler' por default —
-- no hace falta migrar datos a mano.
ALTER TABLE jewelers ADD COLUMN IF NOT EXISTS worker_type TEXT NOT NULL DEFAULT 'jeweler'
  CHECK (worker_type IN ('jeweler', 'watchmaker'));

-- Mismo fix que ya se aplicó a employees: sin ON DELETE SET NULL, borrar
-- un especialista con sobres asignados queda bloqueado en silencio.
ALTER TABLE envelopes DROP CONSTRAINT IF EXISTS envelopes_jeweler_id_fkey;
ALTER TABLE envelopes
  ADD CONSTRAINT envelopes_jeweler_id_fkey
  FOREIGN KEY (jeweler_id) REFERENCES jewelers(id) ON DELETE SET NULL;
