import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { ConfiguracionFiscal, SecuenciaNCF, TipoComprobante } from '../models/fiscal.model';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class FiscalService {
    private configSubject = new BehaviorSubject<ConfiguracionFiscal | null>(null);
    public config$ = this.configSubject.asObservable();

    constructor(
        private supabaseService: SupabaseService,
        private tenantService: TenantService
    ) {
        this.cargarConfiguracion();
    }

    // Cargar configuración fiscal
    async cargarConfiguracion() {
        try {
            const tenantId = this.tenantService.tenantId;
            if (!tenantId) return; // No tenant yet (not logged in)

            const { data, error } = await this.supabaseService.client
                .from('configuracion_fiscal')
                .select('*')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (data) {
                this.configSubject.next(data);
            }
        } catch (error) {
            console.error('Error cargando config fiscal:', error);
        }
    }

    // Actualizar configuración
    async actualizarConfiguracion(config: Partial<ConfiguracionFiscal>): Promise<void> {
        try {
            const tenantId = this.tenantService.getTenantIdOrThrow();
            const current = this.configSubject.value;

            const { data, error } = await this.supabaseService.client
                .from('configuracion_fiscal')
                .upsert({
                    ...config,
                    tenant_id: tenantId,
                    id: current?.id || undefined
                })
                .select()
                .single();

            if (error) throw error;
            this.configSubject.next(data);
        } catch (error) {
            console.error('Error actualizando config fiscal:', error);
            throw error;
        }
    }

    // Obtener secuencias NCF
    async obtenerSecuencias(): Promise<SecuenciaNCF[]> {
        const tenantId = this.tenantService.tenantId;
        if (!tenantId) return [];

        const { data, error } = await this.supabaseService.client
            .from('secuencias_ncf')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('tipo_ncf');

        if (error) throw error;
        return data || [];
    }

    // Crear o actualizar secuencia
    async guardarSecuencia(secuencia: Partial<SecuenciaNCF>): Promise<SecuenciaNCF> {
        const tenantId = this.tenantService.getTenantIdOrThrow();

        const { data, error } = await this.supabaseService.client
            .from('secuencias_ncf')
            .upsert({
                ...secuencia,
                tenant_id: tenantId
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Generar siguiente NCF (Llamada a función DB)
    async generarNCF(tipo: string): Promise<string> {
        // Si no está en modo fiscal, retornar vacío o generar ID interno
        if (!this.configSubject.value?.modo_fiscal) {
            return '';
        }

        try {
            const { data, error } = await this.supabaseService.client
                .rpc('obtener_siguiente_ncf', { tipo_solicitado: tipo });

            if (error) throw error;
            // Forzar mayúsculas según estándar NCF dominicano (Bxx...)
            return (data as string).toUpperCase();
        } catch (error) {
            console.error('Error generando NCF:', error);
            throw error;
        }
    }
}
