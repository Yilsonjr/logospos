import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
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
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    const requiredPermissions = route.data['permissions'] as string[];
    const requireAll = route.data['requireAll'] as boolean || false;

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    return this.authService.authState$.pipe(
      take(1),
      map(authState => {
        if (!authState.isAuthenticated) {
          this.router.navigate(['/login']);
          return false;
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
          
          // Redirigir al dashboard
          this.router.navigate(['/dashboard']);
          return false;
        }

        return true;
      })
    );
  }
}