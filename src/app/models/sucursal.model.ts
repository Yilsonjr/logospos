export interface Sucursal {
    id?: number;
    tenant_id?: string;
    nombre: string;
    direccion?: string;
    telefono?: string;
    activa: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface StockSucursal {
    id?: number;
    tenant_id?: string;
    sucursal_id: number;
    producto_id: number;
    cantidad: number;
    stock_minimo?: number;
    precio_venta_override?: number | null;
    created_at?: string;
    updated_at?: string;
    
    // Virtual fields (joined from productos)
    producto_nombre?: string;
    producto_precio_venta?: number;
}

export type CrearSucursal = Omit<Sucursal, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>;
export type ActualizarSucursal = Partial<CrearSucursal>;
