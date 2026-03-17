
export interface Productos {
    id?: number;
    nombre: string;
    categoria: string;
    precio_compra: number;
    precio_venta: number;
    stock: number;
    sku?: string;
    codigo_barras?: string;
    stock_minimo?: number;
    unidad?: string;         // 'Unidad', 'Caja', 'Botella', etc.
    imagen_url?: string;         // URL de la imagen en Supabase Storage
    imagen_nombre?: string;      // Nombre del archivo
    created_at?: string;
    updated_at?: string;
}