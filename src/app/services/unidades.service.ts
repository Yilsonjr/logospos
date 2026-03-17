import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { Unidad, CrearUnidad } from '../models/unidades.model';

@Injectable({
    providedIn: 'root'
})
export class UnidadesService {
    private unidadesSubject = new BehaviorSubject<Unidad[]>([]);
    public unidades$ = this.unidadesSubject.asObservable();

    constructor(
        private supabaseService: SupabaseService,
        private tenantService: TenantService
    ) { }

    // Cargar todas las unidades (globales + las del tenant actual)
    async cargarUnidades(): Promise<void> {
        try {
            const tenantId = this.tenantService.tenantId;
            // Traer unidades donde tenant_id es null (globales) o igual al tenant actual
            const orQuery = tenantId ? `tenant_id.is.null,tenant_id.eq.${tenantId}` : `tenant_id.is.null`;

            const { data, error } = await this.supabaseService.client
                .from('unidades')
                .select('*')
                .or(orQuery)
                .order('nombre', { ascending: true });

            if (error) throw error;

            this.unidadesSubject.next(data || []);
        } catch (error) {
            console.error('Error al cargar unidades:', error);
            throw error;
        }
    }

    // Crear una nueva unidad
    async crearUnidad(unidad: CrearUnidad): Promise<Unidad> {
        try {
            const { data, error } = await this.supabaseService.client
                .from('unidades')
                .insert([{
                    ...unidad,
                    tenant_id: this.tenantService.tenantId
                }])
                .select()
                .single();

            if (error) throw error;

            await this.cargarUnidades(); // Recargar lista
            return data;
        } catch (error) {
            console.error('Error al crear unidad:', error);
            throw error;
        }
    }

    // Actualizar una unidad existente
    async actualizarUnidad(id: number, cambios: Partial<CrearUnidad>): Promise<Unidad> {
        try {
            const { data, error } = await this.supabaseService.client
                .from('unidades')
                .update({
                    ...cambios,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            await this.cargarUnidades();
            return data;
        } catch (error) {
            console.error('Error al actualizar unidad:', error);
            throw error;
        }
    }

    // Activar o Desactivar unidad
    async cambiarEstadoUnidad(id: number, activo: boolean): Promise<void> {
        try {
            const { error } = await this.supabaseService.client
                .from('unidades')
                .update({
                    activo,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            await this.cargarUnidades();
        } catch (error) {
            console.error('Error al cambiar estado de unidad:', error);
            throw error;
        }
    }

    // Eliminar unidad de forma permanente (solo si no está en uso)
    async eliminarUnidad(id: number): Promise<void> {
        try {
            const { error } = await this.supabaseService.client
                .from('unidades')
                .delete()
                .eq('id', id);

            if (error) {
                if (error.code === '23503') {
                    throw new Error('No se puede eliminar la unidad porque está siendo usada por algunos productos.');
                }
                throw error;
            }

            await this.cargarUnidades();
        } catch (error) {
            console.error('Error al eliminar unidad:', error);
            throw error;
        }
    }
}
