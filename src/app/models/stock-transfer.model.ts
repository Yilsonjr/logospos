export type StockTransferEstado = 'enviado' | 'recibido' | 'cancelado';

export interface TransferenciaStock {
    id?: number;
    tenant_id: string;
    sucursal_origen_id: number;
    sucursal_destino_id: number;
    usuario_id: number;
    estado: StockTransferEstado;
    notas?: string;
    fecha_envio?: string;
    fecha_recibido?: string;
    created_at?: string;
    
    // Virtuales / Joins
    sucursal_origen_nombre?: string;
    sucursal_destino_nombre?: string;
    usuario_nombre?: string;
    detalles?: DetalleTransferenciaStock[];
}

export interface DetalleTransferenciaStock {
    id?: number;
    transferencia_id: number;
    producto_id: number;
    cantidad: number;
    
    // Virtuales / Joins
    producto_nombre?: string;
}
