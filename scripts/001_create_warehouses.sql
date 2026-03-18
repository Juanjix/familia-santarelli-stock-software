-- Create warehouses table (depositos)
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  stock_count INTEGER NOT NULL DEFAULT 0,
  total_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default warehouses
INSERT INTO warehouses (name, description, is_active, stock_count, total_value) VALUES
  ('Local Principal', 'Deposito principal de la joyeria', true, 0, 0),
  ('Deposito Secundario', 'Deposito de respaldo', true, 0, 0),
  ('Vitrina Exhibicion', 'Productos en exhibicion', true, 0, 0),
  ('Boveda', 'Almacenamiento seguro de alto valor', true, 0, 0);
