import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { PrintService } from './print.service';
import { Conduce, ConduceCompleto, CrearConduce } from '../models/conduce.model';
import { VentaCompleta } from '../models/ventas.model';

@Injectable({ providedIn: 'root' })
export class ConduceService {

    constructor(
        private supabase: SupabaseService,
        private tenantService: TenantService,
        private printService: PrintService
    ) { }

    // Genera el número correlativo del conduce (C-YYYYMMDD-0001)
    private async generarNumeroConduce(): Promise<string> {
        const tenantId = this.tenantService.getTenantIdOrThrow();
        const hoy = new Date();
        const fecha = hoy.toISOString().slice(0, 10).replace(/-/g, '');

        const { count } = await this.supabase.client
            .from('conduces')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .like('numero_conduce', `C-${fecha}-%`);

        const siguiente = ((count || 0) + 1).toString().padStart(4, '0');
        return `C-${fecha}-${siguiente}`;
    }

    // Crear conduce a partir de una venta
    async crearConduce(venta: VentaCompleta, datos: Partial<CrearConduce>): Promise<Conduce> {
        const tenantId = this.tenantService.getTenantIdOrThrow();
        const numero_conduce = await this.generarNumeroConduce();

        const payload = {
            tenant_id: tenantId,
            venta_id: venta.id!,
            numero_conduce,
            cliente_id: venta.cliente_id || null,
            direccion_entrega: datos.direccion_entrega || null,
            motorista: datos.motorista || null,
            vehiculo: datos.vehiculo || null,
            notas: datos.notas || null,
            estado: 'pendiente' as const,
            fecha_salida: new Date().toISOString()
        };

        const { data, error } = await this.supabase.client
            .from('conduces')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // Obtener conduce existente por venta
    async obtenerConducePorVenta(ventaId: number): Promise<Conduce | null> {
        const { data, error } = await this.supabase.client
            .from('conduces')
            .select('*')
            .eq('venta_id', ventaId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    // Actualizar estado del conduce
    async actualizarEstado(id: number, estado: string): Promise<void> {
        const updates: any = { estado, updated_at: new Date().toISOString() };
        if (estado === 'entregado') updates.fecha_entrega = new Date().toISOString();

        const { error } = await this.supabase.client
            .from('conduces')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    }

    // Imprimir conduce (genera el HTML y abre ventana de impresión)
    imprimirConduce(conduce: ConduceCompleto, negocio?: any): void {
        const items = conduce.items.map(item => `
            <tr>
                <td>${item.producto_nombre}</td>
                <td style="text-align:center">${item.cantidad}</td>
                <td style="text-align:center">${item.unidad || 'Und.'}</td>
                <td style="text-align:right">RD$ ${item.precio_unitario.toFixed(2)}</td>
                <td style="text-align:right">RD$ ${item.subtotal.toFixed(2)}</td>
            </tr>
        `).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Conduce ${conduce.numero_conduce}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 22px; font-weight: bold; }
        .header p { font-size: 11px; color: #555; }
        .doc-title { text-align: center; font-size: 16px; font-weight: bold; letter-spacing: 2px;
                     border: 2px solid #333; padding: 6px; margin-bottom: 14px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .meta-box { border: 1px solid #ccc; padding: 8px; border-radius: 4px; }
        .meta-box label { font-size: 10px; color: #888; text-transform: uppercase; display: block; }
        .meta-box span { font-size: 12px; font-weight: bold; }
        .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase;
                         color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        thead tr { background: #333; color: white; }
        th { padding: 6px 8px; text-align: left; font-size: 11px; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; }
        .total-row td { font-weight: bold; border-top: 2px solid #333; background: #f9f9f9; }
        .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; }
        .firma-box { text-align: center; border-top: 1px solid #333; padding-top: 6px; font-size: 11px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px;
                 background: #fef3c7; color: #92400e; font-weight: bold; font-size: 11px; }
        @media print {
            @page { size: letter; margin: 1.5cm; }
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${negocio?.nombre || 'Logos POS'}</h1>
        ${negocio?.rnc ? `<p>RNC: ${negocio.rnc}</p>` : ''}
        ${negocio?.telefono ? `<p>${negocio.telefono}</p>` : ''}
        ${negocio?.direccion ? `<p>${negocio.direccion}</p>` : ''}
    </div>

    <div class="doc-title">★ CONDUCE DE SALIDA ★</div>

    <div class="meta-grid">
        <div class="meta-box">
            <label>N° Conduce</label>
            <span>${conduce.numero_conduce}</span>
        </div>
        <div class="meta-box">
            <label>N° Factura</label>
            <span>${conduce.numero_venta}</span>
        </div>
        <div class="meta-box">
            <label>Fecha de Salida</label>
            <span>${new Date(conduce.fecha_salida || conduce.created_at || '').toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="meta-box">
            <label>Estado</label>
            <span class="badge">En Camino</span>
        </div>
    </div>

    <p class="section-title">Datos del Destinatario</p>
    <div class="meta-grid">
        <div class="meta-box">
            <label>Cliente</label>
            <span>${conduce.cliente_nombre || 'Cliente General'}</span>
            ${conduce.cliente_rnc ? `<br><label>RNC</label><span>${conduce.cliente_rnc}</span>` : ''}
        </div>
        <div class="meta-box">
            <label>Dirección de Entrega</label>
            <span>${conduce.direccion_entrega || '—'}</span>
        </div>
    </div>

    <p class="section-title">Datos del Transporte</p>
    <div class="meta-grid">
        <div class="meta-box">
            <label>Motorista / Entregador</label>
            <span>${conduce.motorista || '—'}</span>
        </div>
        <div class="meta-box">
            <label>Vehículo / Placa</label>
            <span>${conduce.vehiculo || '—'}</span>
        </div>
    </div>

    <p class="section-title" style="margin-top:12px">Detalle de Productos</p>
    <table>
        <thead>
            <tr>
                <th>Producto</th>
                <th style="text-align:center">Cant.</th>
                <th style="text-align:center">Unidad</th>
                <th style="text-align:right">Precio</th>
                <th style="text-align:right">Subtotal</th>
            </tr>
        </thead>
        <tbody>${items}</tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="3"><strong>TOTAL</strong></td>
                <td></td>
                <td style="text-align:right"><strong>RD$ ${conduce.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2)}</strong></td>
            </tr>
        </tfoot>
    </table>

    ${conduce.notas ? `<p><strong>Notas:</strong> ${conduce.notas}</p>` : ''}

    <div class="firmas">
        <div class="firma-box">
            <p>_______________________________</p>
            <p><strong>Entregado por</strong></p>
            <p>${conduce.motorista || '________________'}</p>
        </div>
        <div class="firma-box">
            <p>_______________________________</p>
            <p><strong>Recibido por</strong></p>
            <p>Nombre y Cédula</p>
        </div>
    </div>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=800,height=900');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 500);
        }
    }
}
