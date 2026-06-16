-- Fix: deshabilitar RLS en category_attributes para permitir acceso con anon key.
-- Las tablas existentes del proyecto ya tienen RLS deshabilitado;
-- la tabla nueva heredó el comportamiento por defecto de Supabase (RLS activo sin políticas).

ALTER TABLE category_attributes DISABLE ROW LEVEL SECURITY;
