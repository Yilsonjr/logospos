export interface Unidad {
    id: number;
    tenant_id?: string;
    nombre: string;
    abreviatura?: string;
    activo: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CrearUnidad {
    nombre: string;
    abreviatura?: string;
    activo?: boolean;
}
