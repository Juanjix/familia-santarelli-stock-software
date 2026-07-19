-- 039_sales_voided_by_app_users.sql
--
-- Sprint A — corrección del FK de sales.voided_by.
--
-- Contexto:
--   El script 038 reescribió void_sale() para resolver identidad desde
--   auth.uid() → app_users. La función almacenaba v_actor_auth_id
--   (= app_users.auth_id, que es el UUID de auth.users) en sales.voided_by.
--   El FK original apuntaba a employees(id), lo que causaba violación de
--   integridad al guardar un UUID de auth.users.
--
-- Modelo objetivo (definido en Sprint A):
--   Toda auditoría de acciones → actor_id REFERENCES app_users(id)  (PK interno)
--   Nombre histórico          → *_name TEXT snapshot al momento de la operación
--   Relaciones de negocio     → *_employee_id REFERENCES employees(id)
--
-- Este script:
--   1. Actualiza resolve_actor() para devolver también app_users.id (PK interno).
--   2. Actualiza void_sale() para almacenar app_users.id en voided_by
--      (no el auth_id que devolvía antes).
--   3. Migra sales.voided_by: elimina FK → employees, agrega FK → app_users(id).
--
-- Nota sobre datos históricos:
--   Los registros anteriores con un employee_id en voided_by no son UUIDs
--   válidos de app_users, por lo que se limpian a NULL. El nombre del actor
--   en esas anulaciones se pierde como FK pero puede recuperarse desde
--   el campo reason de la venta o desde logs externos si fuera necesario.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. resolve_actor() — agrega app_users.id al resultado
--
-- Antes: devolvía (auth_id, display_name, role, employee_id)
-- Ahora: devuelve (id, auth_id, display_name, role, employee_id)
--        donde id = app_users.id (PK interno, referencia canónica para FKs)
--
-- SECURITY INVOKER se mantiene: el usuario puede leer su propia fila por RLS.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_actor()
RETURNS TABLE (
  id           UUID,
  auth_id      UUID,
  display_name TEXT,
  role         TEXT,
  employee_id  UUID
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    u.id,
    u.auth_id,
    u.display_name,
    r.slug   AS role,
    u.employee_id
  FROM app_users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.auth_id = auth.uid()
    AND u.is_active = TRUE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION resolve_actor() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. void_sale() — almacena app_users.id en voided_by (no auth_id)
--
-- Cambio respecto a script 038:
--   v_actor_id (app_users.id) reemplaza a v_actor_auth_id (app_users.auth_id)
--   como valor almacenado en sales.voided_by.
--   Esto permite que voided_by referencie app_users(id) con FK real.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION void_sale(
  p_sale_id UUID,
  p_reason  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- ── Identidad ──────────────────────────────────────────────────────────────
  v_actor_id          UUID;   -- app_users.id (PK interno — referencia canónica)
  v_actor_auth_id     UUID;   -- app_users.auth_id (para trazabilidad)
  v_actor_name        TEXT;
  v_actor_role        TEXT;
  v_actor_employee_id UUID;

  -- ── Datos de negocio ───────────────────────────────────────────────────────
  v_sale              sales%ROWTYPE;
  v_item              sale_items%ROWTYPE;
  v_current_stock     INTEGER;
BEGIN

  -- ── Bloque 1: Resolución de identidad ──────────────────────────────────────
  SELECT id, auth_id, display_name, role, employee_id
  INTO   v_actor_id, v_actor_auth_id, v_actor_name, v_actor_role, v_actor_employee_id
  FROM   resolve_actor();

  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok',           false,
      'error_code',   'UNAUTHENTICATED',
      'error_detail', 'No se pudo resolver la identidad del usuario. Verificá tu sesión.'
    );
  END IF;

  -- ── Bloque 2: Validaciones de negocio ──────────────────────────────────────
  -- LOCK → VALIDATE: FOR UPDATE adquiere el lock y lee el estado en una sola
  -- operación atómica. Las validaciones ocurren siempre sobre el estado bloqueado.
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok',           false,
      'error_code',   'NOT_FOUND',
      'error_detail', 'Venta no encontrada.'
    );
  END IF;

  IF v_sale.status <> 'confirmed' THEN
    RETURN jsonb_build_object(
      'ok',           false,
      'error_code',   'INVALID_STATUS',
      'error_detail', 'Solo se pueden anular ventas confirmadas.'
    );
  END IF;

  -- ── Bloque 3: Reversión de stock ───────────────────────────────────────────
  -- ORDER BY product_id ASC, id ASC: orden determinístico de adquisición de locks.
  -- Convención del proyecto: toda función que itere múltiples productos debe
  -- ordenar por (product_id ASC, warehouse_id ASC) para evitar deadlocks.
  -- warehouse_id es uniforme por venta (v_sale.warehouse_id) → no es columna
  -- de sale_items, pero debe agregarse al ORDER BY si las ventas pasan a
  -- soportar múltiples depósitos.
  --
  -- Sprint B: reemplazar por register_inventory_movement('sale_reversal', p_sale_id).
  FOR v_item IN
    SELECT * FROM sale_items
    WHERE sale_id = p_sale_id
    ORDER BY product_id ASC, id ASC
  LOOP

    SELECT quantity INTO v_current_stock
    FROM product_stock
    WHERE product_id  = v_item.product_id
      AND warehouse_id = v_sale.warehouse_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      INSERT INTO product_stock (product_id, warehouse_id, quantity)
      VALUES (v_item.product_id, v_sale.warehouse_id, v_item.quantity)
      ON CONFLICT (product_id, warehouse_id) DO UPDATE
        SET quantity   = product_stock.quantity + EXCLUDED.quantity,
            updated_at = now();
    ELSE
      UPDATE product_stock
      SET quantity   = quantity + v_item.quantity,
          updated_at = now()
      WHERE product_id  = v_item.product_id
        AND warehouse_id = v_sale.warehouse_id;
    END IF;

    INSERT INTO movements (
      product_id, type, quantity,
      to_warehouse_id, reason, user_name, sale_id
    )
    VALUES (
      v_item.product_id,
      'sale_reversal',
      v_item.quantity,
      v_sale.warehouse_id,
      format('Anulación V-%s: %s', LPAD(v_sale.sale_number::text, 4, '0'), p_reason),
      v_actor_name,    -- snapshot histórico del nombre en el momento de la operación
      p_sale_id
    );

  END LOOP;

  -- ── Bloque 4: Anular entidades relacionadas ────────────────────────────────
  UPDATE exchange_tickets
  SET status = 'voided'
  WHERE sale_id = p_sale_id AND status = 'active';

  UPDATE sale_commissions
  SET status = 'voided', updated_at = now()
  WHERE sale_id = p_sale_id AND status = 'pending';

  -- ── Bloque 5: Marcar venta como anulada ────────────────────────────────────
  -- voided_by = app_users.id (PK interno): referencia canónica al actor.
  -- Permite JOIN directo a app_users para obtener nombre, rol y employee_id.
  UPDATE sales
  SET status      = 'voided',
      voided_at   = now(),
      voided_by   = v_actor_id,
      void_reason = p_reason,
      updated_at  = now()
  WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'ok',        true,
    'voided_by', v_actor_name,
    'role',      v_actor_role
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok',           false,
    'error_code',   'UNEXPECTED_ERROR',
    'error_detail', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION void_sale(UUID, TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Migración de sales.voided_by
--
-- Elimina FK → employees(id) y agrega FK → app_users(id).
-- ON DELETE SET NULL: si el usuario es eliminado, voided_by queda NULL.
-- Los registros históricos con employee_id en voided_by son UUIDs no válidos
-- en app_users; se limpian a NULL antes de agregar la nueva constraint.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_voided_by_fkey;

-- Limpiar valores históricos incompatibles con la nueva FK.
-- Un employee_id no es un app_users.id válido.
UPDATE sales
SET voided_by = NULL
WHERE voided_by IS NOT NULL
  AND voided_by NOT IN (SELECT id FROM app_users);

ALTER TABLE sales
  ADD CONSTRAINT sales_voided_by_app_users_fkey
  FOREIGN KEY (voided_by)
  REFERENCES app_users(id)
  ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. resolve_actor debe devolver (id, auth_id, display_name, role, employee_id)
SELECT * FROM resolve_actor();

-- 2. FK de voided_by debe apuntar a app_users
SELECT
  tc.constraint_name,
  ccu.table_schema || '.' || ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'sales'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'voided_by';

-- 3. void_sale debe tener exactamente 2 parámetros
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc WHERE proname = 'void_sale';
