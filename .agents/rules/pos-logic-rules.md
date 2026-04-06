# Reglas de Negocio: POS Licor Store
**Estado:** Activo

- **Integridad de Datos:** Nunca permitas la eliminación física de facturas. Toda anulación debe ser lógica (`status: 'annulled'`) y requiere un `supervisor_id` y un `reason`.
- **Contabilidad:** Cada transacción debe registrar el desglose de impuestos (ITBIS) y afectar la caja chica en tiempo real.
- **Precios:** El sistema debe manejar un array de precios `[normal, mayor, especial]` y aplicar el correspondiente según el `client_type`.
- **Seguridad:** Aplica Guardias de Angular para rutas basadas en roles (`ADMIN`, `SUPERVISOR`, `CASHIER`).