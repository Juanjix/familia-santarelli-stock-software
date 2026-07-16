-- Migration 034: Fase 2a — Limpieza de ventas en estado draft abandonadas
--
-- Un draft queda huérfano si la red cae o el browser cierra entre el INSERT
-- de la cabecera (paso 1) y la llamada RPC confirm_sale (paso 4).
-- ON DELETE CASCADE en sale_items y sale_payments garantiza que el DELETE
-- sobre sales elimina las filas hijas automáticamente.
--
-- La función es SECURITY DEFINER para que pueda invocarse vía RPC desde
-- el cliente o desde un cron job sin requerir permisos de escritura directa.

CREATE OR REPLACE FUNCTION cleanup_stale_drafts(
  p_max_age_minutes INT DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_ids  UUID[];
  v_count        INT;
  v_cutoff       TIMESTAMPTZ;
BEGIN
  v_cutoff := now() - (p_max_age_minutes || ' minutes')::INTERVAL;

  -- Capturar IDs antes de borrar para el log
  SELECT ARRAY_AGG(id) INTO v_deleted_ids
  FROM sales
  WHERE status = 'draft'
    AND created_at < v_cutoff;

  v_count := COALESCE(ARRAY_LENGTH(v_deleted_ids, 1), 0);

  IF v_count > 0 THEN
    -- CASCADE borra sale_items y sale_payments automáticamente
    DELETE FROM sales
    WHERE id = ANY(v_deleted_ids);
  END IF;

  RETURN jsonb_build_object(
    'ok',      true,
    'deleted', v_count,
    'cutoff',  v_cutoff
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok',          false,
    'error_detail', SQLERRM
  );
END;
$$;

-- Vista de auditoría: muestra drafts activos con su antigüedad.
-- Útil para monitorear cuántos drafts huérfanos se acumulan en producción.
CREATE OR REPLACE VIEW stale_draft_sales AS
SELECT
  s.id,
  s.sale_number,
  s.created_at,
  EXTRACT(EPOCH FROM (now() - s.created_at)) / 60 AS age_minutes,
  s.total_amount,
  e.name AS seller_name,
  w.name AS warehouse_name,
  (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
FROM sales s
LEFT JOIN employees e ON e.id = s.seller_id
LEFT JOIN warehouses w ON w.id = s.warehouse_id
WHERE s.status = 'draft'
ORDER BY s.created_at ASC;
