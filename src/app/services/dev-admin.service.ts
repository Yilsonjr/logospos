import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { BehaviorSubject } from 'rxjs';
import bcrypt from 'bcryptjs';

export interface Tenant {
    id: string;
    nombre: string;
    rnc?: string;
    email?: string;
    telefono?: string;
    direccion?: string;
    logo_url?: string;
    plan_slug: string;
    estado: 'activo' | 'suspendido' | 'vencido';
    created_at?: string;
    updated_at?: string;
    // Joined data
    plan_nombre?: string;
    total_usuarios?: number;
    total_productos?: number;
}

export interface Plan {
    slug: string;
    nombre: string;
    precio: number;
    intervalo: string;
    max_usuarios?: number;
    max_productos?: number;
    features: Record<string, boolean>;
    activo: boolean;
}

export interface Subscripcion {
    id: string;
    tenant_id: string;
    plan_slug: string;
    fecha_inicio: string;
    fecha_fin?: string;
    estado: 'activa' | 'cancelada' | 'vencida';
    metodo_pago?: string;
    monto_pagado?: number;
    created_at?: string;
}

export interface CrearTenantPayload {
    nombre: string;
    rnc?: string;
    email?: string;
    telefono?: string;
    direccion?: string;
    plan_slug: string;
    // First admin user for this tenant
    admin_nombre: string;
    admin_apellido: string;
    admin_email: string;
    admin_username: string;
    admin_password: string;
}

@Injectable({
    providedIn: 'root'
})
export class DevAdminService {
    private tenantsSubject = new BehaviorSubject<Tenant[]>([]);
    public tenants$ = this.tenantsSubject.asObservable();

    private planesSubject = new BehaviorSubject<Plan[]>([]);
    public planes$ = this.planesSubject.asObservable();

    constructor(
        private supabaseService: SupabaseService,
        private tenantService: TenantService
    ) { }

    // ==================== TENANTS ====================

