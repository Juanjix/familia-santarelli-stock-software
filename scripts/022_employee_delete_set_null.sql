-- ============================================================
-- Fix: eliminar un empleado quedaba bloqueado en silencio si tenía
-- sobres asociados, porque la FK no tenía ON DELETE SET NULL (el
-- comportamiento por default de Postgres es RESTRICT). El diálogo
-- de confirmación en Configuración ya prometía que "los sobres
-- mantendrán el registro histórico" — esta migración hace que esa
-- promesa sea real: al eliminar un empleado, los sobres que lo
-- referenciaban simplemente quedan con received_by_employee_id NULL.
-- ============================================================

ALTER TABLE envelopes
  DROP CONSTRAINT IF EXISTS envelopes_received_by_employee_id_fkey;

ALTER TABLE envelopes
  ADD CONSTRAINT envelopes_received_by_employee_id_fkey
  FOREIGN KEY (received_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
