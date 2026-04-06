import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { SucursalService } from './sucursal.service';
import { AuthService } from './auth.service';

export interface AuditoriaTraza {
  id?: number;
  tenant_id: string;
  sucursal_id?: number | null;
  usuario_id: number;
  usuario_nombre: string;
  accion_tipo: string;
  descripcion?: string;
  detalles?: any;
  ip_address?: string;
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuditoriaService {

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService,
    private sucursalService: SucursalService,
    private authService: AuthService
  ) {}

  /**
   * Registra una acción crítica de forma asíncrona ("fire and forget").
   * @param accionTipo Categoría de la acción (e.g. 'VENTA_ANULADA')
   * @param descripcion Detalle en texto plano legible
   * @param detalles Objeto extra opcional con el JSON del objeto anterior o afectado.
   */
  async registrarTraza(accionTipo: string, descripcion: string, detalles?: any): Promise<void> {
    try {
      const usuario = this.authService.usuarioActual;
      if (!usuario) {
        console.warn('❌ Auditoría denegada: No hay usuario autenticado al intentar registrar:', accionTipo);
        return;
      }

      // No bloqueamos operaciones si no hay tenant (ej. login incorrecto), pero este POS requiere tenant
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) return;

      const payload: AuditoriaTraza = {
        tenant_id: tenantId,
        sucursal_id: this.sucursalService.sucursalActiva?.id || null,
        usuario_id: usuario.id!,
        usuario_nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
        accion_tipo: accionTipo,
        descripcion: descripcion,
        detalles: detalles || null
      };

      const { error } = await this.supabaseService.client
        .from('auditoria_trazas')
        .insert([payload]);

      if (error) {
        console.error('💥 Error de Supabase al escribir auditoría:', error);
      }
    } catch (e) {
      console.error('💥 Excepción en AuditoriaService:', e);
    }
  }

  /**
   * Carga historial para los administradores.
   */
  async obtenerTrazas(limit: number = 100): Promise<AuditoriaTraza[]> {
    try {
      const tenantId = this.tenantService.getTenantIdOrThrow();
      
      const { data, error } = await this.supabaseService.client
        .from('auditoria_trazas')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
         throw error;
      }
      return data || [];
    } catch(e) {
      console.error('Error al obtener auditorías:', e);
      return [];
    }
  }

  /**
   * Carga historial filtrado por sucursal.
   */
  async obtenerTrazasPorSucursal(sucursalId: number, limit: number = 100): Promise<AuditoriaTraza[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('auditoria_trazas')
        .select('*')
        .eq('sucursal_id', sucursalId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
         throw error;
      }
      return data || [];
    } catch(e) {
      console.error('Error al obtener auditorías de sucursal:', e);
      return [];
    }
  }
}
