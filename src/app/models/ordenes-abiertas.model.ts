import { ItemCarrito } from './ventas.model';
import { Cliente } from './clientes.model';

/** Tipo de orden: libre o asociada a una mesa */
export type TipoOrden = 'orden' | 'mesa';

/** Estado del ciclo de vida de la orden */
export type EstadoOrden = 'abierta' | 'cobrada' | 'cancelada';

/** Colores disponibles para los tabs de órdenes */
export const COLORES_ORDEN = [
    '#3b82f6', // azul
    '#10b981', // verde
    '#f59e0b', // amarillo
    '#ef4444', // rojo
    '#8b5cf6', // violeta
    '#06b6d4', // cyan
    '#f97316', // naranja
    '#ec4899', // rosa
];

/** Modelo completo de una Orden Abierta */
export interface OrdenAbierta {
    id: string;              // UUID de Supabase
    tenant_id: string;
    sucursal_id?: number;
    caja_id?: number;
    usuario_id?: number;
    cliente_id?: number;

    nombre: string;          // "Mesa 3", "Juan Pérez", "Orden #4"
    tipo: TipoOrden;
    color: string;

    items: ItemCarrito[];    // JSONB en BD, tipado aquí
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;

    estado: EstadoOrden;
    notas?: string;

    created_at?: string;
    updated_at?: string;

    // Datos relacionales (join, no almacenados en BD)
    cliente?: Pick<Cliente, 'id' | 'nombre' | 'rnc'>;
}

/** Payload para crear una nueva orden */
export interface CrearOrdenAbierta {
    nombre: string;
    tipo: TipoOrden;
    color?: string;
    caja_id?: number;
    sucursal_id?: number;
    cliente_id?: number;
    notas?: string;
}
