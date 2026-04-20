import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class TenantService {
    private tenantIdSubject = new BehaviorSubject<string | null>(null);
    public tenantId$ = this.tenantIdSubject.asObservable();

    // Features efectivas del tenant (plan + overrides)
    private featuresSubject = new BehaviorSubject<Record<string, boolean>>({});
    public features$ = this.featuresSubject.asObservable();

    constructor() {
        // Try to restore from storage on init
        const stored = localStorage.getItem('dolvin_tenant_id') || sessionStorage.getItem('dolvin_tenant_id');
        if (stored) {
            this.tenantIdSubject.next(stored);
        }

        // Restore cached features
        const storedFeatures = localStorage.getItem('dolvin_tenant_features');
        if (storedFeatures) {
            try {
                this.featuresSubject.next(JSON.parse(storedFeatures));
            } catch { }
        }
    }

    // Set tenant ID (called from AuthService on login)
    setTenantId(tenantId: string): void {
        this.tenantIdSubject.next(tenantId);
        localStorage.setItem('dolvin_tenant_id', tenantId);
        sessionStorage.setItem('dolvin_tenant_id', tenantId);
    }

    // Set effective features (plan features merged with overrides)
    setFeatures(features: Record<string, boolean>): void {
        this.featuresSubject.next(features);
        localStorage.setItem('dolvin_tenant_features', JSON.stringify(features));
    }

    // Check if a specific feature is enabled for this tenant
    tieneFeature(key: string): boolean {
        return this.featuresSubject.value[key] ?? false;
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
        this.featuresSubject.next({});
        localStorage.removeItem('dolvin_tenant_id');
        localStorage.removeItem('dolvin_tenant_features');
        sessionStorage.removeItem('dolvin_tenant_id');
    }
}

