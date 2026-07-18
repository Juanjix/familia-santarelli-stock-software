-- 037_drop_obsolete_functions.sql
-- Drops orphaned function overloads left by migrations that changed a function's signature.
--
-- Background: in PostgreSQL, CREATE OR REPLACE FUNCTION only replaces a function when
-- the parameter list is identical. Adding or removing a parameter creates a NEW overload
-- instead of replacing the old one. Both signatures then coexist in pg_proc, and Supabase
-- returns 300 Multiple Choices when it cannot resolve which one to call.
--
-- Script 035 replaced the 7-param update_stock from script 007 (safe, same signature).
-- Script 036 added an 8th param (p_stock_transfer_id), creating a new overload — it did
-- NOT remove the 7-param version. This DROP removes the orphaned 7-param signature.

DROP FUNCTION IF EXISTS update_stock(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, UUID);

-- Verify: after running this, only the 8-param version should remain.
-- Expected result: 1 row.
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'update_stock';
