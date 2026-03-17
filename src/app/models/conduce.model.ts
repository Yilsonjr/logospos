// Modelo del Conduce de Salida
export interface Conduce {
    id?: number;
    tenant_id?: string;
    venta_id: number;
    numero_conduce: string;       // C-YYYYMMDD-0001
    cliente_id?: number | null;
    direccion_entrega?: string;
    motorista?: string;           // Nombre de quien entrega
    vehiculo?: string;            // Placa o descripción del vehículo
    estado: 'pendiente' | 'en_camino' | 'entregado' | 'anulado';
    notas?: string;
    fecha_salida?: string;
    fecha_entrega?: string;
    created_at?: string;
    updated_at?: string;
}

// Conduce con datos completos para mostrar e imprimir
export interface ConduceCompleto extends Conduce {
    numero_venta: string;
    cliente_nombre?: string;
    cliente_rnc?: string;
    cliente_telefono?: string;
    items: ConduceItem[];
}

export interface ConduceItem {
    producto_nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    unidad?: string;
}

// Para crear un conduce
export type CrearConduce = Omit<Conduce, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>;

// Estados del conduce
export const ESTADOS_CONDUCE = [
    { valor: 'pendiente', etiqueta: 'Pendiente', color: '#f59e0b', icon: 'fa-clock' },
    { valor: 'en_camino', etiqueta: 'En Camino', color: '#3b82f6', icon: 'fa-truck' },
    { valor: 'entregado', etiqueta: 'Entregado', color: '#10b981', icon: 'fa-circle-check' },
    { valor: 'anulado', etiqueta: 'Anulado', color: '#ef4444', icon: 'fa-ban' }
] as const;
