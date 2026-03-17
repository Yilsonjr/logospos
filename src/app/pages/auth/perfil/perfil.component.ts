import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { Usuario, Sesion } from '../../../models/usuario.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit, OnDestroy {
  usuario: Usuario | null = null;
  sesionesActivas: Sesion[] = [];
  
  // Formulario de cambio de contraseña
  cambioContrasena = {
    actual: '',
    nueva: '',
    confirmar: ''
  };
  
  // Estados
  isLoading = false;
  mostrarCambioContrasena = false;
  subscriptions: Subscription[] = [];

  constructor(private authService: AuthService) {}

  async ngOnInit() {
    // Suscribirse al estado de autenticación
    const authSub = this.authService.authState$.subscribe(authState => {
      this.usuario = authState.usuario;
    });
    this.subscriptions.push(authSub);

    // Cargar sesiones activas
    await this.cargarSesionesActivas();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarSesionesActivas() {
    try {
      this.sesionesActivas = await this.authService.obtenerSesionesActivas();
    } catch (error) {
      console.error('Error al cargar sesiones:', error);
    }
  }

  // ==================== CAMBIO DE CONTRASEÑA ====================

  toggleCambioContrasena() {
    this.mostrarCambioContrasena = !this.mostrarCambioContrasena;
    if (!this.mostrarCambioContrasena) {
      this.limpiarFormularioContrasena();
    }
  }

  limpiarFormularioContrasena() {
    this.cambioContrasena = {
      actual: '',
      nueva: '',
      confirmar: ''
    };
  }

  async cambiarContrasena() {
    if (!this.validarCambioContrasena()) return;

    this.isLoading = true;
    try {
      await this.authService.cambiarContrasena(
        this.cambioContrasena.actual,
        this.cambioContrasena.nueva
      );
      
      this.limpiarFormularioContrasena();
      this.mostrarCambioContrasena = false;
    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);
      Swal.fire({
        title: '❌ Error',
        text: error.message || 'Error al cambiar la contraseña',
        icon: 'error'
      });
    } finally {
      this.isLoading = false;
    }
  }

  validarCambioContrasena(): boolean {
    if (!this.cambioContrasena.actual.trim()) {
      Swal.fire('⚠️ Campo Requerido', 'Ingresa tu contraseña actual', 'warning');
      return false;
    }
    if (!this.cambioContrasena.nueva.trim()) {
      Swal.fire('⚠️ Campo Requerido', 'Ingresa la nueva contraseña', 'warning');
      return false;
    }
    if (this.cambioContrasena.nueva.length < 6) {
      Swal.fire('⚠️ Contraseña Débil', 'La contraseña debe tener al menos 6 caracteres', 'warning');
      return false;
    }
    if (this.cambioContrasena.nueva !== this.cambioContrasena.confirmar) {
      Swal.fire('⚠️ Contraseñas No Coinciden', 'Las contraseñas no coinciden', 'warning');
      return false;
    }
    if (this.cambioContrasena.actual === this.cambioContrasena.nueva) {
      Swal.fire('⚠️ Misma Contraseña', 'La nueva contraseña debe ser diferente a la actual', 'warning');
      return false;
    }

    return true;
  }

  // ==================== GESTIÓN DE SESIONES ====================

  async cerrarSesion(sesion: Sesion) {
    const result = await Swal.fire({
      title: '¿Cerrar Sesión?',
      text: `¿Estás seguro de cerrar esta sesión?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Cerrar Sesión',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      try {
        await this.authService.cerrarSesion(sesion.id!);
        await this.cargarSesionesActivas();
        
        Swal.fire({
          title: '✅ Sesión Cerrada',
          text: 'La sesión ha sido cerrada exitosamente',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'Error al cerrar la sesión',
          icon: 'error'
        });
      }
    }
  }

  async cerrarTodasLasSesiones() {
    const result = await Swal.fire({
      title: '¿Cerrar Todas las Sesiones?',
      text: 'Se cerrarán todas las demás sesiones activas excepto la actual',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cerrar Todas',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      try {
        await this.authService.cerrarTodasLasSesiones();
        await this.cargarSesionesActivas();
      } catch (error) {
        console.error('Error al cerrar sesiones:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'Error al cerrar las sesiones',
          icon: 'error'
        });
      }
    }
  }

  // ==================== UTILIDADES ====================

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  obtenerIniciales(nombre: string, apellido: string): string {
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  }

  obtenerColorRol(): string {
    return this.usuario?.rol?.color || '#6b7280';
  }

  esTokenActual(token: string): boolean {
    // Comparar con el token actual del usuario
    return false; // Placeholder - implementar lógica real
  }

  obtenerDispositivo(userAgent: string): string {
    if (!userAgent) return 'Desconocido';
    
    if (userAgent.includes('Mobile')) return 'Móvil';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Escritorio';
  }

  obtenerNavegador(userAgent: string): string {
    if (!userAgent) return 'Desconocido';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Otro';
  }
}