    async cargarTenants(): Promise<void> {
        try {
            const { data, error } = await this.supabaseService.client
                .from('tenants')
                .select(`
          *,
          planes (nombre)
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const tenants = (data || []).map((t: any) => ({
                ...t,
                plan_nombre: t.planes?.nombre || t.plan_slug
            }));

            this.tenantsSubject.next(tenants);
        } catch (error) {
            console.error('Error al cargar tenants:', error);
            throw error;
        }
    }

    async obtenerTenant(tenantId: string): Promise<Tenant | null> {
        try {
            const { data, error } = await this.supabaseService.client
                .from('tenants')
                .select(`
          *,
          planes (nombre, precio, features)
        `)
                .eq('id', tenantId)
                .single();

            if (error) throw error;

            // Get counts
            const [usuarios, productos] = await Promise.all([
                this.supabaseService.client
                    .from('usuarios')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId),
                this.supabaseService.client
                    .from('productos')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
            ]);

            return {
                ...data,
                plan_nombre: data.planes?.nombre || data.plan_slug,
                total_usuarios: usuarios.count || 0,
                total_productos: productos.count || 0
            };
        } catch (error) {
            console.error('Error al obtener tenant:', error);
            return null;
        }
    }

    async crearTenant(payload: CrearTenantPayload): Promise<Tenant> {
        try {
            console.log('🔄 Creando tenant:', payload.nombre);

            // 1. Create tenant
            const { data: tenant, error: errorTenant } = await this.supabaseService.client
                .from('tenants')
                .insert([{
                    nombre: payload.nombre,
                    rnc: payload.rnc || null,
                    email: payload.email || null,
                    telefono: payload.telefono || null,
                    direccion: payload.direccion || null,
                    plan_slug: payload.plan_slug,
                    estado: 'activo'
                }])
                .select()
                .single();

            if (errorTenant) throw errorTenant;

            // 2. Create 'Super Administrador' role for this tenant
            const { data: rol, error: errorRol } = await this.supabaseService.client
                .from('roles')
                .insert([{
                    tenant_id: tenant.id,
                    nombre: 'Super Administrador',
                    descripcion: 'Acceso completo al sistema',
                    color: '#dc2626',
                    permisos: [
                        'dashboard.ver',
                        'inventario.ver', 'inventario.crear', 'inventario.editar', 'inventario.eliminar', 'inventario.exportar',
                        'proveedores.ver', 'proveedores.crear', 'proveedores.editar', 'proveedores.eliminar',
                        'clientes.ver', 'clientes.crear', 'clientes.editar', 'clientes.eliminar',
                        'ventas.ver', 'ventas.crear', 'ventas.cancelar', 'ventas.historial', 'ventas.exportar',
                        'caja.ver', 'caja.abrir', 'caja.cerrar', 'caja.movimientos', 'caja.arqueo', 'caja.historial',
                        'cuentas.ver', 'cuentas.crear', 'cuentas.editar', 'cuentas.eliminar', 'cuentas.pagos', 'cuentas.recordatorios', 'cuentas.exportar',
                        'usuarios.ver', 'usuarios.crear', 'usuarios.editar', 'usuarios.eliminar',
                        'roles.ver', 'roles.crear', 'roles.editar', 'roles.eliminar',
                        'reportes.ventas', 'reportes.inventario', 'reportes.caja', 'reportes.clientes',
                        'config.general', 'config.backup', 'config.logs'
                    ],
                    activo: true
                }])
                .select()
                .single();

            if (errorRol) throw errorRol;

            // 3. Create admin user for this tenant
            const passwordHasheada = bcrypt.hashSync(payload.admin_password, 10);

            const { error: errorUser } = await this.supabaseService.client
                .from('usuarios')
                .insert([{
                    tenant_id: tenant.id,
                    nombre: payload.admin_nombre,
                    apellido: payload.admin_apellido,
                    email: payload.admin_email,
                    username: payload.admin_username,
                    password: passwordHasheada,
                    rol_id: rol.id,
                    activo: true
                }]);

            if (errorUser) throw errorUser;

            // 4. Create initial subscription
            const { error: errorSub } = await this.supabaseService.client
                .from('subscripciones')
                .insert([{
                    tenant_id: tenant.id,
                    plan_slug: payload.plan_slug,
                    estado: 'activa'
                }]);

            if (errorSub) {
                console.warn('⚠️ Error al crear suscripción:', errorSub);
            }

            console.log('✅ Tenant creado:', tenant.nombre);
            await this.cargarTenants();
            return tenant;

        } catch (error) {
            console.error('💥 Error al crear tenant:', error);
            throw error;
        }
    }

    async actualizarTenant(tenantId: string, cambios: Partial<Tenant>): Promise<void> {
        try {
            const { error } = await this.supabaseService.client
                .from('tenants')
                .update({
                    ...cambios,
                    updated_at: new Date().toISOString()
                })
                .eq('id', tenantId);

            if (error) throw error;
            await this.cargarTenants();
        } catch (error) {
            console.error('Error al actualizar tenant:', error);
            throw error;
        }
    }

    // Kill Switch — Suspend/Reactivate tenant
    async cambiarEstadoTenant(tenantId: string, estado: 'activo' | 'suspendido' | 'vencido'): Promise<void> {
        try {
            console.log(`🔄 Cambiando estado tenant ${tenantId} → ${estado}`);

            const { error } = await this.supabaseService.client
                .from('tenants')
                .update({
                    estado,
                    updated_at: new Date().toISOString()
                })
                .eq('id', tenantId);

            if (error) throw error;

            console.log(`✅ Tenant ${estado}`);
            await this.cargarTenants();
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            throw error;
        }
    }

    // ==================== PLANS ====================

    async cargarPlanes(): Promise<void> {
        try {
            const { data, error } = await this.supabaseService.client
                .from('planes')
                .select('*')
                .order('precio', { ascending: true });

            if (error) throw error;
            this.planesSubject.next(data || []);
        } catch (error) {
            console.error('Error al cargar planes:', error);
            throw error;
        }
    }

    async actualizarPlan(slug: string, cambios: Partial<Plan>): Promise<void> {
        try {
            const { error } = await this.supabaseService.client
                .from('planes')
                .update(cambios)
                .eq('slug', slug);

            if (error) throw error;
            await this.cargarPlanes();
        } catch (error) {
            console.error('Error al actualizar plan:', error);
            throw error;
        }
    }

    // ==================== SUBSCRIPTIONS ====================

    async obtenerSubscripciones(tenantId: string): Promise<Subscripcion[]> {
        try {
            const { data, error } = await this.supabaseService.client
                .from('subscripciones')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error al obtener suscripciones:', error);
            return [];
        }
    }

    async cambiarPlanTenant(tenantId: string, nuevoPlanSlug: string): Promise<void> {
        try {
            // Cancel existing active subscription
            await this.supabaseService.client
                .from('subscripciones')
                .update({ estado: 'cancelada' })
                .eq('tenant_id', tenantId)
                .eq('estado', 'activa');

            // Create new subscription
            await this.supabaseService.client
                .from('subscripciones')
                .insert([{
                    tenant_id: tenantId,
                    plan_slug: nuevoPlanSlug,
                    estado: 'activa'
                }]);

            // Update tenant plan
            await this.supabaseService.client
                .from('tenants')
                .update({
                    plan_slug: nuevoPlanSlug,
                    updated_at: new Date().toISOString()
                })
                .eq('id', tenantId);

            await this.cargarTenants();
        } catch (error) {
            console.error('Error al cambiar plan:', error);
            throw error;
        }
    }

    // ==================== IMPERSONATION ====================

    impersonarTenant(tenantId: string): void {
        // Save dev's original tenant
        const originalTenant = this.tenantService.tenantId;
        if (originalTenant) {
            sessionStorage.setItem('dev_original_tenant', originalTenant);
        }
        sessionStorage.setItem('dev_impersonating', 'true');

        // Switch context to the client's tenant
        this.tenantService.setTenantId(tenantId);
    }

    salirImpersonacion(): void {
        const original = sessionStorage.getItem('dev_original_tenant');
        sessionStorage.removeItem('dev_impersonating');
        sessionStorage.removeItem('dev_original_tenant');

        if (original) {
            this.tenantService.setTenantId(original);
        }
    }

    get estaImpersonando(): boolean {
        return sessionStorage.getItem('dev_impersonating') === 'true';
    }

    // ==================== STATISTICS ====================

    async obtenerEstadisticasTenant(tenantId: string): Promise<{
        ventas_total: number;
        ventas_mes: number;
        productos_activos: number;
        usuarios_activos: number;
    }> {
        try {
            const inicioMes = new Date();
            inicioMes.setDate(1);
            inicioMes.setHours(0, 0, 0, 0);

            const [ventasTotal, ventasMes, productos, usuarios] = await Promise.all([
                this.supabaseService.client
                    .from('ventas')
                    .select('total')
                    .eq('tenant_id', tenantId)
                    .eq('estado', 'completada'),
                this.supabaseService.client
                    .from('ventas')
                    .select('total')
                    .eq('tenant_id', tenantId)
                    .eq('estado', 'completada')
                    .gte('created_at', inicioMes.toISOString()),
                this.supabaseService.client
                    .from('productos')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('activo', true),
                this.supabaseService.client
                    .from('usuarios')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('activo', true)
            ]);

            return {
                ventas_total: ventasTotal.data?.reduce((sum: number, v: any) => sum + v.total, 0) || 0,
                ventas_mes: ventasMes.data?.reduce((sum: number, v: any) => sum + v.total, 0) || 0,
                productos_activos: productos.count || 0,
                usuarios_activos: usuarios.count || 0
            };
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            return { ventas_total: 0, ventas_mes: 0, productos_activos: 0, usuarios_activos: 0 };
        }
    }
}
