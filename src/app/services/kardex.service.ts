import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { MovimientoInventario } from '../models/kardex.model';

@Injectable({
  providedIn: 'root'
})
export class KardexService {
  private supabase = inject(SupabaseService);
  private tenant = inject(TenantService);

  /**
   * Obtiene los movimientos de un producto específico en una sucursal.
   */
  async getMovimientos(productoId: number, sucursalId: number): Promise<MovimientoInventario[]> {
    const tenantId = this.tenant.tenantId;
    if (!tenantId) return [];

    const { data, error } = await this.supabase.client
      .from('movimientos_inventario')
      .select(`
        *,
        usuario:usuario_id (nombre)
      `)
      .eq('tenant_id', tenantId)
      .eq('producto_id', productoId)
      .eq('sucursal_id', sucursalId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching kardex:', error);
      throw error;
    }
    
    return (data || []).map(m => ({
      ...m,
      usuario_nombre: m.usuario?.nombre
    }));
  }

  /**
   * Obtiene todos los movimientos de una sucursal (para reportes generales).
   */
  async getMovimientosSucursal(sucursalId: number, limit: number = 50): Promise<MovimientoInventario[]> {
    const { data, error } = await this.supabase.client
      .from('movimientos_inventario')
      .select(`
        *,
        producto:producto_id (nombre),
        usuario:usuario_id (nombre)
      `)
      .eq('sucursal_id', sucursalId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    return (data || []).map(m => ({
      ...m,
      producto_nombre: m.producto?.nombre,
      usuario_nombre: m.usuario?.nombre
    }));
  }
}
