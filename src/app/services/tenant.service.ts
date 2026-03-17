import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class TenantService {
    private tenantIdSubject = new BehaviorSubject<string | null>(null);
    public tenantId$ = this.tenantIdSubject.asObservable();

    constructor() {
        // Try to restore from storage on init
        const stored = localStorage.getItem('dolvin_tenant_id') || sessionStorage.getItem('dolvin_tenant_id');
        if (stored) {
            this.tenantIdSubject.next(stored);
        }
    }

    // Set tenant ID (called from AuthService on login)
    setTenantId(tenantId: string): void {
        this.tenantIdSubject.next(tenantId);
        localStorage.setItem('dolvin_tenant_id', tenantId);
        sessionStorage.setItem('dolvin_tenant_id', tenantId);
    }

    // Get current tenant ID (synchronous)
    get tenantId(): string | null {
        return this.tenantIdSubject.value;
    }

    // Get tenant ID or throw (use in services that require it)
    getTenantIdOrThrow(): string {
        const id = this.tenantIdSubject.value;
        if (!id) {
            throw new Error('No hay tenant configurado. Inicie sesión nuevamente.');
        }
        return id;
    }

    // Clear tenant (called on logout)
    clear(): void {
        this.tenantIdSubject.next(null);
        localStorage.removeItem('dolvin_tenant_id');
        sessionStorage.removeItem('dolvin_tenant_id');
    }
}
