import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
    providedIn: 'root'
})
export class DevAdminGuard implements CanActivate {

    constructor(
        private authService: AuthService,
        private router: Router
    ) { }

    canActivate(): boolean {
        const usuario = this.authService.usuarioActual;

        if (usuario?.is_dev_admin === true) {
            return true;
        }

        // Not a dev admin — redirect to dashboard
        this.router.navigate(['/dashboard']);
        return false;
    }
}
