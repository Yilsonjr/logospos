import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { NotificacionesService } from '../../services/notificaciones.service';
import { Usuario } from '../../models/usuario.model';
import { Notificacion, Mensaje } from '../../models/notificacion.model';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule, RouterModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css',
})
export class TopbarComponent implements OnInit, OnDestroy {
  usuario: Usuario | null = null;
  notificaciones: Notificacion[] = [];
  sidebarCollapsed = false;

  mostrarNotificaciones = false;

  subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private notificacionesService: NotificacionesService,
    private router: Router
  ) { }

  ngOnInit() {
    // Suscribirse al usuario
    const authSub = this.authService.authState$.subscribe(authState => {
      this.usuario = authState.usuario;
    });
    this.subscriptions.push(authSub);

    // Suscribirse al estado del sidebar
    const sidebarSub = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });
    this.subscriptions.push(sidebarSub);

    // Suscribirse a notificaciones
    const notifSub = this.notificacionesService.notificaciones$.subscribe(notificaciones => {
      this.notificaciones = notificaciones;
    });
    this.subscriptions.push(notifSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ==================== SIDEBAR ====================
  toggleSidebar() {
    this.sidebarService.toggleSidebar();
  }

  // ==================== NOTIFICACIONES ====================

  get contadorNotificaciones(): number {
    return this.notificacionesService.contarNotificacionesNoLeidas();
  }

  toggleNotificaciones() {
    this.mostrarNotificaciones = !this.mostrarNotificaciones;
  }

  marcarNotificacionLeida(notificacion: Notificacion, event: Event) {
    event.stopPropagation();
    this.notificacionesService.marcarComoLeida(notificacion.id);

    // Si tiene link, navegar
    if (notificacion.link) {
      this.router.navigate([notificacion.link]);
      this.mostrarNotificaciones = false;
    }
  }

  marcarTodasNotificacionesLeidas() {
    this.notificacionesService.marcarTodasComoLeidas();
  }

  eliminarNotificacion(id: number, event: Event) {
    event.stopPropagation();
    this.notificacionesService.eliminarNotificacion(id);
  }

  limpiarNotificaciones() {
    this.notificacionesService.limpiarNotificaciones();
    this.mostrarNotificaciones = false;
  }

  // ==================== UTILIDADES ====================

  obtenerTiempoRelativo(fecha: Date): string {
    const ahora = new Date();
    const diferencia = ahora.getTime() - new Date(fecha).getTime();

    const minutos = Math.floor(diferencia / (1000 * 60));
    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));

    if (minutos < 1) return 'Ahora';
    if (minutos < 60) return `Hace ${minutos} min`;
    if (horas < 24) return `Hace ${horas} h`;
    if (dias === 1) return 'Ayer';
    return `Hace ${dias} días`;
  }

  obtenerInicialesRemitente(nombre: string): string {
    const palabras = nombre.split(' ');
    if (palabras.length >= 2) {
      return `${palabras[0].charAt(0)}${palabras[1].charAt(0)}`.toUpperCase();
    }
    return nombre.substring(0, 2).toUpperCase();
  }

  cerrarDropdowns() {
    this.mostrarNotificaciones = false;
  }

  // Ir al perfil
  irAPerfil() {
    this.router.navigate(['/perfil']);
    this.cerrarDropdowns();
  }

  // Cerrar sesión
  async cerrarSesion() {
    this.cerrarDropdowns();
    await this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  // Obtener iniciales del usuario
  obtenerIniciales(): string {
    if (!this.usuario) return 'U';
    return `${this.usuario.nombre.charAt(0)}${this.usuario.apellido.charAt(0)}`.toUpperCase();
  }

  // Obtener color del rol
  obtenerColorRol(): string {
    return this.usuario?.rol?.color || '#3b82f6';
  }
}
