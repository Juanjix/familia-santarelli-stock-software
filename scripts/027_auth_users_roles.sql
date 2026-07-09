-- Migration 027: sistema de autenticación, roles y permisos
-- Ejecutar en Supabase SQL Editor

-- ── 1. Roles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,   -- "Administrador", "Encargado", etc.
  slug        TEXT NOT NULL UNIQUE,   -- "admin", "manager", "employee", "readonly"
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (name, slug, description) VALUES
  ('Administrador', 'admin',    'Acceso total al sistema, gestión de usuarios y configuración'),
  ('Encargado',     'manager',  'Acceso operativo completo sin gestión de usuarios ni configuración'),
  ('Empleado',      'employee', 'Acceso operativo básico: ventas, sobres, etiquetas'),
  ('Solo Lectura',  'readonly', 'Visualización sin posibilidad de crear ni modificar')
ON CONFLICT (slug) DO NOTHING;

-- ── 2. Usuarios del sistema ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id       UUID REFERENCES roles(id),
  employee_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  warehouse_id  UUID REFERENCES warehouses(id) ON DELETE SET NULL,  -- para futuro multi-sucursal
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Permisos por rol y módulo ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module     TEXT NOT NULL,
  can_view   BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit   BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(role_id, module)
);

-- ── 4. Permisos iniciales ─────────────────────────────────────────────────────
DO $$
DECLARE
  r_admin    UUID := (SELECT id FROM roles WHERE slug = 'admin');
  r_manager  UUID := (SELECT id FROM roles WHERE slug = 'manager');
  r_employee UUID := (SELECT id FROM roles WHERE slug = 'employee');
  r_readonly UUID := (SELECT id FROM roles WHERE slug = 'readonly');
BEGIN

  -- ADMIN: acceso total a todo
  INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
  SELECT r_admin, m, TRUE, TRUE, TRUE, TRUE
  FROM unnest(ARRAY[
    'dashboard','products','inventory','scan','sobres','coupons',
    'transfers','movements','reports','labels','warehouses','settings','users'
  ]) AS m
  ON CONFLICT (role_id, module) DO NOTHING;

  -- MANAGER: todo menos users y settings
  INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
  VALUES
    (r_manager, 'dashboard',  TRUE,  FALSE, FALSE, FALSE),
    (r_manager, 'products',   TRUE,  TRUE,  TRUE,  FALSE),
    (r_manager, 'inventory',  TRUE,  TRUE,  TRUE,  FALSE),
    (r_manager, 'scan',       TRUE,  FALSE, FALSE, FALSE),
    (r_manager, 'sobres',     TRUE,  TRUE,  TRUE,  TRUE),
    (r_manager, 'coupons',    TRUE,  TRUE,  TRUE,  FALSE),
    (r_manager, 'transfers',  TRUE,  TRUE,  TRUE,  FALSE),
    (r_manager, 'movements',  TRUE,  FALSE, FALSE, FALSE),
    (r_manager, 'reports',    TRUE,  FALSE, FALSE, FALSE),
    (r_manager, 'labels',     TRUE,  FALSE, FALSE, FALSE),
    (r_manager, 'warehouses', TRUE,  FALSE, FALSE, FALSE),
    (r_manager, 'settings',   FALSE, FALSE, FALSE, FALSE),
    (r_manager, 'users',      FALSE, FALSE, FALSE, FALSE)
  ON CONFLICT (role_id, module) DO NOTHING;

  -- EMPLOYEE: operativo básico
  INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
  VALUES
    (r_employee, 'dashboard',  TRUE,  FALSE, FALSE, FALSE),
    (r_employee, 'products',   TRUE,  FALSE, FALSE, FALSE),
    (r_employee, 'inventory',  TRUE,  TRUE,  TRUE,  FALSE),
    (r_employee, 'scan',       TRUE,  FALSE, FALSE, FALSE),
    (r_employee, 'sobres',     TRUE,  TRUE,  TRUE,  FALSE),
    (r_employee, 'coupons',    TRUE,  TRUE,  FALSE, FALSE),
    (r_employee, 'transfers',  TRUE,  TRUE,  FALSE, FALSE),
    (r_employee, 'movements',  TRUE,  FALSE, FALSE, FALSE),
    (r_employee, 'reports',    FALSE, FALSE, FALSE, FALSE),
    (r_employee, 'labels',     TRUE,  FALSE, FALSE, FALSE),
    (r_employee, 'warehouses', FALSE, FALSE, FALSE, FALSE),
    (r_employee, 'settings',   FALSE, FALSE, FALSE, FALSE),
    (r_employee, 'users',      FALSE, FALSE, FALSE, FALSE)
  ON CONFLICT (role_id, module) DO NOTHING;

  -- READONLY: solo lectura en módulos operativos
  INSERT INTO role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
  VALUES
    (r_readonly, 'dashboard',  TRUE,  FALSE, FALSE, FALSE),
    (r_readonly, 'products',   TRUE,  FALSE, FALSE, FALSE),
    (r_readonly, 'inventory',  TRUE,  FALSE, FALSE, FALSE),
    (r_readonly, 'scan',       TRUE,  FALSE, FALSE, FALSE),
    (r_readonly, 'sobres',     TRUE,  FALSE, FALSE, FALSE),
    (r_readonly, 'coupons',    TRUE,  FALSE, FALSE, FALSE),
    (r_readonly, 'transfers',  TRUE,  FALSE, FALSE, FALSE),
    (r_readonly, 'movements',  TRUE,  FALSE, FALSE, FALSE),
    (r_readonly, 'reports',    TRUE,  FALSE, FALSE, FALSE),
    (r_readonly, 'labels',     FALSE, FALSE, FALSE, FALSE),
    (r_readonly, 'warehouses', FALSE, FALSE, FALSE, FALSE),
    (r_readonly, 'settings',   FALSE, FALSE, FALSE, FALSE),
    (r_readonly, 'users',      FALSE, FALSE, FALSE, FALSE)
  ON CONFLICT (role_id, module) DO NOTHING;

