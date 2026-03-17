import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import {
  CuentaPorPagar,
  PagoCuentaPagar,
  CuentaPagarConPagos,
  CrearCuentaPorPagar,
  CrearPagoCuentaPagar,
  ResumenCuentasPagar,
  FiltrosCuentasPagar,
  EstadisticasProveedor,
  PlanPagos
} from '../models/cuentas-pagar.model';

@Injectable({
  providedIn: 'root'
})
export class CuentasPagarService {
  private cuentasSubject = new BehaviorSubject<CuentaPorPagar[]>([]);
  public cuentas$ = this.cuentasSubject.asObservable();

  private resumenSubject = new BehaviorSubject<ResumenCuentasPagar>({
    total_cuentas: 0,
    total_pendiente: 0,
    total_vencidas: 0,
    total_parciales: 0,
    total_pagadas: 0,
    monto_total_pendiente: 0,
    monto_total_vencido: 0,
    proximos_vencimientos: []
  });
  public resumen$ = this.resumenSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService
  ) { }

  // ==================== CUENTAS POR PAGAR ====================

  async cargarCuentas(filtros?: FiltrosCuentasPagar): Promise<void> {
    try {
      console.log('🔄 Cargando cuentas por pagar...', filtros);
      let query = this.supabaseService.client
        .from('cuentas_pagar')
        .select(`
          *,
          proveedores (nombre)
        `);

      // Aplicar filtros
      if (filtros) {
        if (filtros.estado) {
          query = query.eq('estado', filtros.estado);
        }
        if (filtros.prioridad) {
          query = query.eq('prioridad', filtros.prioridad);
        }
        if (filtros.categoria) {
          query = query.eq('categoria', filtros.categoria);
        }
        if (filtros.proveedor_id) {
          query = query.eq('proveedor_id', filtros.proveedor_id);
        }
        if (filtros.fecha_desde) {
          query = query.gte('fecha_factura', filtros.fecha_desde);
        }
        if (filtros.fecha_hasta) {
          query = query.lte('fecha_factura', filtros.fecha_hasta);
        }
        if (filtros.monto_min) {
          query = query.gte('monto_total', filtros.monto_min);
        }
        if (filtros.monto_max) {
          query = query.lte('monto_total', filtros.monto_max);
        }
        if (filtros.vencimiento_desde) {
          query = query.gte('fecha_vencimiento', filtros.vencimiento_desde);
        }
        if (filtros.vencimiento_hasta) {
          query = query.lte('fecha_vencimiento', filtros.vencimiento_hasta);
        }
      }

      console.log('📡 Ejecutando query en Supabase...');
      const { data, error } = await query.order('fecha_vencimiento', { ascending: true });

      if (error) {
        console.error('❌ Error de query en Supabase:', error);
        throw error;
      }

      console.log('✅ Datos recibidos:', data?.length || 0, 'registros');

      const cuentasConProveedor = data?.map(cuenta => {
        // En Supabase, si la relación es 1:N o hay algo raro, puede venir como array o objeto
        const prov = cuenta.proveedores;
        const nombre = Array.isArray(prov) ? prov[0]?.nombre : (prov as any)?.nombre;

        return {
          ...cuenta,
          proveedor_nombre: nombre || 'Proveedor no encontrado'
        };
      }) || [];

      this.cuentasSubject.next(cuentasConProveedor);
      await this.actualizarResumen();
      console.log('✨ Cuentas cargadas y resumen actualizado');

    } catch (error) {
      console.error('💥 Error crítico en cargarCuentas:', error);
      throw error;
    }
  }

  async crearCuenta(cuenta: CrearCuentaPorPagar): Promise<CuentaPorPagar> {
    try {
      const nuevaCuenta = {
        ...cuenta,
        tenant_id: this.tenantService.getTenantIdOrThrow(),
        monto_pagado: 0,
        monto_pendiente: cuenta.monto_total,
        estado: 'pendiente' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabaseService.client
        .from('cuentas_pagar')
        .insert([nuevaCuenta])
        .select(`
          *,
          proveedores (nombre)
        `)
        .single();

      if (error) throw error;

      const cuentaConProveedor = {
        ...data,
        proveedor_nombre: (data.proveedores as any)?.nombre || 'Proveedor no encontrado'
      };

      await this.cargarCuentas();
      return cuentaConProveedor;

    } catch (error) {
      console.error('Error al crear cuenta por pagar:', error);
      throw error;
    }
  }

  async actualizarCuenta(id: number, cambios: Partial<CuentaPorPagar>): Promise<CuentaPorPagar> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('cuentas_pagar')
        .update({
          ...cambios,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          proveedores (nombre)
        `)
        .single();

      if (error) throw error;

      const cuentaActualizada = {
        ...data,
        proveedor_nombre: (data.proveedores as any)?.nombre || 'Proveedor no encontrado'
      };

      await this.cargarCuentas();
      return cuentaActualizada;

    } catch (error) {
      console.error('Error al actualizar cuenta por pagar:', error);
      throw error;
    }
  }

  async eliminarCuenta(id: number): Promise<void> {
    try {
      // Primero eliminar todos los pagos asociados
      await this.supabaseService.client
        .from('pagos_cuentas_pagar')
        .delete()
        .eq('cuenta_id', id);

      // Luego eliminar la cuenta
      const { error } = await this.supabaseService.client
        .from('cuentas_pagar')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await this.cargarCuentas();

    } catch (error) {
      console.error('Error al eliminar cuenta por pagar:', error);
      throw error;
    }
  }

  // ==================== PAGOS ====================

  async registrarPago(pago: CrearPagoCuentaPagar): Promise<PagoCuentaPagar> {
    try {
      // Crear el pago
      const { data: nuevoPago, error: errorPago } = await this.supabaseService.client
        .from('pagos_cuentas_pagar')
        .insert([{
          ...pago,
          tenant_id: this.tenantService.getTenantIdOrThrow(),
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (errorPago) throw errorPago;

      // Actualizar la cuenta
      await this.actualizarMontosYEstado(pago.cuenta_id);

      await this.cargarCuentas();
      return nuevoPago;

    } catch (error) {
      console.error('Error al registrar pago:', error);
      throw error;
    }
  }

  async obtenerPagosCuenta(cuentaId: number): Promise<PagoCuentaPagar[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('pagos_cuentas_pagar')
        .select('*')
        .eq('cuenta_id', cuentaId)
        .order('fecha_pago', { ascending: false });

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error al obtener pagos de cuenta:', error);
      return [];
    }
  }

  async obtenerCuentaConPagos(cuentaId: number): Promise<CuentaPagarConPagos | null> {
    try {
      const { data: cuenta, error: errorCuenta } = await this.supabaseService.client
        .from('cuentas_pagar')
        .select(`
          *,
          proveedores (nombre)
        `)
        .eq('id', cuentaId)
        .single();

      if (errorCuenta) throw errorCuenta;

      const pagos = await this.obtenerPagosCuenta(cuentaId);

      return {
        ...cuenta,
        proveedor_nombre: (cuenta.proveedores as any)?.nombre || 'Proveedor no encontrado',
        pagos
      };

    } catch (error) {
      console.error('Error al obtener cuenta con pagos:', error);
      return null;
    }
  }

  async eliminarPago(pagoId: number, cuentaId: number): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('pagos_cuentas_pagar')
        .delete()
        .eq('id', pagoId);

      if (error) throw error;

      // Actualizar montos de la cuenta
      await this.actualizarMontosYEstado(cuentaId);
      await this.cargarCuentas();

    } catch (error) {
      console.error('Error al eliminar pago:', error);
      throw error;
    }
  }

  // ==================== UTILIDADES PRIVADAS ====================

  private async actualizarMontosYEstado(cuentaId: number): Promise<void> {
    try {
      // Obtener total pagado
      const { data: pagos } = await this.supabaseService.client
        .from('pagos_cuentas_pagar')
        .select('monto')
        .eq('cuenta_id', cuentaId);

      const totalPagado = pagos?.reduce((sum, pago) => sum + pago.monto, 0) || 0;

      // Obtener monto total de la cuenta
      const { data: cuenta } = await this.supabaseService.client
        .from('cuentas_pagar')
        .select('monto_total, fecha_vencimiento')
        .eq('id', cuentaId)
        .single();

      if (!cuenta) return;

      const montoPendiente = cuenta.monto_total - totalPagado;
      let estado: 'pendiente' | 'parcial' | 'pagada' | 'vencida';

      if (totalPagado === 0) {
        estado = new Date() > new Date(cuenta.fecha_vencimiento) ? 'vencida' : 'pendiente';
      } else if (montoPendiente === 0) {
        estado = 'pagada';
      } else {
        estado = 'parcial';
      }

      // Actualizar la cuenta
      await this.supabaseService.client
        .from('cuentas_pagar')
        .update({
          monto_pagado: totalPagado,
          monto_pendiente: montoPendiente,
          estado,
          updated_at: new Date().toISOString()
        })
        .eq('id', cuentaId);

    } catch (error) {
      console.error('Error al actualizar montos y estado:', error);
    }
  }

  // ==================== RESÚMENES Y ESTADÍSTICAS ====================

  private async actualizarResumen(): Promise<void> {
    try {
      const cuentas = this.cuentasSubject.value;
      const hoy = new Date();

      const resumen: ResumenCuentasPagar = {
        total_cuentas: cuentas.length,
        total_pendiente: cuentas.filter(c => c.estado === 'pendiente').length,
        total_vencidas: cuentas.filter(c => c.estado === 'vencida').length,
        total_parciales: cuentas.filter(c => c.estado === 'parcial').length,
        total_pagadas: cuentas.filter(c => c.estado === 'pagada').length,
        monto_total_pendiente: cuentas
          .filter(c => c.estado !== 'pagada')
          .reduce((sum, c) => sum + c.monto_pendiente, 0),
        monto_total_vencido: cuentas
          .filter(c => c.estado === 'vencida')
          .reduce((sum, c) => sum + c.monto_pendiente, 0),
        proximos_vencimientos: cuentas
          .filter(c => {
            const vencimiento = new Date(c.fecha_vencimiento);
            const diasHastaVencimiento = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
            return diasHastaVencimiento <= 7 && diasHastaVencimiento >= 0 && c.estado !== 'pagada';
          })
          .sort((a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime())
          .slice(0, 5)
      };

      this.resumenSubject.next(resumen);

    } catch (error) {
      console.error('Error al actualizar resumen:', error);
    }
  }

  async obtenerEstadisticasPorProveedor(): Promise<EstadisticasProveedor[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('cuentas_pagar')
        .select(`
          proveedor_id,
          proveedores (nombre),
          monto_total,
          monto_pendiente,
          estado,
          fecha_factura,
          fecha_vencimiento
        `);

      if (error) throw error;

      const estadisticasPorProveedor = new Map<number, EstadisticasProveedor>();

      data?.forEach(cuenta => {
        const proveedorId = cuenta.proveedor_id;

        if (!estadisticasPorProveedor.has(proveedorId)) {
          estadisticasPorProveedor.set(proveedorId, {
            proveedor_id: proveedorId,
            proveedor_nombre: (cuenta.proveedores as any)?.nombre || 'Sin nombre',
            total_cuentas: 0,
            monto_total: 0,
            monto_pendiente: 0,
            promedio_dias_pago: 0,
            cuentas_vencidas: 0
          });
        }

        const stats = estadisticasPorProveedor.get(proveedorId)!;
        stats.total_cuentas++;
        stats.monto_total += cuenta.monto_total;
        stats.monto_pendiente += cuenta.monto_pendiente;

        if (cuenta.estado === 'vencida') {
          stats.cuentas_vencidas++;
        }
      });

      return Array.from(estadisticasPorProveedor.values());

    } catch (error) {
      console.error('Error al obtener estadísticas por proveedor:', error);
      return [];
    }
  }

  async obtenerPlanPagos(dias: number = 30): Promise<PlanPagos[]> {
    try {
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() + dias);

      const { data, error } = await this.supabaseService.client
        .from('cuentas_pagar')
        .select(`
          *,
          proveedores (nombre)
        `)
        .lte('fecha_vencimiento', fechaLimite.toISOString().split('T')[0])
        .neq('estado', 'pagada')
        .order('fecha_vencimiento', { ascending: true });

      if (error) throw error;

      const cuentasConProveedor = data?.map(cuenta => ({
        ...cuenta,
        proveedor_nombre: (cuenta.proveedores as any)?.nombre || 'Proveedor no encontrado'
      })) || [];

      // Agrupar por fecha
      const planPorFecha = new Map<string, CuentaPorPagar[]>();

      cuentasConProveedor.forEach(cuenta => {
        const fecha = cuenta.fecha_vencimiento;
        if (!planPorFecha.has(fecha)) {
          planPorFecha.set(fecha, []);
        }
        planPorFecha.get(fecha)!.push(cuenta);
      });

      // Convertir a array y calcular totales
      const plan: PlanPagos[] = Array.from(planPorFecha.entries()).map(([fecha, cuentas]) => ({
        fecha,
        cuentas,
        monto_total: cuentas.reduce((sum, c) => sum + c.monto_pendiente, 0),
        prioridad_maxima: this.obtenerPrioridadMaxima(cuentas)
      }));

      return plan.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    } catch (error) {
      console.error('Error al obtener plan de pagos:', error);
      return [];
    }
  }

  private obtenerPrioridadMaxima(cuentas: CuentaPorPagar[]): string {
    const prioridades = ['baja', 'media', 'alta', 'urgente'];
    let maxPrioridad = 'baja';

    cuentas.forEach(cuenta => {
      const indexActual = prioridades.indexOf(cuenta.prioridad);
      const indexMax = prioridades.indexOf(maxPrioridad);
      if (indexActual > indexMax) {
        maxPrioridad = cuenta.prioridad;
      }
    });

    return maxPrioridad;
  }

  // ==================== UTILIDADES PÚBLICAS ====================

  calcularDiasVencimiento(fechaVencimiento: string): number {
    const hoy = new Date();
    const vencimiento = new Date(fechaVencimiento);
    return Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  }

  obtenerColorEstado(estado: string): string {
    const colores = {
      'pendiente': '#f59e0b',
      'parcial': '#3b82f6',
      'pagada': '#10b981',
      'vencida': '#ef4444'
    };
    return colores[estado as keyof typeof colores] || '#6b7280';
  }

  obtenerColorPrioridad(prioridad: string): string {
    const colores = {
      'baja': '#6b7280',
      'media': '#f59e0b',
      'alta': '#f97316',
      'urgente': '#ef4444'
    };
    return colores[prioridad as keyof typeof colores] || '#6b7280';
  }
}