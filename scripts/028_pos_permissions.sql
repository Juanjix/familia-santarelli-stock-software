-- ── 028: Agregar módulo `pos` a role_permissions ─────────────────────────────
-- El módulo ya existía en el sidebar (module: "pos") pero no tenía entrada
-- en role_permissions. Esto causaba que canView("pos") retornara false para
-- todos los roles — el botón "Punto de Venta" era invisible para todos.
--
-- Permisos por rol:
--   admin    → CRUD completo
--   manager  → view + create (procesa ventas, no administra)
--   employee → view + create (procesa ventas, no administra)
--   readonly → sin acceso (rol de consulta, no de operación)

DO $$
DECLARE
  r_admin    UUID := (SELECT id FROM roles WHERE slug = 'admin');
  r_manager  UUID := (SELECT id FROM roles WHERE slug = 'manager');
  r_employee UUID := (SELECT id FROM roles WHERE slug = 'employee');
  r_readonly UUID := (SELECT id FROM roles WHERE slug = 'readonly');
BEGIN

  INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
  VALUES
    (r_admin,    'pos', TRUE,  TRUE,  TRUE,  TRUE),
    (r_manager,  'pos', TRUE,  TRUE,  FALSE, FALSE),
    (r_employee, 'pos', TRUE,  TRUE,  FALSE, FALSE),
    (r_readonly, 'pos', FALSE, FALSE, FALSE, FALSE)
  ON CONFLICT (role_id, module) DO UPDATE
    SET can_view   = EXCLUDED.can_view,
        can_create = EXCLUDED.can_create,
        can_edit   = EXCLUDED.can_edit,
        can_delete = EXCLUDED.can_delete;

END $$;
