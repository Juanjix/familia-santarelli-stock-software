-- 038_void_sale_identity_fix.sql
--
-- Sprint A: corrige la anulación de ventas para que la identidad del actor
-- se resuelva siempre desde auth.uid() → app_users, eliminando la dependencia
-- de que el frontend envíe un employee_id válido.
--
-- Cambios:
--   1. resolve_actor()    — punto único de resolución de identidad.
--   2. void_sale()        — firma simplificada, identidad via resolve_actor(),
--                          locking ordenado sobre product_stock, Sprint B ready.
--
-- Prerequisito: script 037 debe haberse ejecutado (una sola overload de update_stock).
--
-- ─── Nota sobre delegación a update_stock() ──────────────────────────────────
-- update_stock() solo acepta los tipos 'entry', 'exit', 'adjustment', 'transfer'.
-- Pasar p_type = 'sale_reversal' lanza una excepción explícita en su ELSE branch.
-- Delegar a update_stock() también perdería el FK sale_id en movements (ese
-- parámetro no existe en la firma actual).
-- Por eso void_sale() mantiene su propia actualización de product_stock y su
-- propio INSERT en movements con tipo 'sale_reversal'.
-- En Sprint B, register_inventory_movement() reemplazará ambos con soporte
-- nativo para 'sale_reversal' y el parámetro p_sale_id.
--
-- ─── Análisis de locking ─────────────────────────────────────────────────────
-- update_stock() opera sobre un único producto por llamada. Aplica FOR UPDATE
-- explícito solo en exit y transfer; entry y adjustment usan lock implícito
-- (INSERT ON CONFLICT / UPDATE directo). No existe riesgo de deadlock
-- intra-función.
--
-- void_sale() itera múltiples productos dentro de la misma transacción.
-- Si dos transacciones concurrentes adquieren locks sobre los mismos productos
-- en orden distinto, se produce un ciclo de dependencia → deadlock.
-- Ejemplo:
--   T1 (void Venta A = [P1, P2]): adquiere lock P1, espera P2
--   T2 (confirm Venta B = [P2, P1]): adquiere lock P2 (UPDATE implícito), espera P1
--   → deadlock
--
-- Solución: el loop itera sale_items con ORDER BY product_id ASC, id ASC.
-- Todas las transacciones que toquen product_stock adquirirán locks en el
-- mismo orden ascendente de product_id, eliminando el ciclo de dependencia.
-- confirm_sale() y update_stock() adquieren locks de a un producto por vez,
-- por lo que son compatibles con este orden sin modificación.
--
-- ─── Consistencia de sale_items ──────────────────────────────────────────────
-- La lectura de sale_items es un SELECT sin lock explícito bajo READ COMMITTED.
-- Es consistente porque:
--   1. void_sale() adquiere FOR UPDATE sobre la fila de sales antes de leer
--      sale_items. Cualquier transacción que intente modificar esa fila de
--      sales (confirm_sale, otra void_sale) bloquea en ese punto.
--   2. El único camino de escritura sobre sale_items de una venta existente
--      es confirm_sale, que también hace FOR UPDATE sobre la misma fila de
--      sales. Si esa venta ya está lockeada, confirm_sale espera.
--   3. En el modelo de negocio, los ítems de una venta confirmada son
--      inmutables. Ninguna otra función los modifica.
-- El FOR UPDATE sobre sales actúa como guardián de todos sus items dependientes.


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
--   Si en el futuro esta función necesita leer filas de otros usuarios
--   (ej. módulo de auditoría admin), ese es el momento de evaluar SECURITY
--   DEFINER con justificación explícita. No antes.
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
--   a) Firma: eliminado p_voided_by UUID. La identidad se resuelve
--      internamente mediante resolve_actor(). El frontend solo envía
--      p_sale_id y p_reason.
--
--   b) Identidad: si resolve_actor() no retorna filas (sesión inválida o
--      usuario inactivo), la función rechaza la operación antes de tocar datos.
--
--   c) Locking ordenado: el loop de sale_items usa ORDER BY product_id, id
--      para garantizar que el orden de adquisición de locks sobre product_stock
--      sea idéntico en todas las transacciones concurrentes. Elimina deadlocks
--      cuando dos operaciones tocan el mismo conjunto de productos.
--      Ver análisis completo en el encabezado de este script.
--
--   d) FOR UPDATE en product_stock: se adquiere antes del UPDATE para
--      serializar la transacción contra exits o adjustments concurrentes sobre
--      el mismo producto. Si un update_stock(exit) ya tiene el lock, void_sale
--      espera en lugar de leer stock stale.
--
--   e) Tipo de movimiento: se mantiene 'sale_reversal' con FK sale_id para
--      preservar trazabilidad de auditoría. No se puede delegar a update_stock()
--      por las razones detalladas en el encabezado.
--
--   f) Estructura en bloques: cada responsabilidad tiene su sección delimitada.
--      En Sprint B, el Bloque 3 se reemplaza por llamadas a
--      register_inventory_movement() sin reestructurar la función.
--
--   g) sales.voided_by: almacena auth_id (UUID de auth.users) en lugar del
--      employee_id. Identidad real independiente del rol asignado.
--
-- SECURITY DEFINER (justificado):
--   void_sale escribe en sales, movements y product_stock, todas con RLS activa.
--   El contexto DEFINER permite operar con los permisos del owner sin exponer
--   esas tablas a escritura directa vía PostgREST.
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
  -- Punto único de identidad. Si el resultado está vacío (sesión inválida o
  -- usuario inactivo), se rechaza la operación antes de tocar cualquier dato.
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
  -- FOR UPDATE en sales previene doble anulación concurrente y actúa como
  -- guardián de sale_items (ver análisis de consistencia en el encabezado).
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
  -- ORDER BY product_id ASC, id ASC garantiza orden de adquisición de locks
  -- idéntico al de cualquier transacción concurrente que itere los mismos
  -- productos. Elimina la posibilidad de deadlock por ciclo de dependencia.
  --
  -- FOR UPDATE en product_stock serializa contra update_stock(exit/transfer)
  -- concurrentes sobre el mismo producto y depósito.
  --
  -- Cubre ventas con productos en distintos depósitos: cada ítem usa
  -- v_sale.warehouse_id (el depósito de la venta), no un depósito fijo.
  --
  -- Sprint B: reemplazar este bloque por llamadas a register_inventory_movement(
  --   p_product_id, p_warehouse_id, p_quantity, 'sale_reversal',
  --   p_reason, p_user_name, p_sale_id
  -- ) sin cambiar la estructura de la función.
  FOR v_item IN
    SELECT * FROM sale_items
    WHERE sale_id = p_sale_id
    ORDER BY product_id ASC, id ASC
  LOOP

    -- Adquirir lock explícito antes del UPDATE.
    -- Si update_stock(exit) ya tiene este lock, void_sale espera aquí.
    -- El orden de adquisición (product_id ASC) coincide con el orden del loop,
    -- por lo que dos void_sale concurrentes sobre ventas con productos en común
    -- adquirirán los locks en el mismo orden y no formarán ciclos.
    SELECT quantity INTO v_current_stock
    FROM product_stock
    WHERE product_id  = v_item.product_id
      AND warehouse_id = v_sale.warehouse_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      -- El producto no tiene fila en este depósito (edge case: stock eliminado).
      -- Se crea la fila con la cantidad revertida para mantener integridad.
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

    -- Tipo 'sale_reversal' preserva la distinción de auditoría respecto a
    -- un 'entry' ordinario. FK sale_id vincula el movimiento a la venta original.
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
  -- voided_by almacena auth_id (no employee_id): identidad real del actor
  -- independientemente de si tiene empleado asociado en el sistema.
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
-- Debe mostrar exactamente dos filas:
--   resolve_actor  → (sin argumentos)
--   void_sale      → uuid, text
-- ─────────────────────────────────────────────────────────────────────────────
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM   pg_proc
WHERE  proname IN ('void_sale', 'resolve_actor')
ORDER  BY proname;
