export interface Proveedor {
  id?: number;
  nombre: string;
  documento?: string; // Antes rnc
  tipo_documento?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  pais?: string;
  contacto?: string;
  activo: boolean; // Not null in schema
  created_at?: string;
  updated_at?: string;
}

// Tipo para crear un nuevo proveedor (sin id, created_at, updated_at)
export type CrearProveedor = Omit<Proveedor, 'id' | 'created_at' | 'updated_at'>;
