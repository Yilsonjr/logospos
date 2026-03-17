export interface CuentaPorPagar {
  id?: number;
  compra_id?: number; // Opcional, puede ser una cuenta manual
  proveedor_id: number;
  proveedor_nombre?: string; // Para mostrar en UI
  numero_factura?: string;
  concepto: string; // Descripción de la deuda
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  fecha_factura: string;
  fecha_vencimiento: string;
  estado: 'pendiente' | 'parcial' | 'pagada' | 'vencida';
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  categoria: string; // Ej: Mercancía, Servicios, Gastos Operativos
  notas?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PagoCuentaPagar {
  id?: number;
  cuenta_id: number;
  monto: number;
  metodo_pago: string;
  fecha_pago: string;
  numero_cheque?: string;
  referencia?: string;
  banco?: string;
  notas?: string;
  created_at?: string;
}

export interface CuentaPagarConPagos extends CuentaPorPagar {
  pagos: PagoCuentaPagar[];
}

// Tipos para crear/actualizar
export type CrearCuentaPorPagar = Omit<CuentaPorPagar, 'id' | 'created_at' | 'updated_at' | 'proveedor_nombre' | 'monto_pagado' | 'monto_pendiente' | 'estado'>;
export type CrearPagoCuentaPagar = Omit<PagoCuentaPagar, 'id' | 'created_at'>;

// Estados de cuenta por pagar
export const ESTADOS_CUENTA_PAGAR = [
  { valor: 'pendiente', etiqueta: 'Pendiente', color: 'orange', icono: 'fa-clock' },
  { valor: 'parcial', etiqueta: 'Pago Parcial', color: 'blue', icono: 'fa-clock-rotate-left' },
  { valor: 'pagada', etiqueta: 'Pagada', color: 'green', icono: 'fa-check-circle' },
  { valor: 'vencida', etiqueta: 'Vencida', color: 'red', icono: 'fa-exclamation-triangle' }
] as const;

// Prioridades
export const PRIORIDADES_PAGO = [
  { valor: 'baja', etiqueta: 'Baja', color: 'gray', icono: 'fa-arrow-down' },
  { valor: 'media', etiqueta: 'Media', color: 'yellow', icono: 'fa-minus' },
  { valor: 'alta', etiqueta: 'Alta', color: 'orange', icono: 'fa-arrow-up' },
  { valor: 'urgente', etiqueta: 'Urgente', color: 'red', icono: 'fa-exclamation' }
] as const;

// Categorías de cuentas por pagar
export const CATEGORIAS_CUENTA_PAGAR = [
  'Mercancía',
  'Servicios',
  'Gastos Operativos',
  'Servicios Públicos',
  'Alquiler',
  'Seguros',
  'Mantenimiento',
  'Marketing',
  'Tecnología',
  'Otros'
] as const;

// Métodos de pago para cuentas por pagar
export const METODOS_PAGO_PAGAR = [
  'Efectivo',
  'Transferencia Bancaria',
  'Cheque',
  'Tarjeta de Crédito',
  'Tarjeta de Débito',
  'Depósito Bancario',
  'Pago Móvil',
  'Compensación'
] as const;

// Resumen de cuentas por pagar
export interface ResumenCuentasPagar {
  total_cuentas: number;
  total_pendiente: number;
  total_vencidas: number;
  total_parciales: number;
  total_pagadas: number;
  monto_total_pendiente: number;
  monto_total_vencido: number;
  proximos_vencimientos: CuentaPorPagar[];
}

// Filtros para cuentas por pagar
export interface FiltrosCuentasPagar {
  estado?: string;
  prioridad?: string;
  categoria?: string;
  proveedor_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  monto_min?: number;
  monto_max?: number;
  vencimiento_desde?: string;
  vencimiento_hasta?: string;
}

// Estadísticas por proveedor
export interface EstadisticasProveedor {
  proveedor_id: number;
  proveedor_nombre: string;
  total_cuentas: number;
  monto_total: number;
  monto_pendiente: number;
  promedio_dias_pago: number;
  cuentas_vencidas: number;
}

// Plan de pagos
export interface PlanPagos {
  fecha: string;
  cuentas: CuentaPorPagar[];
  monto_total: number;
  prioridad_maxima: string;
}