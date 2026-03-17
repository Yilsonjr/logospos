export interface Usuario {
  id?: number;
  nombre: string;
  apellido: string;
  email: string;
  username: string;
  password?: string; // Solo para creación/actualización
  telefono?: string;
  avatar?: string;
  rol_id: number;
  rol?: Rol; // Para mostrar en UI
  tenant_id?: string;
  activo: boolean;
  is_dev_admin?: boolean;
  ultimo_acceso?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Rol {
  id?: number;
  nombre: string;
  descripcion: string;
  permisos: string[]; // Array de permisos como JSON
  color: string; // Color para mostrar en UI
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Sesion {
  id?: number;
  usuario_id: number;
  token: string;
  fecha_inicio: string;
  fecha_expiracion: string;
  ip_address?: string;
  user_agent?: string;
  activa: boolean;
}

// Tipos para crear/actualizar
export type CrearUsuario = Omit<Usuario, 'id' | 'created_at' | 'updated_at' | 'rol' | 'ultimo_acceso'>;
export type ActualizarUsuario = Partial<Omit<Usuario, 'id' | 'created_at' | 'updated_at' | 'rol'>>;
export type CrearRol = Omit<Rol, 'id' | 'created_at' | 'updated_at'>;

// Permisos del sistema
export const PERMISOS_SISTEMA = {
  // Dashboard
  'dashboard.ver': 'Ver Dashboard',

  // Inventario
  'inventario.ver': 'Ver Inventario',
  'inventario.crear': 'Crear Productos',
  'inventario.editar': 'Editar Productos',
  'inventario.eliminar': 'Eliminar Productos',
  'inventario.exportar': 'Exportar Inventario',

  // Proveedores
  'proveedores.ver': 'Ver Proveedores',
  'proveedores.crear': 'Crear Proveedores',
  'proveedores.editar': 'Editar Proveedores',
  'proveedores.eliminar': 'Eliminar Proveedores',

  // Clientes
  'clientes.ver': 'Ver Clientes',
  'clientes.crear': 'Crear Clientes',
  'clientes.editar': 'Editar Clientes',
  'clientes.eliminar': 'Eliminar Clientes',

  // Ventas
  'ventas.ver': 'Ver Ventas',
  'ventas.crear': 'Realizar Ventas',
  'ventas.cancelar': 'Cancelar Ventas',
  'ventas.historial': 'Ver Historial de Ventas',
  'ventas.exportar': 'Exportar Ventas',

  // Caja
  'caja.ver': 'Ver Caja',
  'caja.abrir': 'Abrir Caja',
  'caja.cerrar': 'Cerrar Caja',
  'caja.movimientos': 'Gestionar Movimientos',
  'caja.arqueo': 'Realizar Arqueo',
  'caja.historial': 'Ver Historial de Caja',

  // Cuentas por Cobrar
  'cuentas.ver': 'Ver Cuentas por Cobrar',
  'cuentas.pagos': 'Registrar Pagos',
  'cuentas.recordatorios': 'Gestionar Recordatorios',
  'cuentas.exportar': 'Exportar Cuentas',

  // Usuarios y Roles
  'usuarios.ver': 'Ver Usuarios',
  'usuarios.crear': 'Crear Usuarios',
  'usuarios.editar': 'Editar Usuarios',
  'usuarios.eliminar': 'Eliminar Usuarios',
  'roles.ver': 'Ver Roles',
  'roles.crear': 'Crear Roles',
  'roles.editar': 'Editar Roles',
  'roles.eliminar': 'Eliminar Roles',

  // Reportes
  'reportes.ventas': 'Reportes de Ventas',
  'reportes.inventario': 'Reportes de Inventario',
  'reportes.caja': 'Reportes de Caja',
  'reportes.clientes': 'Reportes de Clientes',

  // Configuración
  'config.general': 'Configuración General',
  'config.backup': 'Backup y Restauración',
  'config.logs': 'Ver Logs del Sistema'
} as const;

// Roles predefinidos
export const ROLES_PREDEFINIDOS = [
  {
    nombre: 'Super Administrador',
    descripcion: 'Acceso completo al sistema',
    color: '#dc2626', // red-600
    permisos: Object.keys(PERMISOS_SISTEMA),
    activo: true
  },
  {
    nombre: 'Administrador',
    descripcion: 'Gestión completa excepto usuarios y configuración',
    color: '#ea580c', // orange-600
    permisos: [
      'dashboard.ver',
      'inventario.ver', 'inventario.crear', 'inventario.editar', 'inventario.exportar',
      'proveedores.ver', 'proveedores.crear', 'proveedores.editar',
      'clientes.ver', 'clientes.crear', 'clientes.editar',
      'ventas.ver', 'ventas.crear', 'ventas.cancelar', 'ventas.historial', 'ventas.exportar',
      'caja.ver', 'caja.abrir', 'caja.cerrar', 'caja.movimientos', 'caja.arqueo', 'caja.historial',
      'cuentas.ver', 'cuentas.crear', 'cuentas.editar', 'cuentas.eliminar', 'cuentas.pagos', 'cuentas.recordatorios', 'cuentas.exportar',
      'reportes.ventas', 'reportes.inventario', 'reportes.caja', 'reportes.clientes'
    ],
    activo: true
  },
  {
    nombre: 'Cajero',
    descripcion: 'Operaciones de caja y ventas',
    color: '#2563eb', // blue-600
    permisos: [
      'dashboard.ver',
      'inventario.ver',
      'clientes.ver', 'clientes.crear',
      'ventas.ver', 'ventas.crear', 'ventas.historial',
      'caja.ver', 'caja.abrir', 'caja.cerrar', 'caja.movimientos', 'caja.arqueo',
      'cuentas.ver', 'cuentas.pagos'
    ],
    activo: true
  },
  {
    nombre: 'Vendedor',
    descripcion: 'Solo ventas y consultas básicas',
    color: '#16a34a', // green-600
    permisos: [
      'dashboard.ver',
      'inventario.ver',
      'clientes.ver', 'clientes.crear',
      'ventas.ver', 'ventas.crear',
      'cuentas.ver'
    ],
    activo: true
  },
  {
    nombre: 'Solo Lectura',
    descripcion: 'Solo consultas, sin modificaciones',
    color: '#6b7280', // gray-500
    permisos: [
      'dashboard.ver',
      'inventario.ver',
      'clientes.ver',
      'ventas.ver', 'ventas.historial',
      'caja.ver', 'caja.historial',
      'cuentas.ver'
    ],
    activo: true
  }
] as const;

// Datos de login
export interface LoginCredentials {
  username: string;
  password: string;
  recordar?: boolean;
}

export interface LoginResponse {
  usuario: Usuario;
  token: string;
  expiracion: string;
}

// Estado de autenticación
export interface AuthState {
  isAuthenticated: boolean;
  usuario: Usuario | null;
  token: string | null;
  permisos: string[];
}