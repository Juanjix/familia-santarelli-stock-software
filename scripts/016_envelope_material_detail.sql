-- Agrega campo detalle para material "Otros"
-- product_material sigue almacenando el valor controlado (ORO/PLATA/COBRE/OTROS)
-- product_material_detail almacena la descripción libre cuando es OTROS
ALTER TABLE envelopes ADD COLUMN IF NOT EXISTS product_material_detail TEXT NULL;
