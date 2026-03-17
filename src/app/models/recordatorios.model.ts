export interface Recordatorio {
  id?: number;
  cuenta_id: number;
  cliente_id: number;
  cliente_nombre?: string;
  tipo: 'vencimiento' | 'seguimiento' | 'manual';
  mensaje: string;
  fecha_programada: string;
  fecha_enviado?: string;
  estado: 'pendiente' | 'enviado' | 'fallido' | 'cancelado';
  canal: 'whatsapp' | 'email' | 'sms' | 'llamada';
  telefono?: string;
  email?: string;
  notas?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CrearRecordatorio extends Omit<Recordatorio, 'id' | 'created_at' | 'updated_at' | 'cliente_nombre'> {}

export const TIPOS_RECORDATORIO = [
  { valor: 'vencimiento', etiqueta: 'Vencimiento', icono: 'fa-clock', color: 'orange' },
  { valor: 'seguimiento', etiqueta: 'Seguimiento', icono: 'fa-phone', color: 'blue' },
  { valor: 'manual', etiqueta: 'Manual', icono: 'fa-user', color: 'purple' }
] as const;

export const CANALES_RECORDATORIO = [
  { valor: 'whatsapp', etiqueta: 'WhatsApp', icono: 'fa-whatsapp', color: 'green' },
  { valor: 'email', etiqueta: 'Email', icono: 'fa-envelope', color: 'blue' },
  { valor: 'sms', etiqueta: 'SMS', icono: 'fa-sms', color: 'purple' },
  { valor: 'llamada', etiqueta: 'Llamada', icono: 'fa-phone', color: 'orange' }
] as const;

export const ESTADOS_RECORDATORIO = [
  { valor: 'pendiente', etiqueta: 'Pendiente', color: 'yellow' },
  { valor: 'enviado', etiqueta: 'Enviado', color: 'green' },
  { valor: 'fallido', etiqueta: 'Fallido', color: 'red' },
  { valor: 'cancelado', etiqueta: 'Cancelado', color: 'gray' }
] as const;

// Plantillas de mensajes predefinidas
export const PLANTILLAS_RECORDATORIO = {
  vencimiento_whatsapp: `Hola {cliente}, te recordamos que tienes una cuenta pendiente por {monto} que vence el {fecha_vencimiento}. ¡Gracias por tu preferencia!`,
  vencimiento_email: `Estimado/a {cliente},\n\nTe recordamos que tienes una cuenta pendiente por {monto} que vence el {fecha_vencimiento}.\n\nPuedes realizar tu pago en nuestras instalaciones o contactarnos para coordinar.\n\n¡Gracias por tu preferencia!`,
  seguimiento_whatsapp: `Hola {cliente}, queremos saber si necesitas ayuda con tu cuenta pendiente por {monto}. Estamos aquí para apoyarte.`,
  vencida_whatsapp: `Hola {cliente}, tu cuenta por {monto} venció el {fecha_vencimiento}. Te pedimos ponerte al día lo antes posible. ¡Gracias!`
};