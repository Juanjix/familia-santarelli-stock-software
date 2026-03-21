-- Migration: Add category_id and brand_id to products table

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category_id UUID;

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS brand_id UUID;

-- Add foreign key constraints
ALTER TABLE products
ADD CONSTRAINT fk_products_category_id FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE products
ADD CONSTRAINT fk_products_brand_id FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);

-- Update existing products to link their category strings to category_id
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE p.category = c.name AND p.category_id IS NULL;
