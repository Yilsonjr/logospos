import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { FiscalService } from './fiscal.service';
import { NotaCredito, CrearNotaCredito } from '../models/nota-credito.model';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotasCreditoService {

    constructor(
        private supabase: SupabaseService,
        private tenantService: TenantService,
        private fiscalService: FiscalService
    ) { }

    async crearNotaCredito(datos: CrearNotaCredito, ventaData: any): Promise<NotaCredito> {
        const tenantId = this.tenantService.getTenantIdOrThrow();

        // 1. Check fiscal mode via config$ BehaviorSubject
        let ncfNota: string | undefined;
        const config = await firstValueFrom(this.fiscalService.config$);
        if (config?.modo_fiscal) {
            try {
                ncfNota = await this.fiscalService.generarNCF('B04');
            } catch (e) {
                console.warn('No se pudo generar NCF B04 — creando nota sin NCF', e);
            }
        }

        const total = datos.detalles.reduce((s, d) => s + d.subtotal, 0);

        // 2. Insert nota_credito header
        const { data: nota, error: errNota } = await this.supabase.client
            .from('notas_credito')
            .insert({
                tenant_id: tenantId,
                venta_id: datos.venta_id,
                ncf_nota: ncfNota || null,
                ncf_original: ventaData.ncf || null,
                cliente_id: ventaData.cliente_id || null,
                cliente_nombre: ventaData.cliente_nombre || null,
                motivo: datos.motivo,
                total,
                estado: 'activa'
            })
            .select()
            .single();

        if (errNota) throw errNota;

        // 3. Insert line items
        const detalles = datos.detalles.map(d => ({
            nota_credito_id: nota.id,
            producto_id: d.producto_id || null,
            producto_nombre: d.producto_nombre,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            subtotal: d.subtotal
        }));

        const { error: errDet } = await this.supabase.client
            .from('notas_credito_detalle')
            .insert(detalles);
        if (errDet) throw errDet;

        // 4. Revert stock for each returned product
        for (const d of datos.detalles) {
            if (d.producto_id) {
                await this.supabase.client.rpc('incrementar_stock', {
                    p_producto_id: d.producto_id,
                    p_tenant_id: tenantId,
                    p_cantidad: d.cantidad
                });
            }
        }

        return { ...nota, detalles: datos.detalles as any };
    }

    async listarPorVenta(ventaId: number): Promise<NotaCredito[]> {
        const tenantId = this.tenantService.tenantId;
        const { data, error } = await this.supabase.client
            .from('notas_credito')
            .select('*, notas_credito_detalle(*)')
            .eq('tenant_id', tenantId)
            .eq('venta_id', ventaId)
            .eq('estado', 'activa')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }
}
