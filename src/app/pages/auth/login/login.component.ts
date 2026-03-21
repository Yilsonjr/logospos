import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { LoginCredentials } from '../../../models/usuario.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  credentials: LoginCredentials = {
    username: '',
    password: '',
    recordar: false
  };

  isLoading = false;
  showPassword = false;
  hasError = false;

  // Imágenes de fondo dinámicas
  backgroundImages = [
    'assets/images/LOGOSPOS.jpg',
    'assets/images/LOGOSPOS.jpg',
  ];
  currentBackground = this.backgroundImages[0];

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.rotateBackground();
  }

  rotateBackground() {
    const randomIndex = Math.floor(Math.random() * this.backgroundImages.length);
    this.currentBackground = this.backgroundImages[randomIndex];
  }

  ngOnInit() {
    // Si ya está autenticado, redirigir al dashboard
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/dashboard']);
    }
  }

  async onSubmit() {
    this.hasError = false;

    if (!this.credentials.username.trim() || !this.credentials.password.trim()) {
      this.hasError = true;

      // Trigger shake animation
      setTimeout(() => this.hasError = false, 600);

      await Swal.fire({
        title: '⚠️ Campos Requeridos',
        text: 'Por favor ingresa tu usuario y contraseña',
        icon: 'warning',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    this.isLoading = true;

    try {
      await this.authService.login(this.credentials);

      await Swal.fire({
        title: '✅ Bienvenido',
        text: 'Has iniciado sesión exitosamente',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });

      this.router.navigate(['/dashboard']);

    } catch (error: any) {
      // Resetear el estado de loading ANTES de mostrar el error
      this.isLoading = false;
      this.hasError = true;

      // Forzar detección de cambios para actualizar la UI inmediatamente
      this.cdr.detectChanges();

      // Remove error state after animation
      setTimeout(() => this.hasError = false, 600);

      await Swal.fire({
        title: '❌ Error de Acceso',
        text: error.message || 'Credenciales incorrectas',
        icon: 'error',
        confirmButtonText: 'Intentar de Nuevo',
        confirmButtonColor: '#ef4444'
      });
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async forgotPassword(event: Event) {
    event.preventDefault();
    await Swal.fire({
      title: '¿Olvidaste tu contraseña?',
      text: 'Por seguridad, debes contactar al administrador de tu negocio o a nuestro soporte técnico para restablecer tu acceso.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Contactar Soporte',
      cancelButtonText: 'Entendido',
      confirmButtonColor: '#3b82f6'
    }).then((result) => {
      if (result.isConfirmed) {
        this.contactSupport();
      }
    });
  }

  contactSupport() {
    const message = encodeURIComponent('Hola, necesito soporte con mi acceso a LogosPOS.');
    const whatsappUrl = `https://wa.me/18293888840?text=${message}`;
    window.open(whatsappUrl, '_blank');
  }
}