# Plan de Implementación: Integración Compras - Cuentas por Pagar

## Problema Detectado
Actualmente, el sistema registra las Compras (`compras`) y las Cuentas por Pagar (`cuentas_pagar`) de forma independiente. Cuando se registra una Nueva Compra con método de pago "Crédito", el sistema guarda la compra pero NO crea automáticamente la deuda correspondiente en el módulo de Cuentas por Pagar.

## Objetivo
Automatizar la creación de una "Cuenta por Pagar" cuando se registre una compra con método de pago **Crédito**.

## Cambios Requeridos

### 1. Modificar `src/app/services/compras.service.ts`

Necesitamos inyectar `CuentasPagarService` en `ComprasService` y modificar el método `crearCompra`.

**Lógica a implementar:**
1.  Verificar si `compra.metodo_pago === 'Crédito'`.
2.  Si es así, llamar a `CuentasPagarService.crearCuenta()` usando los datos de la compra recién creada.
3.  Mapear los campos de la compra a la cuenta por pagar:
    *   `proveedor_id` -> `proveedor_id`
    *   `numero_factura` -> `numero_factura` (concepto)
    *   `fecha_compra` -> `fecha_factura`
    *   `fecha_vencimiento` -> `fecha_vencimiento`
    *   `total` -> `monto_total`
    *   `categoria` -> "Mercancía" (valor por defecto)
    *   `prioridad` -> "media" (valor por defecto)

### 2. Estructura del Código

```typescript
// En compras.service.ts

// 1. Inyectar servicio
constructor(
  private supabaseService: SupabaseService,
  private cuentasPagarService: CuentasPagarService // Inyección nueva
) {}

// 2. Modificar crearCompra
async crearCompra(compra: CrearCompra, detalles: CrearDetalleCompra[]): Promise<Compra> {
  // ... lógica existente de creación de compra ...

  // NUEVA LÓGICA
  if (compra.metodo_pago === 'Crédito') {
    try {
      await this.cuentasPagarService.crearCuenta({
        proveedor_id: compra.proveedor_id,
        concepto: `Compra # (Factura: ${compra.numero_factura || 'S/N'})`,
        fecha_factura: compra.fecha_compra,
        fecha_vencimiento: compra.fecha_vencimiento || new Date(Date.now() + 30*24*60*60*1000).toISOString(),
        monto_total: compra.total,
        categoria: 'Mercancía',
        prioridad: 'media',
        numero_factura: compra.numero_factura,
        notas: `Generada automáticamente desde Compras. ID Compra: ${nuevaCompra.id}`
      });
      console.log('✅ Cuenta por pagar creada automáticamente');
    } catch (error) {
      console.error('⚠️ Error al crear cuenta automática:', error);
      // No detenemos el flujo principal, pero logueamos el error
    }
  }

  return nuevaCompra;
}
```

## Dependencias
*   Asegurar que `CuentasPagarService` pueda ser inyectado sin crear dependencias circulares. (Si ocurre, usaremos inyección directa de Supabase dentro de ComprasService para duplicar la inserción, aunque lo ideal es reutilizar el servicio).

## Verificación
1.  Registrar una compra con pago "Efectivo" -> Verificar que NO se cree cuenta por pagar.
2.  Registrar una compra con pago "Crédito" -> Verificar que SI se cree cuenta por pagar.
