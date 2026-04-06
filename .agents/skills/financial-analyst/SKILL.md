---
name: financial-analyst
description: Genera reportes de beneficios, márgenes de ganancia y estados de cuenta de clientes.
---
# Instrucciones
1. **Margen de Ganancia:** Calcula mediante la fórmula $Gain = Price - Cost$. Reporta el porcentaje de beneficio por artículo y por venta total.
2. **Cuentas por Cobrar:** Filtra facturas con `payment_status: 'pending'` y calcula los `days_overdue` comparando la fecha actual con `due_date`.
3. **Reporte de Caja:** Agrupa los pagos por `payment_method` (Efectivo, Tarjeta, Transferencia) y por `bank_destination`.
4. **Estados de Cuenta:** Genera un resumen de pagos y deudas por cliente.