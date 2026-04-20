import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, switchMap, take, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Esperar a que initializeAuth() termine antes de leer el estado
    return this.authService.initialized$.pipe(
      filter(initialized => initialized === true),  // Bloquearse hasta que sea true
      take(1),
      switchMap(() => this.authService.authState$.pipe(take(1))),
      map(authState => {
        if (authState.isAuthenticated) {
          return true;
        } else {
          // Guardar la URL a la que intentaba acceder
          this.router.navigate(['/login'], {
            queryParams: { returnUrl: state.url }
          });
          return false;
        }
      })
    );
  }
}