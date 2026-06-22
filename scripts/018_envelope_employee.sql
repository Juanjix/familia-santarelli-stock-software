-- ============================================================
-- Empleados receptores de sobres
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- Referencia en sobres (nullable para retrocompat con registros existentes)
ALTER TABLE envelopes
  ADD COLUMN IF NOT EXISTS received_by_employee_id UUID NULL REFERENCES employees(id);
