---
name: supabase-architect
description: Skill para diseñar esquemas de tablas y políticas RLS específicas para el POS.
---
# Instrucciones para el Agente
1. Al crear tablas, usa siempre tipos de datos `numeric` para montos de dinero (Precios, Impuestos, Ganancias).
2. Genera los scripts SQL para las políticas de seguridad (RLS) basándote en el rol del usuario (`auth.jwt() ->> 'role'`).
3. Para el reporte de margen de ganancia, crea una **View** en SQL que calcule automáticamente: 
   $$Gain\_Margin = \frac{Price - Cost}{Price} \times 100$$
4. Integra el manejo de "Notas de Crédito" usando disparadores (Triggers) para actualizar el stock automáticamente.