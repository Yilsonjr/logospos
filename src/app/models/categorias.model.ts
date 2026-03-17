// Modelo para definir la estructura de una categoría
export interface Categoria {
  id?: number;              // ? significa opcional (se genera automáticamente en BD)
  nombre: string;           // Requerido: nombre de la categoría
  descripcion?: string;     // Opcional: descripción adicional
  color: string;           // Color para el badge (hex: #ff0000)
  activo: boolean;         // Si la categoría está activa o no
  created_at?: string;     // Fecha de creación (automática)
  updated_at?: string;     // Fecha de actualización (automática)
}

// Tipo para crear categoría (sin campos automáticos)
export type CrearCategoria = Omit<Categoria, 'id' | 'created_at' | 'updated_at'>;

// Tipo para actualizar categoría (todos los campos opcionales excepto id)
export type ActualizarCategoria = Partial<Categoria> & { id: number };