END $$;

-- ── 5. Auditoría de sesiones ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES app_users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL CHECK (action IN ('login', 'logout', 'token_refresh')),
  user_agent  TEXT,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. Trigger: updated_at en app_users ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_users_updated_at ON app_users;
CREATE TRIGGER trg_app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 7. Función: obtener perfil completo del usuario autenticado ───────────────
CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS JSON AS $$
  SELECT json_build_object(
    'id',           u.id,
    'auth_id',      u.auth_id,
    'display_name', u.display_name,
    'email',        u.email,
    'is_active',    u.is_active,
    'last_seen_at', u.last_seen_at,
    'warehouse_id', u.warehouse_id,
    'employee_id',  u.employee_id,
    'role', json_build_object(
      'id',   r.id,
      'name', r.name,
      'slug', r.slug
    ),
    'permissions', (
      SELECT json_object_agg(
        rp.module,
        json_build_object(
          'can_view',   rp.can_view,
          'can_create', rp.can_create,
          'can_edit',   rp.can_edit,
          'can_delete', rp.can_delete
        )
      )
      FROM role_permissions rp
      WHERE rp.role_id = u.role_id
    )
  )
  FROM app_users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.auth_id = auth.uid()
    AND u.is_active = TRUE
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 8. RLS en las nuevas tablas ───────────────────────────────────────────────
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs     ENABLE ROW LEVEL SECURITY;

-- Lectura de roles: cualquier autenticado
CREATE POLICY "roles_select" ON roles FOR SELECT USING (auth.uid() IS NOT NULL);

-- app_users: cada usuario ve su propio perfil; admin ve todos
CREATE POLICY "app_users_select_own" ON app_users FOR SELECT
  USING (auth_id = auth.uid());

CREATE POLICY "app_users_admin_all" ON app_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM app_users u2
      JOIN roles r ON r.id = u2.role_id
      WHERE u2.auth_id = auth.uid() AND r.slug = 'admin' AND u2.is_active = TRUE
    )
  );

-- role_permissions: lectura para todos los autenticados
CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- session_logs: cada usuario ve los suyos; admin ve todos
CREATE POLICY "session_logs_select_own" ON session_logs FOR SELECT
  USING (user_id IN (SELECT id FROM app_users WHERE auth_id = auth.uid()));

CREATE POLICY "session_logs_insert" ON session_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
