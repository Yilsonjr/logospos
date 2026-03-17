import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { TopbarComponent } from './shared/topbar/topbar.component';
import { AuthService } from './services/auth.service';
import { SidebarService } from './services/sidebar.service';
import { BootstrapService } from './services/bootstrap.service';
import { NotificacionesAutoService } from './services/notificaciones-auto.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, NavbarComponent, TopbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('dolvinPOS');
  isAuthenticated = false;
  isInitializing = true;
  sidebarCollapsed = false;

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private bootstrapService: BootstrapService,
    private notificacionesAutoService: NotificacionesAutoService,
    private router: Router
  ) { }

  async ngOnInit() {
    console.log('🚀 Iniciando aplicación DolvinPOS...');

    // 1. Configurar suscripción al estado de autenticación
    this.authService.authState$.subscribe(authState => {
      this.isAuthenticated = authState.isAuthenticated;
    });

    // 2. Configurar suscripción al estado del sidebar
    this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });

    // 3. Terminar carga inmediatamente
    this.isInitializing = false;

    // 4. Redirigir al login si no está autenticado
    if (!this.isAuthenticated && !this.router.url.includes('/login')) {
      this.router.navigate(['/login']);
    }

    // 5. Inicializar sistema en segundo plano (sin bloquear)
    this.inicializarEnSegundoPlano();
  }

  private inicializarEnSegundoPlano(): void {
    // Ejecutar después de que la UI esté lista
    setTimeout(async () => {
      try {
        console.log('🔄 Inicializando sistema en segundo plano...');
        await this.bootstrapService.inicializarSistema();
        console.log('✅ Sistema inicializado');
        console.log('🔔 Notificaciones automáticas activadas');
      } catch (error) {
        console.log('⚠️ Error en inicialización:', error);
      }
    }, 2000);
  }
}
