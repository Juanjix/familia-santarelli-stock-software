-- Migration: Add categories, brands tables and new product fields
-- This migration creates dynamic categories/brands and adds factory_code, internal_code to products

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

-- Add new columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS factory_code TEXT,
ADD COLUMN IF NOT EXISTS internal_code TEXT,
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id),
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);

-- Seed default categories (based on existing hardcoded values)
INSERT INTO categories (name) VALUES
  ('Anillos'),
  ('Collares'),
  ('Pulseras'),
  ('Aros'),
  ('Cadenas'),
  ('Relojes'),
  ('Accesorios')
ON CONFLICT (name) DO NOTHING;

-- Seed default brands (common jewelry brands)
INSERT INTO brands (name) VALUES
  ('Sin Marca'),
  ('Santarelli'),
  ('Otro')
ON CONFLICT (name) DO NOTHING;

-- Seed default warehouses if they don't exist
INSERT INTO warehouses (name, description, is_active, stock_count, total_value) VALUES
  ('Shopping', 'Depósito principal en el shopping', true, 0, 0),
  ('Galeria Plaza', 'Depósito en Galeria Plaza', true, 0, 0),
  ('Web', 'Depósito para ventas online', true, 0, 0)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_factory_code ON products(factory_code);
CREATE INDEX IF NOT EXISTS idx_products_internal_code ON products(internal_code);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);

-- Update existing products to link their category strings to category_id
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE p.category = c.name AND p.category_id IS NULL;
