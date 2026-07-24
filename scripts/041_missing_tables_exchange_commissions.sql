-- ── 041: Tablas faltantes — exchange_tickets y sale_commissions ───────────────
--
-- Verificado contra producción con information_schema + pg_catalog (2025-07).
-- Reproduce el esquema exacto de la base existente.

-- ── exchange_tickets ──────────────────────────────────────────────────────────
-- Un ticket de crédito por venta (UNIQUE sale_id). Se genera automáticamente
-- al confirmar una venta cuando el cliente tiene saldo a favor.

CREATE TABLE IF NOT EXISTS exchange_tickets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT        NOT NULL UNIQUE,
  sale_id       UUID        NOT NULL UNIQUE REFERENCES sales(id),   -- NO ACTION on delete
  status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status = ANY (ARRAY['active','used','voided','expired'])),
  credit_amount NUMERIC(12,2) NOT NULL
                              CHECK (credit_amount >= 0),
  valid_until   DATE        NOT NULL,                               -- DATE, no TIMESTAMPTZ
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice compuesto (status, valid_until) — permite filtrar tickets activos no vencidos
CREATE INDEX IF NOT EXISTS idx_exchange_tickets_status
  ON exchange_tickets (status, valid_until);

-- ── sale_commissions ──────────────────────────────────────────────────────────
-- Una comisión por venta (UNIQUE sale_id). NO ACTION en ambas FK.

CREATE TABLE IF NOT EXISTS sale_commissions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id           UUID        NOT NULL UNIQUE REFERENCES sales(id),      -- NO ACTION
  employee_id       UUID        NOT NULL REFERENCES employees(id),         -- NO ACTION
  commission_pct    NUMERIC(5,2)  NOT NULL CHECK (commission_pct    >= 0),
  commission_amount NUMERIC(12,2) NOT NULL CHECK (commission_amount >= 0),
  basis_amount      NUMERIC(12,2) NOT NULL CHECK (basis_amount      >= 0),
  status            TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status = ANY (ARRAY['pending','paid','voided'])),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice compuesto (employee_id, status) — permite agrupar comisiones por empleado y estado
CREATE INDEX IF NOT EXISTS idx_sale_commissions_employee
  ON sale_commissions (employee_id, status);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Política: acceso a cualquier usuario autenticado (auth.uid() IS NOT NULL).
-- Role: public (no authenticated) — coincide con el patrón del resto del schema.

ALTER TABLE exchange_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_commissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'exchange_tickets' AND policyname = 'auth_all'
  ) THEN
    CREATE POLICY "auth_all"
      ON exchange_tickets FOR ALL
      TO public
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sale_commissions' AND policyname = 'auth_all'
  ) THEN
    CREATE POLICY "auth_all"
      ON sale_commissions FOR ALL
      TO public
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
