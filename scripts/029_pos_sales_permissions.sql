-- ── 029: Módulo `pos_sales` — historial de ventas operativo ─────────────────
-- Separar el historial de ventas (/pos/sales) del módulo genérico "reports"
-- para que los empleados puedan consultar ventas pasadas con fines de atención
-- al cliente, sin acceder a información de gestión (comisiones, reportes).
--
-- Regla de negocio:
--   Operativo = información necesaria para atender correctamente a un cliente.
--   Gestión   = información utilizada para administrar el negocio.
--
-- /pos/sales → módulo "pos_sales" (operativo — employee tiene acceso de vista)
-- /pos/commissions → módulo "reports" (gestión — employee sin acceso, sin cambios)
--
-- Permisos por rol:
--   admin    → CRUD completo (puede anular ventas desde el historial)
--   manager  → CRUD completo (puede anular ventas desde el historial)
--   employee → solo vista (consulta, NO puede anular ventas)
--   readonly → sin acceso (rol de consulta sin operaciones de POS)

DO $$
DECLARE
  r_admin    UUID := (SELECT id FROM roles WHERE slug = 'admin');
  r_manager  UUID := (SELECT id FROM roles WHERE slug = 'manager');
  r_employee UUID := (SELECT id FROM roles WHERE slug = 'employee');
  r_readonly UUID := (SELECT id FROM roles WHERE slug = 'readonly');
BEGIN

  INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
  VALUES
    (r_admin,    'pos_sales', TRUE,  TRUE,  TRUE,  TRUE),
    (r_manager,  'pos_sales', TRUE,  TRUE,  TRUE,  TRUE),
    (r_employee, 'pos_sales', TRUE,  FALSE, FALSE, FALSE),
    (r_readonly, 'pos_sales', FALSE, FALSE, FALSE, FALSE)
  ON CONFLICT (role_id, module) DO UPDATE
    SET can_view   = EXCLUDED.can_view,
        can_create = EXCLUDED.can_create,
        can_edit   = EXCLUDED.can_edit,
        can_delete = EXCLUDED.can_delete;

END $$;
