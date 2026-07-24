-- ── 040: Limpieza de datos de prueba para go-live ─────────────────────────────
--
-- QUÉ BORRA: todos los datos operativos de prueba
-- QUÉ CONSERVA: warehouses, categories, attributes, brands, suppliers,
--               app_users, roles, role_permissions,
--               y los productos ANI-40034 y ANI-04462 con su stock
--
-- Orden resuelto por FK (dependientes primero, padres después)

BEGIN;

-- 1. Dependientes de sales
DELETE FROM exchange_tickets;
DELETE FROM sale_commissions;
DELETE FROM sale_items;

-- 2. Movimientos (sale_id → SET NULL, transfer_id nullable — se pueden borrar directo)
DELETE FROM movements;

-- 3. Sales
DELETE FROM sales;

-- 4. Tickets de cambio (coupons)
DELETE FROM coupons;

-- 5. Reparaciones (CASCADE cubre envelope_status_log, envelope_tracking, envelope_transfers)
DELETE FROM envelopes;

-- 6. Clientes y joyeros
DELETE FROM customers;
DELETE FROM jewelers;

-- 7. Transferencias (CASCADE cubre stock_transfer_items y stock_transfer_events)
DELETE FROM stock_transfers;

-- 8. Stock de productos que se van a borrar
DELETE FROM product_stock
WHERE product_id NOT IN (
  SELECT id FROM products WHERE sku IN ('ANI-40034', 'ANI-04462')
);

-- 9. Productos de prueba
DELETE FROM products
WHERE sku NOT IN ('ANI-40034', 'ANI-04462');

-- Verificación: debe mostrar solo los 2 productos reales
SELECT sku, name, is_active FROM products ORDER BY sku;

COMMIT;
