import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, switchMap, take, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class PermissionGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {

    const requiredPermissions = route.data['permissions'] as string[];
    const requireAll = route.data['requireAll'] as boolean || false;

    // Esperar a que initializeAuth() termine antes de evaluar permisos
    return this.authService.initialized$.pipe(
      filter(initialized => initialized === true),
      take(1),
      switchMap(() => this.authService.authState$.pipe(take(1))),
      map(authState => {
        if (!authState.isAuthenticated) {
          this.router.navigate(['/login']);
          return false;
        }

        if (!requiredPermissions || requiredPermissions.length === 0) {
          return true;
        }

        const hasPermission = requireAll
          ? this.authService.tieneTodosPermisos(requiredPermissions)
          : this.authService.tieneAlgunPermiso(requiredPermissions);

        if (!hasPermission) {
          Swal.fire({
            title: '🚫 Acceso Denegado',
            text: 'No tienes permisos para acceder a esta sección',
            icon: 'error',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ef4444'
          });
          this.router.navigate(['/dashboard']);
          return false;
        }

        return true;
      })
    );
  }
}