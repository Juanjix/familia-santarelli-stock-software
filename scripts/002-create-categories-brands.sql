-- Migration: Create categories and brands tables

-- Create categories table for dynamic category management
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create brands table for dynamic brand management
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default categories
INSERT INTO categories (name, description) VALUES
  ('Anillos', 'Anillos de joyería'),
  ('Collares', 'Collares y cadenas cortas'),
  ('Pulseras', 'Pulseras y brazaletes'),
  ('Aros', 'Aros y pendientes'),
  ('Cadenas', 'Cadenas'),
  ('Relojes', 'Relojes'),
  ('Accesorios', 'Otros accesorios de joyería')
ON CONFLICT (name) DO NOTHING;

-- Seed default brands
INSERT INTO brands (name, description) VALUES
  ('Sin Marca', 'Productos sin marca específica'),
  ('Santarelli', 'Marca Santarelli'),
  ('Otro', 'Otras marcas')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);
