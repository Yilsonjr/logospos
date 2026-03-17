import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notificacion, Mensaje, CrearNotificacion, CrearMensaje } from '../models/notificacion.model';

@Injectable({
  providedIn: 'root'
})
export class NotificacionesService {

  // Observables para notificaciones y mensajes
  private notificacionesSubject = new BehaviorSubject<Notificacion[]>([]);
  public notificaciones$ = this.notificacionesSubject.asObservable();

  private mensajesSubject = new BehaviorSubject<Mensaje[]>([]);
  public mensajes$ = this.mensajesSubject.asObservable();

  constructor() {
    // Inicializar sin datos demo
    // this.cargarNotificacionesDemo();
    // this.cargarMensajesDemo();
  }

  // ==================== NOTIFICACIONES ====================

  obtenerNotificaciones(): Notificacion[] {
    return this.notificacionesSubject.value;
  }

  obtenerNotificacionesNoLeidas(): Notificacion[] {
    return this.notificacionesSubject.value.filter(n => !n.leida);
  }

  contarNotificacionesNoLeidas(): number {
    return this.obtenerNotificacionesNoLeidas().length;
  }

  agregarNotificacion(notificacion: CrearNotificacion): void {
    // Evitar duplicados: Si ya existe una notificación no leída con el mismo título, no agregarla
    const existeDuplicada = this.notificacionesSubject.value.some(n =>
      !n.leida && n.titulo === notificacion.titulo && n.tipo === notificacion.tipo
    );

    if (existeDuplicada) {
      return;
    }

    const nuevaNotificacion: Notificacion = {
      ...notificacion,
      id: Date.now(),
      fecha: new Date()
    };

    const notificaciones = [nuevaNotificacion, ...this.notificacionesSubject.value];
    this.notificacionesSubject.next(notificaciones);
  }

  marcarComoLeida(id: number): void {
    const notificaciones = this.notificacionesSubject.value.map(n =>
      n.id === id ? { ...n, leida: true } : n
    );
    this.notificacionesSubject.next(notificaciones);
  }

  marcarTodasComoLeidas(): void {
    const notificaciones = this.notificacionesSubject.value.map(n => ({
      ...n,
      leida: true
    }));
    this.notificacionesSubject.next(notificaciones);
  }

  eliminarNotificacion(id: number): void {
    const notificaciones = this.notificacionesSubject.value.filter(n => n.id !== id);
    this.notificacionesSubject.next(notificaciones);
  }

  limpiarNotificaciones(): void {
    this.notificacionesSubject.next([]);
  }

  // ==================== MENSAJES ====================

  obtenerMensajes(): Mensaje[] {
    return this.mensajesSubject.value;
  }

  obtenerMensajesNoLeidos(): Mensaje[] {
    return this.mensajesSubject.value.filter(m => !m.leido);
  }

  contarMensajesNoLeidos(): number {
    return this.obtenerMensajesNoLeidos().length;
  }

  agregarMensaje(mensaje: CrearMensaje): void {
    const nuevoMensaje: Mensaje = {
      ...mensaje,
      id: Date.now(),
      fecha: new Date()
    };

    const mensajes = [nuevoMensaje, ...this.mensajesSubject.value];
    this.mensajesSubject.next(mensajes);
  }

  marcarMensajeComoLeido(id: number): void {
    const mensajes = this.mensajesSubject.value.map(m =>
      m.id === id ? { ...m, leido: true } : m
    );
    this.mensajesSubject.next(mensajes);
  }

  marcarTodosMensajesComoLeidos(): void {
    const mensajes = this.mensajesSubject.value.map(m => ({
      ...m,
      leido: true
    }));
    this.mensajesSubject.next(mensajes);
  }

  eliminarMensaje(id: number): void {
    const mensajes = this.mensajesSubject.value.filter(m => m.id !== id);
    this.mensajesSubject.next(mensajes);
  }

  limpiarMensajes(): void {
    this.mensajesSubject.next([]);
  }

  // ==================== DATOS DEMO ====================

  private cargarNotificacionesDemo(): void {
    const notificacionesDemo: Notificacion[] = [
      {
        id: 1,
        tipo: 'vencimiento',
        titulo: 'Cuenta por cobrar próxima a vencer',
        mensaje: 'La cuenta de Juan Pérez vence en 2 días ($150.000)',
        leida: false,
        fecha: new Date(Date.now() - 1000 * 60 * 30), // Hace 30 minutos
        icono: 'fa-solid fa-exclamation-triangle',
        color: '#f59e0b',
        link: '/cuentas-cobrar'
      },
      {
        id: 2,
        tipo: 'stock',
        titulo: 'Stock bajo',
        mensaje: '5 productos están por debajo del stock mínimo',
        leida: false,
        fecha: new Date(Date.now() - 1000 * 60 * 60 * 2), // Hace 2 horas
        icono: 'fa-solid fa-box-open',
        color: '#ef4444',
        link: '/inventario'
      },
      {
        id: 3,
        tipo: 'venta',
        titulo: 'Nueva venta registrada',
        mensaje: 'Venta #1234 por $250.000 completada',
        leida: true,
        fecha: new Date(Date.now() - 1000 * 60 * 60 * 5), // Hace 5 horas
        icono: 'fa-solid fa-shopping-cart',
        color: '#10b981',
        link: '/ventas/historial'
      },
      {
        id: 4,
        tipo: 'caja',
        titulo: 'Caja abierta',
        mensaje: 'Caja abierta con monto inicial de $500.000',
        leida: true,
        fecha: new Date(Date.now() - 1000 * 60 * 60 * 8), // Hace 8 horas
        icono: 'fa-solid fa-cash-register',
        color: '#3b82f6',
        link: '/caja'
      }
    ];

    this.notificacionesSubject.next(notificacionesDemo);
  }

  private cargarMensajesDemo(): void {
    const mensajesDemo: Mensaje[] = [
      {
        id: 1,
        remitente: {
          id: 1,
          nombre: 'María González',
          avatar: undefined
        },
        asunto: 'Consulta sobre inventario',
        mensaje: 'Hola, necesito revisar el stock de productos para hacer un pedido...',
        leido: false,
        fecha: new Date(Date.now() - 1000 * 60 * 45), // Hace 45 minutos
        importante: true
      },
      {
        id: 2,
        remitente: {
          id: 2,
          nombre: 'Carlos Rodríguez',
          avatar: undefined
        },
        asunto: 'Reporte de ventas',
        mensaje: 'Te envío el reporte de ventas del mes anterior para revisión...',
        leido: false,
        fecha: new Date(Date.now() - 1000 * 60 * 60 * 3), // Hace 3 horas
        importante: false
      },
      {
        id: 3,
        remitente: {
          id: 3,
          nombre: 'Ana López',
          avatar: undefined
        },
        asunto: 'Actualización de precios',
        mensaje: 'Los precios de los productos han sido actualizados según lo acordado...',
        leido: true,
        fecha: new Date(Date.now() - 1000 * 60 * 60 * 24), // Hace 1 día
        importante: false
      }
    ];

    this.mensajesSubject.next(mensajesDemo);
  }
}
