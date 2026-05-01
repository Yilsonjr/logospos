import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { SucursalService } from './sucursal.service';
import {
    OrdenAbierta, CrearOrdenAbierta, COLORES_ORDEN, EstadoOrden
} from '../models/ordenes-abiertas.model';
import { ItemCarrito } from '../models/ventas.model';

const TABLE = 'ordenes_abiertas';

@Injectable({ providedIn: 'root' })
export class OrdenesAbiertasService {

    // ================================================================
    // Estado Reactivo
    // ================================================================

    private ordenesSubject = new BehaviorSubject<OrdenAbierta[]>([]);
    public ordenes$ = this.ordenesSubject.asObservable();

    /** Orden actualmente visible en el POS */
    private ordenActivaSubject = new BehaviorSubject<OrdenAbierta | null>(null);
    public ordenActiva$ = this.ordenActivaSubject.asObservable();

    get ordenes(): OrdenAbierta[] { return this.ordenesSubject.value; }
    get ordenActiva(): OrdenAbierta | null { return this.ordenActivaSubject.value; }

    constructor(
        private supabase: SupabaseService,
        private tenantService: TenantService,
        private sucursalService: SucursalService,
    ) {}

    // ================================================================
    // CRUD
    // ================================================================

    /** Carga todas las órdenes abiertas de la caja actual */
    async cargarOrdenes(cajaId?: number): Promise<OrdenAbierta[]> {
        const tenantId = this.tenantService.tenantId;
        if (!tenantId) return [];

        let query = this.supabase.client
            .from(TABLE)
            .select('*, clientes(id, nombre, rnc)')
            .eq('tenant_id', tenantId)
            .eq('estado', 'abierta')
            .order('created_at', { ascending: true });

        if (cajaId) {
            query = query.eq('caja_id', cajaId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const ordenes: OrdenAbierta[] = (data || []).map(this.mapearOrden);
        this.ordenesSubject.next(ordenes);

        // Si hay órdenes y no hay una activa, seleccionar la primera
        if (ordenes.length > 0 && !this.ordenActiva) {
            this.setOrdenActiva(ordenes[0]);
        }

        return ordenes;
    }

    /** Crea una nueva orden vacía */
    async crearOrden(datos: CrearOrdenAbierta): Promise<OrdenAbierta> {
        const tenantId = this.tenantService.getTenantIdOrThrow();
        const sucursalId = this.sucursalService.sucursalActiva?.id;

        const colorIndex = this.ordenes.length % COLORES_ORDEN.length;
        const color = datos.color || COLORES_ORDEN[colorIndex];

        const { data, error } = await this.supabase.client
            .from(TABLE)
            .insert([{
                tenant_id: tenantId,
                sucursal_id: sucursalId,
                caja_id: datos.caja_id,
                cliente_id: datos.cliente_id,
                nombre: datos.nombre,
                tipo: datos.tipo,
                color,
                items: [],
                subtotal: 0,
                descuento: 0,
                impuesto: 0,
                total: 0,
                estado: 'abierta',
                notas: datos.notas,
            }])
            .select('*, clientes(id, nombre, rnc)')
            .single();

        if (error) throw error;
        const orden = this.mapearOrden(data);

        // Agregar a la lista local y activarla
        this.ordenesSubject.next([...this.ordenes, orden]);
        this.setOrdenActiva(orden);
        return orden;
    }

    /** Actualiza el carrito (items + totales) de la orden activa en Supabase */
    async guardarItemsOrden(
        ordenId: string,
        items: ItemCarrito[],
        totales: { subtotal: number; descuento: number; impuesto: number; total: number }
    ): Promise<void> {
        const { error } = await this.supabase.client
            .from(TABLE)
            .update({ items, ...totales })
            .eq('id', ordenId);

        if (error) throw error;

        // Actualizar lista local
        this._actualizarOrdenLocal(ordenId, { items, ...totales });
    }

    /** Asigna un cliente a la orden */
    async asignarCliente(ordenId: string, clienteId: number | null): Promise<void> {
        const { error } = await this.supabase.client
            .from(TABLE)
            .update({ cliente_id: clienteId })
            .eq('id', ordenId);

        if (error) throw error;
        this._actualizarOrdenLocal(ordenId, { cliente_id: clienteId ?? undefined });
    }

    /** Renombra una orden */
    async renombrarOrden(ordenId: string, nombre: string): Promise<void> {
        const { error } = await this.supabase.client
            .from(TABLE)
            .update({ nombre })
            .eq('id', ordenId);

        if (error) throw error;
        this._actualizarOrdenLocal(ordenId, { nombre });
    }

    /** Marca la orden como cobrada (la elimina de la lista activa) */
    async cerrarOrden(ordenId: string, estado: EstadoOrden = 'cobrada'): Promise<void> {
        const { error } = await this.supabase.client
            .from(TABLE)
            .update({ estado })
            .eq('id', ordenId);

        if (error) throw error;

        const restantes = this.ordenes.filter(o => o.id !== ordenId);
        this.ordenesSubject.next(restantes);

        // Activar la siguiente orden o limpiar
        if (this.ordenActiva?.id === ordenId) {
            this.setOrdenActiva(restantes[0] ?? null);
        }
    }

    // ================================================================
    // Gestión de Orden Activa (tab seleccionado)
    // ================================================================

    setOrdenActiva(orden: OrdenAbierta | null): void {
        this.ordenActivaSubject.next(orden);
    }

    /** Genera el próximo nombre automático según tipo */
    generarNombreAutomatico(tipo: 'orden' | 'mesa'): string {
        if (tipo === 'mesa') {
            const nums = this.ordenes
                .filter(o => o.tipo === 'mesa')
                .map(o => parseInt(o.nombre.replace(/[^0-9]/g, '')) || 0);
            const siguiente = nums.length > 0 ? Math.max(...nums) + 1 : 1;
            return `Mesa ${siguiente}`;
        }
        const siguiente = this.ordenes.length + 1;
        return `Orden #${siguiente}`;
    }

    /** Limpiar al cerrar sesión o caja */
    limpiar(): void {
        this.ordenesSubject.next([]);
        this.ordenActivaSubject.next(null);
    }

    // ================================================================
    // Privados
    // ================================================================

    private mapearOrden(raw: any): OrdenAbierta {
        return {
            ...raw,
            items: raw.items || [],
            cliente: raw.clientes ?? undefined,
            // Asegurar que los campos numéricos son number
            subtotal: Number(raw.subtotal || 0),
            descuento: Number(raw.descuento || 0),
            impuesto: Number(raw.impuesto || 0),
            total: Number(raw.total || 0),
        };
    }

    private _actualizarOrdenLocal(id: string, cambios: Partial<OrdenAbierta>): void {
        const actualizadas = this.ordenes.map(o =>
            o.id === id ? { ...o, ...cambios } : o
        );
        this.ordenesSubject.next(actualizadas);

        if (this.ordenActiva?.id === id) {
            this.ordenActivaSubject.next({ ...this.ordenActiva, ...cambios });
        }
    }
}
