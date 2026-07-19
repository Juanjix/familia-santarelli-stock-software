-- 038_void_sale_identity_fix.sql
--
-- Sprint A: corrige la anulación de ventas para que la identidad del actor
-- se resuelva siempre desde auth.uid() → app_users, eliminando la dependencia
-- de que el frontend envíe un employee_id válido.
--
-- Cambios:
--   1. Nueva función resolve_actor() — punto único de resolución de identidad.
--   2. void_sale() reescrita: firma simplificada, usa resolve_actor(), delega
--      la reversión de stock a update_stock() para preparar Sprint B.
--
-- Prerequisito: script 037 debe haberse ejecutado (una sola overload de update_stock).


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. resolve_actor()
--
-- Devuelve la identidad completa del usuario autenticado desde app_users.
-- Una sola consulta cubre todos los casos de uso futuros (permisos, auditoría,
-- reportes, filtros por rol, relación con employees).
--
-- SECURITY INVOKER (sin elevación de privilegios):
--   app_users tiene RLS con policy "app_users_select_own" (auth_id = auth.uid()).
--   El usuario autenticado ya puede leer su propia fila sin elevar contexto.
--   Si en el futuro esta función necesita leer filas de otros usuarios
--   (ej. auditoría admin), ese será el momento de evaluar SECURITY DEFINER
--   con justificación explícita.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_actor()
RETURNS TABLE (
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
-- 2. void_sale(p_sale_id, p_reason)
--
-- Cambios respecto a la versión anterior (script 030):
--
--   a) Firma: eliminado p_voided_by UUID. El frontend ya no envía identidad.
--      El actor se resuelve internamente mediante resolve_actor().
--
--   b) Identidad: resolve_actor() → v_actor. Si el resultado está vacío
--      (sesión inválida, usuario inactivo), se rechaza antes de tocar datos.
--
--   c) Reversión de stock: reemplazado el UPDATE inline de product_stock +
--      INSERT directo en movements por llamada a update_stock(). Esto elimina
--      la lógica duplicada y asegura que toda modificación de stock pase por
--      el mismo camino (preparación para Sprint B).
--
--   d) Estructura preparada para Sprint B: cada responsabilidad tiene su
--      bloque delimitado. Cuando Sprint B reemplace update_stock() por
--      register_inventory_movement(), el cambio es local a ese bloque,
--      sin reestructurar la función.
--
--   e) sales.voided_by: pasa a almacenar auth_id (UUID de auth.users) en
--      lugar del employee_id. Refleja la identidad real del actor.
--
-- SECURITY DEFINER (heredado de la versión anterior, justificado):
--   void_sale necesita escribir en sales, movements y product_stock bajo
--   RLS. El contexto DEFINER permite operar con los permisos del owner
--   (postgres) sin exponer esas tablas a escritura pública.
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
  v_actor_auth_id     UUID;
  v_actor_name        TEXT;
  v_actor_role        TEXT;
  v_actor_employee_id UUID;

  -- ── Datos de negocio ───────────────────────────────────────────────────────
  v_sale              sales%ROWTYPE;
  v_item              sale_items%ROWTYPE;
BEGIN

  -- ── Bloque 1: Resolución de identidad ──────────────────────────────────────
  -- Punto único. Si falla aquí, no se toca ningún dato.
  SELECT auth_id, display_name, role, employee_id
  INTO   v_actor_auth_id, v_actor_name, v_actor_role, v_actor_employee_id
  FROM   resolve_actor();

  IF v_actor_auth_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok',           false,
      'error_code',   'UNAUTHENTICATED',
      'error_detail', 'No se pudo resolver la identidad del usuario. Verificá tu sesión.'
    );
  END IF;

  -- ── Bloque 2: Validaciones de negocio ──────────────────────────────────────
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
  -- Cada ítem de la venta, independientemente del depósito, se revierte
  -- individualmente. Esto cubre ventas con productos en distintos depósitos.
  --
  -- Delegado a update_stock() para usar el mismo camino que toda otra operación
  -- de inventario. En Sprint B, este bloque reemplazará update_stock() por
  -- register_inventory_movement() sin cambiar la estructura de la función.
  FOR v_item IN
    SELECT * FROM sale_items WHERE sale_id = p_sale_id
  LOOP
    PERFORM update_stock(
      p_product_id        => v_item.product_id,
      p_warehouse_id      => v_sale.warehouse_id,
      p_quantity          => v_item.quantity,
      p_type              => 'entry',                -- entry = devuelve unidades al depósito
      p_reason            => format('Anulación V-%s: %s',
                               LPAD(v_sale.sale_number::text, 4, '0'), p_reason),
      p_user_name         => v_actor_name,
      p_to_warehouse_id   => NULL,
      p_stock_transfer_id => NULL
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
  -- voided_by almacena auth_id (no employee_id) para reflejar la identidad
  -- real del actor independientemente de si tiene empleado asociado.
  UPDATE sales
  SET status      = 'voided',
      voided_at   = now(),
      voided_by   = v_actor_auth_id,
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

-- Revocar la firma vieja (p_sale_id, p_voided_by, p_reason) para que
-- no quede un overload huérfano como ocurrió con update_stock.
DROP FUNCTION IF EXISTS void_sale(UUID, UUID, TEXT);


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- Ejecutar después de aplicar el script. Debe mostrar exactamente una firma.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM   pg_proc
WHERE  proname IN ('void_sale', 'resolve_actor')
ORDER  BY proname;
