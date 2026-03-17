# Explicación de los Módulos de Cuentas

Este documento detalla la lógica y funcionamiento de los módulos de **Cuentas por Cobrar** y **Cuentas por Pagar** en el sistema LicorPos.

## 1. Cuentas por Cobrar (Deudas de Clientes)

Este módulo gestiona el dinero que los clientes deben al negocio, generalmente originado por ventas a crédito.

### Flujo Principal

1.  **Origen (Venta a Crédito):**
    *   Cuando se realiza una venta en el módulo POS y el método de pago es "Crédito", el sistema crea automáticamente un registro en la tabla `cuentas_por_cobrar`.
    *   Este registro vincula la venta (`venta_id`) con el cliente (`cliente_id`) y establece el monto total y la fecha de vencimiento.

2.  **Gestión de la Cuenta (`CuentasCobrarService`):**
    *   **Estado:** Las cuentas pueden tener estados como 'pendiente', 'pagada', 'parcial' o 'vencida'.
    *   **Carga de Datos:** El servicio obtiene las cuentas desde Supabase uniendo la tabla con `clientes` para mostrar el nombre del deudor.

3.  **Registro de Pagos:**
    *   Desde el componente `ModalPagoComponent`, el usuario registra un abono.
    *   Se inserta un registro en la tabla `pagos_cuentas` (vinculado a la cuenta principal).
    *   **Lógica de Actualización:** A diferencia de Cuentas por Pagar (ver abajo), en este módulo la actualización del saldo y estado de la cuenta principal se maneja a menudo mediante *Triggers* de base de datos o lógica en el backend, aunque el servicio tiene métodos como `actualizarEstadoCuenta` para intervenciones manuales.

4.  **Recordatorios:**
    *   Existe un sub-módulo para gestionar notificaciones de cobro a clientes con deudas vencidas.

---

## 2. Cuentas por Pagar (Deudas con Proveedores)

Este módulo gestiona las obligaciones financieras del negocio con sus proveedores (compra de mercancía, servicios, alquiler, etc.).

### Flujo Principal

1.  **Origen (Compra o Gasto):**
    *   Se crean manualmente desde la opción "Nueva Cuenta" o posiblemente al registrar una Compra de Inventario a crédito.
    *   Se registran datos clave: Proveedor, Concepto, Categoría (Mercancía, Servicios, etc.), Prioridad, Fechas (Emisión/Vencimiento) y Montos.

2.  **Gestión de la Cuenta (`CuentasPagarService`):**
    *   Este servicio contiene una lógica robusta en el frontend para mantener la integridad de los datos.
    *   **Cálculo de Estados:**
        *   `pendiente`: No se ha pagado nada.
        *   `parcial`: Se ha pagado una parte, pero queda saldo.
        *   `pagada`: El saldo pendiente es 0.
        *   `vencida`: No está pagada y la fecha actual supera la de vencimiento.

3.  **Ciclo de Pagos y Actualización Automática:**
    *   Al registrar un pago con `registrarPago()`:
        1.  Se inserta el pago en `pagos_cuentas_pagar`.
        2.  Inmediatamente se llama a `actualizarMontosYEstado(cuentaId)`.
    *   **Lógica de `actualizarMontosYEstado`:**
        *   Suma todos los pagos asociados a esa cuenta.
        *   Calcula: `monto_pendiente = monto_total - total_pagado`.
        *   Determina el nuevo estado basado en el saldo y la fecha.
        *   Actualiza el registro maestro en `cuentas_pagar`.

4.  **Planificación:**
    *   Incluye lógica para proyectar un "Plan de Pagos" basado en las fechas de vencimiento y la prioridad asignada a cada deuda.

---

## Resumen Comparativo

| Característica | Cuentas por Cobrar | Cuentas por Pagar |
| :--- | :--- | :--- |
| **Sujeto** | Clientes | Proveedores |
| **Origen Principal** | Ventas (POS) | Registro Manual / Compras |
| **Lógica de Saldo** | Backend/Triggers (Predominante) | Frontend Service (Explícita) |
| **Tablas** | `cuentas_por_cobrar`, `pagos_cuentas` | `cuentas_pagar`, `pagos_cuentas_pagar` |
| **Prioridad** | Basada en antigüedad/monto | Definible (Urgente, Alta, Media, Baja) |
| **Categorías** | General (Venta) | Específicas (Mercancía, Servicios, etc.) |

Ambos módulos han sido refactorizados visualmente para usar **Bootstrap 5**, compartiendo componentes de interfaz como tarjetas de resumen, tablas con badges de estado y modales de acción, pero mantienen sus lógicas de negocio especializadas separadas en sus respectivos servicios.
