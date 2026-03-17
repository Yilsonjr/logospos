// Modelo para definir la estructura de un cliente
export interface Cliente {
  id?: number;
  nombre: string;
  cedula?: string;              // Cédula/DNI/Identificación
  rnc?: string;                 // RNC para clientes empresariales
  telefono?: string;
  email?: string;
  direccion?: string;
  tipo_cliente: 'regular' | 'mayorista' | 'vip';
  limite_credito: number;       // Límite de crédito permitido
  balance_pendiente: number;    // Deuda actual
  descuento_porcentaje: number; // Descuento automático (0-100)
  notas?: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

// Tipo para crear cliente (sin campos automáticos)
export type CrearCliente = Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'balance_pendiente'>;

// Tipo para actualizar cliente (todos los campos opcionales excepto id)
export type ActualizarCliente = Partial<Cliente> & { id: number };

// Tipos de cliente disponibles
export const TIPOS_CLIENTE = [
  { valor: 'regular', etiqueta: 'Regular', descripcion: 'Cliente regular sin descuentos' },
  { valor: 'mayorista', etiqueta: 'Mayorista', descripcion: 'Cliente con compras al por mayor' },
  { valor: 'vip', etiqueta: 'VIP', descripcion: 'Cliente preferencial con beneficios' }
] as const;
