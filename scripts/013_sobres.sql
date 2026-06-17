-- ============================================================
-- Módulo Sobres (repair orders)
-- ============================================================

-- Clientes
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  dni        TEXT NOT NULL,
  phone      TEXT NULL,
  address    TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customers_dni_unique UNIQUE (dni)
);

ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- Joyeros
CREATE TABLE IF NOT EXISTS jewelers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jewelers DISABLE ROW LEVEL SECURITY;

-- Subtipos de producto (configurable: "Anillo", "Pulsera", "Reloj de pulsera", etc.)
CREATE TABLE IF NOT EXISTS envelope_subtypes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('jewelry', 'watch')),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT envelope_subtypes_name_type_unique UNIQUE (name, product_type)
);

ALTER TABLE envelope_subtypes DISABLE ROW LEVEL SECURITY;

-- Secuencia para numeración de sobres
CREATE SEQUENCE IF NOT EXISTS envelopes_number_seq START 1;

-- Sobres
CREATE TABLE IF NOT EXISTS envelopes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number                  TEXT NOT NULL UNIQUE,
  status                  TEXT NOT NULL DEFAULT 'received'
                          CHECK (status IN ('received','quote_pending','quote_approved','in_workshop','ready','delivered','cancelled')),

  -- Cliente
  customer_id             UUID NOT NULL REFERENCES customers(id),

  -- Recepción
  received_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_warehouse_id   UUID NOT NULL REFERENCES warehouses(id),

  -- Producto recibido
  product_type            TEXT NOT NULL CHECK (product_type IN ('jewelry','watch')),
  product_subtype_id      UUID NULL REFERENCES envelope_subtypes(id),
  product_material        TEXT NULL,
  product_condition       TEXT NOT NULL CHECK (product_condition IN ('very_good','good','regular')),
  product_condition_notes TEXT NULL,

  -- Compra previa
  purchased_at_store      BOOLEAN NOT NULL DEFAULT FALSE,
  purchase_date           DATE NULL,

  -- Trabajo
  work_description        TEXT NOT NULL,
  requires_quote          BOOLEAN NOT NULL DEFAULT FALSE,
  quote_amount            NUMERIC(10,2) NULL,
  quote_approved_at       TIMESTAMPTZ NULL,

  -- Joyero
  jeweler_id              UUID NULL REFERENCES jewelers(id),

  -- Entrega
  estimated_ready_date    DATE NULL,
  delivered_at            TIMESTAMPTZ NULL,
  delivered_by            TEXT NULL,
  delivery_notes          TEXT NULL,

  -- Notas
  internal_notes          TEXT NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE envelopes DISABLE ROW LEVEL SECURITY;

-- Trigger para generar número S-000001 automáticamente
CREATE OR REPLACE FUNCTION generate_envelope_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.number := 'S-' || LPAD(nextval('envelopes_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_envelope_number ON envelopes;
CREATE TRIGGER trg_envelope_number
  BEFORE INSERT ON envelopes
  FOR EACH ROW
  WHEN (NEW.number IS NULL OR NEW.number = '')
  EXECUTE FUNCTION generate_envelope_number();

-- Log de cambios de estado (trazabilidad)
CREATE TABLE IF NOT EXISTS envelope_status_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id  UUID NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  from_status  TEXT NULL,
  to_status    TEXT NOT NULL,
  changed_by   TEXT NOT NULL DEFAULT 'Sistema',
  notes        TEXT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE envelope_status_log DISABLE ROW LEVEL SECURITY;

-- Seeds: subtipos iniciales
INSERT INTO envelope_subtypes (name, product_type, sort_order) VALUES
  ('Anillo',           'jewelry', 1),
  ('Alianza',          'jewelry', 2),
  ('Pulsera',          'jewelry', 3),
  ('Collar',           'jewelry', 4),
  ('Aros',             'jewelry', 5),
  ('Cadena',           'jewelry', 6),
  ('Dije',             'jewelry', 7),
  ('Reloj de pulsera', 'watch',   1),
  ('Reloj de bolsillo','watch',   2)
ON CONFLICT (name, product_type) DO NOTHING;
