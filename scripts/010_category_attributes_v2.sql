-- Migration: Mejoras a category_attributes
-- Agrega placeholder configurable por atributo y restricción de dominio
-- en input_type para evitar valores inválidos.

ALTER TABLE category_attributes
  ADD COLUMN IF NOT EXISTS placeholder TEXT NULL;

-- Restringir valores válidos de input_type
ALTER TABLE category_attributes
  DROP CONSTRAINT IF EXISTS category_attributes_input_type_check;

ALTER TABLE category_attributes
  ADD CONSTRAINT category_attributes_input_type_check
  CHECK (input_type IN ('text', 'number'));

-- Placeholders sugeridos para los atributos ya seedados
UPDATE category_attributes SET placeholder = 'Ej: 16'
WHERE key = 'talle';

UPDATE category_attributes SET placeholder = 'Ej: 0.8mm'
WHERE key = 'hilo';

UPDATE category_attributes SET placeholder = 'Ej: 45cm'
WHERE key = 'largo';
