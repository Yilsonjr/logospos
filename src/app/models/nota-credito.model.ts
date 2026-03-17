export interface NotaCredito {
    id?: number;
    tenant_id?: string;
    venta_id: number;
    ncf_nota?: string;
    ncf_original?: string;
    cliente_id?: number;
    cliente_nombre?: string;
    motivo: string;
    total: number;
    estado: 'activa' | 'anulada';
    created_at?: string;
    detalles?: NotaCreditoDetalle[];
}

export interface NotaCreditoDetalle {
    id?: number;
    nota_credito_id?: number;
    producto_id?: number;
    producto_nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
}

export interface CrearNotaCredito {
    venta_id: number;
    motivo: string;
    detalles: {
        producto_id?: number;
        producto_nombre: string;
        cantidad: number;
        precio_unitario: number;
        subtotal: number;
    }[];
}

export const MOTIVOS_NOTA_CREDITO = [
    'Devolución de mercancía en buen estado',
    'Producto defectuoso',
    'Error en precio',
    'Error en facturación',
    'Descuento aplicado',
    'Otro'
] as const;
