-- Migration: Add new product fields
-- Add factory_code, internal_code to products table

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS factory_code TEXT;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS internal_code TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_factory_code ON products(factory_code);
CREATE INDEX IF NOT EXISTS idx_products_internal_code ON products(internal_code);
