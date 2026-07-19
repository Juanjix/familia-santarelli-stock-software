-- 038_void_sale_identity_fix.sql
--
-- Sprint A: corrige la anulación de ventas para que la identidad del actor
-- se resuelva siempre desde auth.uid() → app_users, eliminando la dependencia
-- de que el frontend envíe un employee_id válido.
--
-- Cambios:
--   1. resolve_actor()    — punto único de resolución de identidad.
--   2. void_sale()        — firma simplificada, identidad via resolve_actor(),
--                          FOR UPDATE en product_stock, bloques preparados para Sprint B.
--
-- Prerequisito: script 037 debe haberse ejecutado (una sola overload de update_stock).
--
-- Nota sobre delegación a update_stock():
--   update_stock() solo acepta los tipos 'entry', 'exit', 'adjustment', 'transfer'.
--   El tipo 'sale_reversal' no está soportado y lanzaría una excepción.
--   Delegar a update_stock() para la reversión también perdería el FK sale_id en movements.
--   Por eso void_sale() mantiene su propio UPDATE de product_stock e INSERT en movements.
--   En Sprint B, register_inventory_movement() reemplazará ambos con soporte explícito
--   para 'sale_reversal' y para el parámetro p_sale_id.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. resolve_actor()
--
-- Devuelve la identidad completa del usuario autenticado desde app_users.
-- Una sola consulta cubre todos los casos de uso: auditoría, permisos,
-- reportes, filtros por rol, relación con employees.
--
-- SECURITY INVOKER (sin elevación de privilegios):
--   app_users tiene RLS con policy "app_users_select_own" (auth_id = auth.uid()).
--   El usuario autenticado puede leer su propia fila sin elevar contexto.
--   SECURITY DEFINER solo sería necesario si esta función necesitara leer
--   filas de otros usuarios (ej. auditoría admin) — ese caso pertenece a Sprint B.
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
--      La identidad se resuelve internamente mediante resolve_actor().
--
--   b) Identidad: si resolve_actor() no retorna filas (sesión inválida o usuario
--      inactivo), la función falla antes de tocar cualquier dato.
--
--   c) Concurrencia: agregado SELECT ... FOR UPDATE sobre product_stock dentro
--      del loop de ítems. Serializa concurrent adjustments o exits sobre el
--      mismo producto, evitando que un ajuste paralelo lea stock stale mientras
--      void_sale está dentro de su transacción.
--
--   d) Tipo de movimiento: se mantiene 'sale_reversal' (no 'entry') para
--      preservar la trazabilidad de auditoría. El FK sale_id también se mantiene.
--      Motivo: update_stock() no soporta 'sale_reversal' ni acepta sale_id.
--      Sprint B introducirá register_inventory_movement() que cubrirá este caso.
--
--   e) Estructura en bloques: cada responsabilidad tiene su sección delimitada.
--      En Sprint B, el Bloque 3 se reemplaza por llamadas a register_inventory_movement()
--      sin necesidad de reestructurar la función completa.
--
--   f) sales.voided_by: almacena auth_id (UUID de auth.users) en lugar del
--      employee_id. Refleja la identidad real del actor independientemente de
--      si tiene empleado asociado.
--
-- SECURITY DEFINER (justificado):
--   void_sale escribe en sales, movements y product_stock, todas con RLS activa.
--   El contexto DEFINER permite operar con los permisos del owner sin exponer
--   esas tablas a escritura pública vía PostgREST.
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
  v_current_stock     INTEGER;
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
  -- FOR UPDATE en sales previene doble anulación concurrente.
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
  -- Itera todos los ítems de la venta, incluyendo productos en distintos depósitos.
  -- FOR UPDATE en product_stock serializa esta transacción contra ajustes o salidas
  -- concurrentes sobre el mismo producto, eliminando el race condition de lectura stale.
  --
  -- Sprint B: este bloque será reemplazado por llamadas a register_inventory_movement()
  -- con p_type = 'sale_reversal' y p_sale_id, sin cambiar la estructura de la función.
  FOR v_item IN
    SELECT * FROM sale_items WHERE sale_id = p_sale_id
  LOOP

    -- Bloquear la fila de stock antes de modificarla.
    -- Si un ajuste o exit concurrente ya tiene el lock, void_sale espera.
    SELECT quantity INTO v_current_stock
    FROM product_stock
    WHERE product_id = v_item.product_id
      AND warehouse_id = v_sale.warehouse_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      -- El producto no tiene fila en este depósito — crearla con la cantidad a devolver.
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

    -- Movimiento tipo 'sale_reversal': preserva trazabilidad de auditoría y
    -- mantiene el FK sale_id. No se puede delegar a update_stock() porque ese
    -- tipo no está soportado allí.
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
      v_actor_name,
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
  -- voided_by = auth_id (no employee_id): identidad real independiente del rol.
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
-- no quede un overload huérfano igual que ocurrió con update_stock.
DROP FUNCTION IF EXISTS void_sale(UUID, UUID, TEXT);


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- Debe mostrar exactamente dos filas: resolve_actor y void_sale(uuid, text).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM   pg_proc
WHERE  proname IN ('void_sale', 'resolve_actor')
ORDER  BY proname;
