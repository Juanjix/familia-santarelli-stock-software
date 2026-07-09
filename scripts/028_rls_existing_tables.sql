-- Migration 028: habilitar RLS en tablas existentes
-- Política conservadora: usuarios autenticados tienen acceso completo.
-- Esto bloquea acceso anónimo sin romper ningún módulo existente.
-- Afinar permisos por rol en una etapa posterior si se requiere.

-- ── Inventario core ───────────────────────────────────────────────────────────
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock  ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON products      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON warehouses    USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON product_stock USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON movements     USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── Configuración ─────────────────────────────────────────────────────────────
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_attributes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands               ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons              ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON categories          USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON category_attributes USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON brands              USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON suppliers           USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON coupons             USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── Sobres ────────────────────────────────────────────────────────────────────
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jewelers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE envelope_subtypes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE envelopes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE envelope_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE envelope_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE envelope_events    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON customers           USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON employees           USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON jewelers            USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON envelope_subtypes   USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON envelopes           USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON envelope_transfers  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON envelope_status_log USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON envelope_events     USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── Transferencias de stock ───────────────────────────────────────────────────
ALTER TABLE stock_transfers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON stock_transfers       USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON stock_transfer_items  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_all" ON stock_transfer_events USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
