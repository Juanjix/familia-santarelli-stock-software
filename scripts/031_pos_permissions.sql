-- Migration 031: Permisos del módulo POS para todos los roles existentes

DO $$
DECLARE
  r_admin    UUID;
  r_manager  UUID;
  r_employee UUID;
  r_readonly UUID;
BEGIN
  SELECT id INTO r_admin    FROM roles WHERE slug = 'admin';
  SELECT id INTO r_manager  FROM roles WHERE slug = 'manager';
  SELECT id INTO r_employee FROM roles WHERE slug = 'employee';
  SELECT id INTO r_readonly FROM roles WHERE slug = 'readonly';

  -- Admin: acceso total
  INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
  VALUES (r_admin, 'pos', TRUE, TRUE, TRUE, TRUE)
  ON CONFLICT (role_id, module) DO UPDATE
    SET can_view=TRUE, can_create=TRUE, can_edit=TRUE, can_delete=TRUE;

  -- Manager: puede ver, crear y editar ventas, puede anular
  INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
  VALUES (r_manager, 'pos', TRUE, TRUE, TRUE, TRUE)
  ON CONFLICT (role_id, module) DO UPDATE
    SET can_view=TRUE, can_create=TRUE, can_edit=TRUE, can_delete=TRUE;

  -- Employee: puede crear ventas pero no anular
  INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
  VALUES (r_employee, 'pos', TRUE, TRUE, FALSE, FALSE)
  ON CONFLICT (role_id, module) DO UPDATE
    SET can_view=TRUE, can_create=TRUE, can_edit=FALSE, can_delete=FALSE;

  -- Readonly: solo ver historial
  INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
  VALUES (r_readonly, 'pos', TRUE, FALSE, FALSE, FALSE)
  ON CONFLICT (role_id, module) DO UPDATE
    SET can_view=TRUE, can_create=FALSE, can_edit=FALSE, can_delete=FALSE;
END $$;
