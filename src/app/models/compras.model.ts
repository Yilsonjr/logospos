export interface Compra {
  id?: number;
  proveedor_id: number;
  proveedor_nombre?: string; // Para mostrar en la UI
  numero_factura?: string;
  fecha_compra: string;
  fecha_vencimiento?: string;
  subtotal: number;
  impuesto: number;
  descuento: number;
  total: number;
  estado: 'pendiente' | 'pagada' | 'completada' | 'parcial' | 'cancelada';
  metodo_pago?: string;
  ncf?: string;
  tipo_ncf?: string;
  notas?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DetalleCompra {
  id?: number;
  compra_id: number;
  producto_id: number;
  producto_nombre?: string; // Para mostrar en la UI
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  created_at?: string;
}

export interface CompraConDetalles extends Compra {
  detalles: DetalleCompra[];
}

// Tipo para crear una nueva compra
export type CrearCompra = Omit<Compra, 'id' | 'created_at' | 'updated_at'>;

// Tipo para crear un detalle de compra
export type CrearDetalleCompra = Omit<DetalleCompra, 'id' | 'created_at'>;

// Estados de compra
export const ESTADOS_COMPRA = [
  { valor: 'pendiente', etiqueta: 'Pendiente', color: 'orange' },
  { valor: 'pagada', etiqueta: 'Pagada', color: 'green' },
  { valor: 'parcial', etiqueta: 'Pago Parcial', color: 'blue' },
  { valor: 'cancelada', etiqueta: 'Cancelada', color: 'red' }
] as const;

// Métodos de pago
export const METODOS_PAGO = [
  'Efectivo',
  'Transferencia',
  'Cheque',
  'Tarjeta de Crédito',
  'Tarjeta de Débito',
  'Crédito'
] as const;
