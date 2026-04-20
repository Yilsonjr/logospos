import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, switchMap, take, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class FeatureGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const requiredFeature = route.data['feature'] as string;

    // Esperar a que initializeAuth() termine
    return this.authService.initialized$.pipe(
      filter(initialized => initialized === true),
      take(1),
      switchMap(() => this.authService.authState$.pipe(take(1))),
      map(authState => {
        if (!authState.isAuthenticated) {
          this.router.navigate(['/login']);
          return false;
        }

        // Los dev admins siempre tienen acceso
        if (authState.usuario?.is_dev_admin) {
          return true;
        }

        // Si no se requiere feature específica, permitir
        if (!requiredFeature) {
          return true;
        }

        const habilitado = this.tenantService.tieneFeature(requiredFeature);

        if (!habilitado) {
          Swal.fire({
            title: '🔒 Módulo no disponible',
            text: 'Este módulo no está habilitado para tu plan. Contacta al administrador del sistema.',
            icon: 'warning',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#f59e0b'
          });
          this.router.navigate(['/dashboard']);
          return false;
        }

        return true;
      })
    );
  }
}
