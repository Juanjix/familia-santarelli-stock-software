-- Migration: Atributos dinámicos por categoría + columna attributes en productos
-- Permite definir qué campos adicionales requiere cada categoría (Talle, Hilo, Largo, etc.)
-- sin hardcodear nombres de categoría en el código y sin agregar columnas nuevas
-- por cada atributo.

-- 1. Tabla de definición de atributos por categoría
CREATE TABLE IF NOT EXISTS category_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  input_type TEXT NOT NULL DEFAULT 'text',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, key)
);

CREATE INDEX IF NOT EXISTS idx_category_attributes_category_id ON category_attributes(category_id);

-- 2. Columna para guardar los valores de esos atributos en cada producto
ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. "Alianzas" no existe todavía como categoría — la agregamos
INSERT INTO categories (name, description) VALUES
  ('Alianzas', 'Alianzas de casamiento')
ON CONFLICT (name) DO NOTHING;

-- 4. Seed de atributos requeridos para joyería
-- Anillos y Alianzas -> Talle
INSERT INTO category_attributes (category_id, key, label, input_type, sort_order)
SELECT id, 'talle', 'Talle', 'text', 1
FROM categories WHERE name IN ('Anillos', 'Alianzas')
ON CONFLICT (category_id, key) DO NOTHING;

-- Cadenas y Pulseras -> Hilo y Largo
INSERT INTO category_attributes (category_id, key, label, input_type, sort_order)
SELECT id, 'hilo', 'Hilo', 'text', 1
FROM categories WHERE name IN ('Cadenas', 'Pulseras')
ON CONFLICT (category_id, key) DO NOTHING;

INSERT INTO category_attributes (category_id, key, label, input_type, sort_order)
SELECT id, 'largo', 'Largo', 'text', 2
FROM categories WHERE name IN ('Cadenas', 'Pulseras')
ON CONFLICT (category_id, key) DO NOTHING;
