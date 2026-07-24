-- ── 041: Tablas faltantes — exchange_tickets y sale_commissions ───────────────
--
-- Estas tablas fueron creadas directamente en Supabase durante el desarrollo
-- sin script de migración. Este script las documenta y las crea si no existen,
-- asegurando que la base se pueda reconstruir desde cero correctamente.
--
-- exchange_tickets: ticket de crédito generado automáticamente al confirmar
--   una venta cuando el cliente tiene saldo a favor (distinto de coupons,
--   que son tickets de cambio por devolución de producto).
--
-- sale_commissions: comisión calculada por venta confirmada, vinculada al
--   empleado que realizó la venta. Se gestiona desde /pos/commissions.

-- ── exchange_tickets ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exchange_tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number  TEXT NOT NULL UNIQUE,
  sale_id        UUID NOT NULL REFERENCES sales(id),
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'used', 'voided', 'expired')),
  credit_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  valid_until    TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_tickets_sale_id
  ON exchange_tickets (sale_id);

CREATE INDEX IF NOT EXISTS idx_exchange_tickets_status
  ON exchange_tickets (status);

-- ── sale_commissions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sale_commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id           UUID NOT NULL REFERENCES sales(id),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE SET NULL,
  commission_pct    NUMERIC(5, 2) NOT NULL,
  commission_amount NUMERIC(12, 2) NOT NULL,
  basis_amount      NUMERIC(12, 2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'voided')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_commissions_sale_id
  ON sale_commissions (sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_commissions_employee_id
  ON sale_commissions (employee_id);

CREATE INDEX IF NOT EXISTS idx_sale_commissions_status
  ON sale_commissions (status);

-- ── RLS (mismo patrón que el resto de las tablas operativas) ──────────────────

ALTER TABLE exchange_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_commissions  ENABLE ROW LEVEL SECURITY;

-- Acceso solo a usuarios autenticados
CREATE POLICY IF NOT EXISTS "exchange_tickets_auth"
  ON exchange_tickets FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "sale_commissions_auth"
  ON sale_commissions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
