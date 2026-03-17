// Modelo de Notificación
export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha: Date;
  icono?: string;
  color?: string;
  link?: string;
  datos?: any;
}

export type TipoNotificacion = 
  | 'venta' 
  | 'pago' 
  | 'vencimiento' 
  | 'stock' 
  | 'caja' 
  | 'sistema'
  | 'alerta';

// Modelo de Mensaje
export interface Mensaje {
  id: number;
  remitente: {
    id: number;
    nombre: string;
    avatar?: string;
  };
  asunto: string;
  mensaje: string;
  leido: boolean;
  fecha: Date;
  importante: boolean;
}

// Tipos para creación
export type CrearNotificacion = Omit<Notificacion, 'id' | 'fecha'>;
export type CrearMensaje = Omit<Mensaje, 'id' | 'fecha'>;
