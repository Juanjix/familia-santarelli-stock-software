-- Migration 029: Módulo Punto de Venta (POS) — Fase 1
-- Crea tablas de ventas, items, pagos, tickets de canje y comisiones.
-- Reutiliza customers y employees existentes, extiende movements.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Adaptar tablas existentes
-- ─────────────────────────────────────────────────────────────────────────────

-- customers.dni era NOT NULL — para clientes POS el DNI es opcional.
ALTER TABLE customers ALTER COLUMN dni DROP NOT NULL;

-- Agregar comisión al empleado (nullable → sin comisión configurada).
ALTER TABLE employees ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2)
  CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100));

-- Extender la columna "type" de movements para incluir tipos de ventas.
-- El nombre real en DB es "type" (no movement_type).
-- Dropeamos con IF EXISTS cualquier variante del nombre del constraint.
ALTER TABLE movements DROP CONSTRAINT IF EXISTS movements_type_check;
ALTER TABLE movements DROP CONSTRAINT IF EXISTS movements_movement_type_check;
ALTER TABLE movements ADD CONSTRAINT movements_type_check
  CHECK (type IN ('entry', 'exit', 'transfer', 'adjustment', 'sale', 'sale_reversal'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sales — cabecera de cada venta
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number      INTEGER     GENERATED ALWAYS AS IDENTITY,
  status           TEXT        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft', 'confirmed', 'voided')),
  warehouse_id     UUID        NOT NULL REFERENCES warehouses(id),
  seller_id        UUID        NOT NULL REFERENCES employees(id),
  customer_id      UUID        REFERENCES customers(id) ON DELETE SET NULL,
  subtotal_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes            TEXT,
  confirmed_at     TIMESTAMPTZ,
  voided_at        TIMESTAMPTZ,
  voided_by        UUID        REFERENCES employees(id),
  void_reason      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sale_number_unique UNIQUE (sale_number),
  CONSTRAINT discount_le_subtotal CHECK (discount_amount <= subtotal_amount)
);

CREATE INDEX IF NOT EXISTS idx_sales_status_confirmed ON sales(status, confirmed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_seller           ON sales(seller_id, confirmed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer         ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_warehouse        ON sales(warehouse_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. sale_items — líneas de la venta
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id          UUID        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id       UUID        NOT NULL REFERENCES products(id),
  quantity         INTEGER     NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_pct     NUMERIC(5,2)  NOT NULL DEFAULT 0
                                   CHECK (discount_pct >= 0 AND discount_pct <= 100),
  line_total       NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  -- Snapshot del producto al momento de la venta: protege historial ante ediciones futuras.
  product_snapshot JSONB       NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. sale_payments — métodos de pago (múltiples por venta)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_payments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method      TEXT        NOT NULL
                            CHECK (method IN ('cash', 'transfer', 'card', 'other')),
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. exchange_tickets — ticket de canje generado automáticamente por cada venta
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exchange_tickets (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number  TEXT        NOT NULL UNIQUE,          -- TC-YYYYMMDD-NNNN
  sale_id        UUID        NOT NULL UNIQUE REFERENCES sales(id),
  status         TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'used', 'voided', 'expired')),
  credit_amount  NUMERIC(12,2) NOT NULL CHECK (credit_amount >= 0),
  valid_until    DATE        NOT NULL,
  used_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchange_tickets_status ON exchange_tickets(status, valid_until);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. sale_commissions — comisión por venta (una por venta en Fase 1)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_commissions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id           UUID        NOT NULL UNIQUE REFERENCES sales(id),
  employee_id       UUID        NOT NULL REFERENCES employees(id),
  commission_pct    NUMERIC(5,2)  NOT NULL CHECK (commission_pct >= 0),
  commission_amount NUMERIC(12,2) NOT NULL CHECK (commission_amount >= 0),
  basis_amount      NUMERIC(12,2) NOT NULL CHECK (basis_amount >= 0),
  status            TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'paid', 'voided')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_commissions_employee ON sale_commissions(employee_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Enlace desde movements a la venta que lo originó
--    Se agrega aquí porque sales debe existir antes de agregar la FK.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE movements ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_movements_sale ON movements(sale_id) WHERE sale_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS — política conservadora: acceso completo a usuarios autenticados
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_commissions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON sales             USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON sale_items        USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON sale_payments     USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON exchange_tickets  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON sale_commissions  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
