export type TipoMovimientoInventario = 'entrada' | 'salida' | 'venta' | 'compra' | 'transferencia' | 'ajuste';

export interface MovimientoInventario {
    id?: number;
    tenant_id: string;
    sucursal_id: number;
    producto_id: number;
    tipo_movimiento: TipoMovimientoInventario;
    cantidad: number;
    balance_anterior: number;
    balance_nuevo: number;
    referencia_id?: string;
    usuario_id?: number;
    notas?: string;
    created_at?: string;
    
    // Joins
    usuario_nombre?: string;
    producto_nombre?: string;
}
