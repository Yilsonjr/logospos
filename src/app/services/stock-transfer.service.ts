import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { AuditoriaService } from './auditoria.service';
import { TransferenciaStock, DetalleTransferenciaStock, StockTransferEstado } from '../models/stock-transfer.model';

@Injectable({
  providedIn: 'root'
})
export class StockTransferService {
  private supabase = inject(SupabaseService);
  private tenant = inject(TenantService);
  private auditoria = inject(AuditoriaService);

  async getTransferencias(): Promise<TransferenciaStock[]> {
    const tenantId = this.tenant.tenantId;
    if (!tenantId) return [];

    const { data, error } = await this.supabase.client
      .from('transferencias_stock')
      .select(`
        *,
        sucursal_origen:sucursal_origen_id (nombre),
        sucursal_destino:sucursal_destino_id (nombre),
        usuario:usuario_id (nombre)
      `)
      .eq('tenant_id', tenantId)
      .order('fecha_envio', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(t => ({
      ...t,
      sucursal_origen_nombre: t.sucursal_origen?.nombre,
      sucursal_destino_nombre: t.sucursal_destino?.nombre,
      usuario_nombre: t.usuario?.nombre
    }));
  }

  async getDetallesTransferencia(id: number): Promise<DetalleTransferenciaStock[]> {
    const { data, error } = await this.supabase.client
      .from('detalles_transferencia_stock')
      .select(`
        *,
        producto:producto_id (nombre)
      `)
      .eq('transferencia_id', id);

    if (error) throw error;
    
    return (data || []).map(d => ({
      ...d,
      producto_nombre: d.producto?.nombre
    }));
  }

  /**
   * Crea una transferencia y descuenta stock del origen ATÓMICAMENTE.
   */
  async crearTransferencia(
    transferencia: Partial<TransferenciaStock>,
    detalles: { producto_id: number, cantidad: number }[]
  ): Promise<void> {
    const tenantId = this.tenant.tenantId;
    if (!tenantId) throw new Error('No tenant ID');

    try {
      // 1. Insertar Cabecera
      const { data: header, error: hError } = await this.supabase.client
        .from('transferencias_stock')
        .insert({
          tenant_id: tenantId,
          sucursal_origen_id: transferencia.sucursal_origen_id,
          sucursal_destino_id: transferencia.sucursal_destino_id,
          usuario_id: transferencia.usuario_id,
          estado: 'enviado',
          notas: transferencia.notas
        })
        .select()
        .single();

      if (hError) throw hError;

      // 2. Insertar Detalles
      const rows = detalles.map(d => ({
        transferencia_id: header.id,
        producto_id: d.producto_id,
        cantidad: d.cantidad
      }));

      const { error: dError } = await this.supabase.client
        .from('detalles_transferencia_stock')
        .insert(rows);

      if (dError) throw dError;

      // 3. Descontar Stock del ORIGEN
      for (const det of detalles) {
        const { data: currentStock } = await this.supabase.client
          .from('stock_sucursales')
          .select('cantidad')
          .eq('sucursal_id', transferencia.sucursal_origen_id)
          .eq('producto_id', det.producto_id)
          .single();

        const nuevaCantidad = (currentStock?.cantidad || 0) - det.cantidad;

        await this.supabase.client
          .from('stock_sucursales')
          .update({ cantidad: nuevaCantidad })
          .eq('sucursal_id', transferencia.sucursal_origen_id)
          .eq('producto_id', det.producto_id);
      }

      await this.auditoria.registrarTraza(
        'TRANSFERENCIA_CREADA',
        `Transferencia #${header.id} de ${transferencia.sucursal_origen_id} a ${transferencia.sucursal_destino_id}`
      );

    } catch (e) {
      console.error('Error creating transfer:', e);
      throw e;
    }
  }

  /**
   * Procesa la recepción y aumenta stock en el destino.
   */
  async recibirTransferencia(id: number): Promise<void> {
    try {
      const { data: trans } = await this.supabase.client
        .from('transferencias_stock')
        .select('*')
        .eq('id', id)
        .single();

      if (trans.estado !== 'enviado') throw new Error('Transferencia ya procesada');

      const { data: detalles } = await this.supabase.client
        .from('detalles_transferencia_stock')
        .select('*')
        .eq('transferencia_id', id);

      if (!detalles) throw new Error('No se encontraron detalles para esta transferencia');

      // 2. Aumentar Stock en DESTINO
      for (const det of detalles) {
        const { data: existing } = await this.supabase.client
          .from('stock_sucursales')
          .select('cantidad')
          .eq('sucursal_id', trans.sucursal_destino_id)
          .eq('producto_id', det.producto_id)
          .maybeSingle();

        if (existing) {
          const nuevaCantidad = Number(existing.cantidad) + Number(det.cantidad);
          await this.supabase.client
            .from('stock_sucursales')
            .update({ cantidad: nuevaCantidad })
            .eq('sucursal_id', trans.sucursal_destino_id)
            .eq('producto_id', det.producto_id);
        } else {
          await this.supabase.client
            .from('stock_sucursales')
            .insert({
              tenant_id: trans.tenant_id,
              sucursal_id: trans.sucursal_destino_id,
              producto_id: det.producto_id,
              cantidad: det.cantidad
            });
        }
      }

      // 3. Marcar como RECIBIDA
      await this.supabase.client
        .from('transferencias_stock')
        .update({
          estado: 'recibido',
          fecha_recibido: new Date().toISOString()
        })
        .eq('id', id);

      await this.auditoria.registrarTraza(
        'TRANSFERENCIA_RECIBIDA',
        `Transferencia #${id} recibida en sucursal ${trans.sucursal_destino_id}`
      );

    } catch (e) {
      console.error('Error receiving transfer:', e);
      throw e;
    }
  }

  async cancelarTransferencia(id: number): Promise<void> {
     try {
      const { data: trans } = await this.supabase.client
        .from('transferencias_stock')
        .select('*')
        .eq('id', id)
        .single();

      if (trans.estado !== 'enviado') throw new Error('No se puede cancelar');

      const { data: detalles } = await this.supabase.client
        .from('detalles_transferencia_stock')
        .select('*')
        .eq('transferencia_id', id);

      // 2. Devolver Stock al ORIGEN
      if (detalles) {
        for (const det of detalles) {
          const { data: existing } = await this.supabase.client
            .from('stock_sucursales')
            .select('cantidad')
            .eq('sucursal_id', trans.sucursal_origen_id)
            .eq('producto_id', det.producto_id)
            .single();

          if (existing) {
            const nuevaCantidad = Number(existing.cantidad) + Number(det.cantidad);
            await this.supabase.client
              .from('stock_sucursales')
              .update({ cantidad: nuevaCantidad })
              .eq('sucursal_id', trans.sucursal_origen_id)
              .eq('producto_id', det.producto_id);
          }
        }
      }

      await this.supabase.client
        .from('transferencias_stock')
        .update({ estado: 'cancelado' })
        .eq('id', id);

    } catch (e) {
      console.error('Error cancelling transfer:', e);
      throw e;
    }
  }
}
