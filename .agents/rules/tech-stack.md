# Stack Tecnológico: Supabase + Angular
**Backend:** Supabase (PostgreSQL + Auth + Storage).

- **Auth:** Usar Supabase Auth para el manejo de roles (Admin, Supervisor, Cajero).
- **Base de Datos:** PostgreSQL con RLS (Row Level Security) activo para que cada sucursal/usuario solo vea sus datos.
- **Lógica Contable:** Las operaciones críticas (como el cálculo de ITBIS y cierre de caja) deben hacerse preferiblemente vía **RPC (Stored Procedures)** en la base de datos para asegurar precisión atómica.
- **Edge Functions:** Usar Supabase Edge Functions (Deno) para el envío de facturas por WhatsApp y correo.