// Modelo para el encabezado de la venta (alineado con tabla ventas en Supabase)
export interface Venta {
  id?: number;
  numero_venta: string;          // campo real en BD
  /** @deprecated usar numero_venta */
  numero_factura?: string;       // alias para backward-compat con historial/reportes
  cliente_id?: number | null;
  usuario_id?: number;
  caja_id?: number | null;
  subtotal: number;
  descuento: number;
  impuestos: number;             // campo real en BD
  /** @deprecated usar impuestos */
  impuesto?: number;             // alias para backward-compat
  total: number;
  metodo_pago: 'efectivo' | 'tarjeta' | 'credito' | 'transferencia' | 'mixto';
  tipo_venta: 'contado' | 'credito';
  estado: 'completada' | 'cancelada' | 'pendiente';
  notas?: string | null;
  ncf?: string | null;
  tipo_ncf?: string | null;
  rnc_cliente?: string | null;
  nombre_cliente_fiscal?: string | null;
  /** @deprecated usar created_at */
  fecha?: string;                // alias para backward-compat
  /** No existe en DB - solo para cálculos en front */
  monto_efectivo?: number;
  /** No existe en DB - solo para cálculos en front */
  monto_tarjeta?: number;
  /** No existe en DB - solo para cálculos en front */
  monto_transferencia?: number;
  banco_destino?: string | null;
  referencia_transferencia?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Modelo para el detalle de la venta (productos)
export interface VentaDetalle {
  id?: number;
  venta_id?: number;
  producto_id: number;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  created_at?: string;
}

// Modelo para crear una venta completa (con sus detalles)
export interface CrearVenta {
  cliente_id?: number;
  caja_id?: number;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  metodo_pago: 'efectivo' | 'tarjeta' | 'credito' | 'transferencia' | 'mixto';
  monto_efectivo: number;
  monto_tarjeta: number;
  monto_transferencia: number;
  banco_destino?: string;
  referencia_transferencia?: string;
  cambio: number;
  notas?: string;
  ncf?: string;
  tipo_ncf?: string;
  rnc_cliente?: string;
  nombre_cliente_fiscal?: string;
  detalles: Omit<VentaDetalle, 'id' | 'venta_id' | 'created_at'>[];
}

// Modelo para el carrito de compras (frontend)
export interface ItemCarrito {
  producto_id: number;
  producto_nombre: string;
  precio_unitario: number;
  cantidad: number;
  descuento: number;
  subtotal: number;
  stock_disponible: number;
  categoria?: string;
  imagen_url?: string;
}

// Modelo para venta con información completa (para mostrar)
export interface VentaCompleta extends Venta {
  cliente_nombre?: string;
  detalles: VentaDetalle[];
}

// Métodos de pago disponibles
export const METODOS_PAGO = [
  { valor: 'efectivo', etiqueta: 'Efectivo', icono: 'fa-solid fa-money-bill-wave' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta', icono: 'fa-solid fa-credit-card' },
  { valor: 'transferencia', etiqueta: 'Transferencia', icono: 'fa-solid fa-building-columns' },
  { valor: 'credito', etiqueta: 'Crédito', icono: 'fa-solid fa-file-invoice-dollar' },
  { valor: 'mixto', etiqueta: 'Mixto', icono: 'fa-solid fa-wallet' }
] as const;

// Estados de venta
export const ESTADOS_VENTA = [
  { valor: 'completada', etiqueta: 'Completada', color: 'green' },
  { valor: 'cancelada', etiqueta: 'Cancelada', color: 'red' },
  { valor: 'pendiente', etiqueta: 'Pendiente', color: 'yellow' }
] as const;
