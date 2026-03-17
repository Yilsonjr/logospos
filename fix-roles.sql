-- Ejecuta el siguiente comando en el SQL Editor de tu proyecto Supabase.
-- Esta versión está optimizada por si tu columna 'permisos' es de tipo JSONB (el comportamiento por defecto de Supabase).

UPDATE roles
SET permisos = (
  SELECT coalesce(jsonb_agg(DISTINCT x), '[]'::jsonb)
  FROM jsonb_array_elements_text(
    CASE 
      WHEN jsonb_typeof(permisos) = 'array' THEN permisos 
      ELSE '[]'::jsonb 
    END || '["cuentas.editar", "cuentas.crear", "cuentas.eliminar"]'::jsonb
  ) t(x)
)
WHERE nombre IN ('Super Administrador', 'Administrador');
