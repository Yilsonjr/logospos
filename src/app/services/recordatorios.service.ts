import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { Recordatorio, CrearRecordatorio, PLANTILLAS_RECORDATORIO } from '../models/recordatorios.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RecordatoriosService {
  private recordatoriosSubject = new BehaviorSubject<Recordatorio[]>([]);
  public recordatorios$ = this.recordatoriosSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService
  ) { }

  // Cargar recordatorios
  async cargarRecordatorios(): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('recordatorios')
        .select(`
          *,
          clientes (nombre, telefono, email)
        `)
        .order('fecha_programada', { ascending: true });

      if (error) throw error;

      const recordatoriosConCliente = data?.map(recordatorio => ({
        ...recordatorio,
        cliente_nombre: recordatorio.clientes?.nombre,
        telefono: recordatorio.telefono || recordatorio.clientes?.telefono,
        email: recordatorio.email || recordatorio.clientes?.email
      })) || [];

      this.recordatoriosSubject.next(recordatoriosConCliente);
    } catch (error) {
      console.error('Error al cargar recordatorios:', error);
      throw error;
    }
  }

  // Crear recordatorio
  async crearRecordatorio(recordatorio: CrearRecordatorio): Promise<Recordatorio> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('recordatorios')
        .insert([{
          ...recordatorio,
          tenant_id: this.tenantService.getTenantIdOrThrow()
        }])
        .select()
        .single();

      if (error) throw error;

      await this.cargarRecordatorios();
      return data;
    } catch (error) {
      console.error('Error al crear recordatorio:', error);
      throw error;
    }
  }

  // Programar recordatorios automáticos para cuentas próximas a vencer
  async programarRecordatoriosVencimiento(): Promise<void> {
    try {
      // Obtener cuentas que vencen en los próximos 3 días
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() + 3);

      const { data: cuentas, error } = await this.supabaseService.client
        .from('cuentas_por_cobrar')
        .select(`
          *,
          clientes (nombre, telefono, email)
        `)
        .in('estado', ['pendiente', 'parcial'])
        .lte('fecha_vencimiento', fechaLimite.toISOString().split('T')[0]);

      if (error) throw error;

      for (const cuenta of cuentas || []) {
        // Verificar si ya existe un recordatorio para esta cuenta
        const { data: existeRecordatorio } = await this.supabaseService.client
          .from('recordatorios')
          .select('id')
          .eq('cuenta_id', cuenta.id)
          .eq('tipo', 'vencimiento')
          .eq('estado', 'pendiente')
          .maybeSingle();

        if (!existeRecordatorio) {
          // Crear recordatorio automático
          const mensaje = this.generarMensajeRecordatorio('vencimiento_whatsapp', {
            cliente: cuenta.clientes?.nombre || 'Cliente',
            monto: this.formatearMoneda(cuenta.monto_pendiente),
            fecha_vencimiento: this.formatearFecha(cuenta.fecha_vencimiento)
          });

          const recordatorio: CrearRecordatorio = {
            cuenta_id: cuenta.id,
            cliente_id: cuenta.cliente_id,
            tipo: 'vencimiento',
            mensaje,
            fecha_programada: cuenta.fecha_vencimiento,
            estado: 'pendiente',
            canal: 'whatsapp',
            telefono: cuenta.clientes?.telefono,
            email: cuenta.clientes?.email
          };

          await this.crearRecordatorio(recordatorio);
        }
      }
    } catch (error) {
      console.error('Error al programar recordatorios:', error);
      throw error;
    }
  }

  // Enviar recordatorio (simulado - en producción integrar con APIs reales)
  async enviarRecordatorio(recordatorioId: number): Promise<void> {
    try {
      const { data: recordatorio, error: errorGet } = await this.supabaseService.client
        .from('recordatorios')
        .select('*')
        .eq('id', recordatorioId)
        .single();

      if (errorGet) throw errorGet;

      // Simular envío según el canal
      let exitoso = true;

      switch (recordatorio.canal) {
        case 'whatsapp':
          exitoso = await this.enviarWhatsApp(recordatorio);
          break;
        case 'email':
          exitoso = await this.enviarEmail(recordatorio);
          break;
        case 'sms':
          exitoso = await this.enviarSMS(recordatorio);
          break;
        case 'llamada':
          // Para llamadas, solo marcar como pendiente de realizar
          exitoso = true;
          break;
      }

      // Actualizar estado del recordatorio
      const { error: errorUpdate } = await this.supabaseService.client
        .from('recordatorios')
        .update({
          estado: exitoso ? 'enviado' : 'fallido',
          fecha_enviado: exitoso ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordatorioId);

      if (errorUpdate) throw errorUpdate;

      await this.cargarRecordatorios();
    } catch (error) {
      console.error('Error al enviar recordatorio:', error);
      throw error;
    }
  }

  // Simular envío de WhatsApp
  private async enviarWhatsApp(recordatorio: Recordatorio): Promise<boolean> {
    try {
      if (!recordatorio.telefono) {
        throw new Error('No hay número de teléfono');
      }

      // En producción, aquí integrarías con la API de WhatsApp Business
      // Por ahora, simular el envío
      console.log('📱 Enviando WhatsApp a:', recordatorio.telefono);
      console.log('💬 Mensaje:', recordatorio.mensaje);

      // Simular delay de envío
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simular 95% de éxito
      return Math.random() > 0.05;
    } catch (error) {
      console.error('Error al enviar WhatsApp:', error);
      return false;
    }
  }

  // Simular envío de Email
  private async enviarEmail(recordatorio: Recordatorio): Promise<boolean> {
    try {
      if (!recordatorio.email) {
        throw new Error('No hay email');
      }

      // En producción, aquí integrarías con un servicio de email
      console.log('📧 Enviando Email a:', recordatorio.email);
      console.log('💬 Mensaje:', recordatorio.mensaje);

      await new Promise(resolve => setTimeout(resolve, 500));
      return Math.random() > 0.1; // 90% de éxito
    } catch (error) {
      console.error('Error al enviar Email:', error);
      return false;
    }
  }

  // Simular envío de SMS
  private async enviarSMS(recordatorio: Recordatorio): Promise<boolean> {
    try {
      if (!recordatorio.telefono) {
        throw new Error('No hay número de teléfono');
      }

      console.log('📱 Enviando SMS a:', recordatorio.telefono);
      console.log('💬 Mensaje:', recordatorio.mensaje);

      await new Promise(resolve => setTimeout(resolve, 800));
      return Math.random() > 0.15; // 85% de éxito
    } catch (error) {
      console.error('Error al enviar SMS:', error);
      return false;
    }
  }

  // Generar mensaje usando plantillas
  generarMensajeRecordatorio(plantilla: keyof typeof PLANTILLAS_RECORDATORIO, variables: Record<string, string>): string {
    let mensaje = PLANTILLAS_RECORDATORIO[plantilla];

    Object.entries(variables).forEach(([key, value]) => {
      mensaje = mensaje.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    return mensaje;
  }

  // Obtener recordatorios pendientes
  async obtenerRecordatoriosPendientes(): Promise<Recordatorio[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('recordatorios')
        .select(`
          *,
          clientes (nombre, telefono, email)
        `)
        .eq('estado', 'pendiente')
        .lte('fecha_programada', new Date().toISOString().split('T')[0])
        .order('fecha_programada', { ascending: true });

      if (error) throw error;

      return data?.map(recordatorio => ({
        ...recordatorio,
        cliente_nombre: recordatorio.clientes?.nombre,
        telefono: recordatorio.telefono || recordatorio.clientes?.telefono,
        email: recordatorio.email || recordatorio.clientes?.email
      })) || [];
    } catch (error) {
      console.error('Error al obtener recordatorios pendientes:', error);
      return [];
    }
  }

  // Cancelar recordatorio
  async cancelarRecordatorio(recordatorioId: number): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('recordatorios')
        .update({
          estado: 'cancelado',
          updated_at: new Date().toISOString()
        })
        .eq('id', recordatorioId);

      if (error) throw error;
      await this.cargarRecordatorios();
    } catch (error) {
      console.error('Error al cancelar recordatorio:', error);
      throw error;
    }
  }

  // Utilidades
  private formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }

  private formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}