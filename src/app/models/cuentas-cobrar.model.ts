export interface CuentaPorCobrar {
  id?: number;
  venta_id: number;
  cliente_id: number;
  cliente_nombre?: string; // Para mostrar en UI
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  fecha_venta: string;
  fecha_vencimiento: string;
  estado: 'pendiente' | 'parcial' | 'pagada' | 'vencida';
  notas?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PagoCuenta {
  id?: number;
  cuenta_id: number;
  monto: number;
  metodo_pago: string;
  fecha_pago: string;
  referencia?: string;
  notas?: string;
  created_at?: string;
}

export interface CuentaConPagos extends CuentaPorCobrar {
  pagos: PagoCuenta[];
}

// Tipo para crear una nueva cuenta
export type CrearCuentaPorCobrar = Omit<CuentaPorCobrar, 'id' | 'created_at' | 'updated_at' | 'cliente_nombre'>;

// Tipo para crear un pago
export type CrearPagoCuenta = Omit<PagoCuenta, 'id' | 'created_at'>;

// Estados de cuenta
export const ESTADOS_CUENTA = [
  { valor: 'pendiente', etiqueta: 'Pendiente', color: 'orange' },
  { valor: 'parcial', etiqueta: 'Pago Parcial', color: 'blue' },
  { valor: 'pagada', etiqueta: 'Pagada', color: 'green' },
  { valor: 'vencida', etiqueta: 'Vencida', color: 'red' }
] as const;

// Métodos de pago
export const METODOS_PAGO_CUENTA = [
  'Efectivo',
  'Transferencia',
  'Cheque',
  'Tarjeta de Crédito',
  'Tarjeta de Débito',
  'Depósito'
] as const;
