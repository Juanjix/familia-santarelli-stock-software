-- ============================================================
-- Fix: reestablecer DISABLE ROW LEVEL SECURITY en tablas donde
-- quedó habilitado (probablemente por el Security Advisor de
-- Supabase, que sugiere/activa RLS automáticamente).
-- Este proyecto no usa políticas de RLS — la autorización se
-- maneja a nivel de aplicación.
-- ============================================================

ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE jewelers DISABLE ROW LEVEL SECURITY;
ALTER TABLE envelopes DISABLE ROW LEVEL SECURITY;
ALTER TABLE envelope_subtypes DISABLE ROW LEVEL SECURITY;
ALTER TABLE envelope_status_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE envelope_events DISABLE ROW LEVEL SECURITY;

-- Verificación
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('customers', 'jewelers', 'envelopes', 'envelope_subtypes', 'envelope_status_log', 'envelope_events')
ORDER BY relname;
