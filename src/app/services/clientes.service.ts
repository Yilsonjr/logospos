import { Injectable, Injector } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { Cliente, CrearCliente } from '../models/clientes.model';
import { BehaviorSubject } from 'rxjs';
import { DbService } from './offline/db.service';
import { SyncService } from './offline/sync.service';

@Injectable({
  providedIn: 'root'
})
export class ClientesService {
  private clientesSubject = new BehaviorSubject<Cliente[]>([]);
  public clientes$ = this.clientesSubject.asObservable();

  // Acceso síncrono al valor actual (para uso en modales)
  get clientesSnapshot(): Cliente[] {
    return this.clientesSubject.getValue();
  }


  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService,
    private injector: Injector,
    private dbService: DbService
  ) { }

  private get syncService(): SyncService {
    return this.injector.get(SyncService);
  }

  // Cargar clientes activos
  async cargarClientes(): Promise<void> {
    try {
      console.log('🔄 Cargando clientes...');

      if (this.syncService.isOffline()) {
         const tenantId = this.tenantService.getTenantIdOrThrow();
         const localClientes = await this.dbService.clientes.where({ tenant_id: tenantId }).toArray();
         const activos = localClientes.filter(c => c.activo !== false);
         this.clientesSubject.next(activos);
         return;
      }

      const { data, error } = await this.supabaseService.client
        .from('clientes')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) {
        console.error('❌ Error al cargar clientes:', error);
        throw error;
      }

      console.log('✅ Clientes cargados:', data?.length || 0);
      this.clientesSubject.next(data || []);

    } catch (error) {
      console.error('💥 Error en cargarClientes:', error);
      throw error;
    }
  }

  // Cargar TODOS los clientes (activos e inactivos)
  async cargarTodosClientes(): Promise<Cliente[]> {
    try {
      console.log('🔄 Cargando todos los clientes...');

      if (this.syncService.isOffline()) {
         const tenantId = this.tenantService.getTenantIdOrThrow();
         const localClientes = await this.dbService.clientes.where({ tenant_id: tenantId }).toArray();
         return localClientes;
      }

      const { data, error } = await this.supabaseService.client
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('❌ Error al cargar todos los clientes:', error);
        throw error;
      }

      console.log('✅ Todos los clientes cargados:', data?.length || 0);
      return data || [];

    } catch (error) {
      console.error('💥 Error en cargarTodosClientes:', error);
      throw error;
    }
  }

  // Crear nuevo cliente
  async crearCliente(cliente: CrearCliente): Promise<Cliente> {
    try {
      console.log('🔄 Creando cliente:', cliente.nombre);

      const { data, error } = await this.supabaseService.client
        .from('clientes')
        .insert([{
          ...cliente,
          tenant_id: this.tenantService.getTenantIdOrThrow(),
          balance_pendiente: 0
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al crear cliente:', error);
        throw error;
      }

      console.log('✅ Cliente creado:', data.nombre);
      await this.cargarClientes();
      return data;

    } catch (error) {
      console.error('💥 Error en crearCliente:', error);
      throw error;
    }
  }

  // Actualizar cliente
  async actualizarCliente(id: number, cliente: Partial<Cliente>): Promise<Cliente> {
    try {
      console.log('🔄 Actualizando cliente ID:', id);

      const { data, error } = await this.supabaseService.client
        .from('clientes')
        .update({
          ...cliente,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error al actualizar cliente:', error);
        throw error;
      }

      console.log('✅ Cliente actualizado:', data.nombre);
      await this.cargarClientes();
      return data;

    } catch (error) {
      console.error('💥 Error en actualizarCliente:', error);
      throw error;
    }
  }

  // Desactivar cliente (soft delete)
  async desactivarCliente(id: number): Promise<void> {
    try {
      console.log('🔄 Desactivando cliente ID:', id);

      const { error } = await this.supabaseService.client
        .from('clientes')
        .update({
          activo: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Error al desactivar cliente:', error);
        throw error;
      }

      console.log('✅ Cliente desactivado');
      await this.cargarClientes();

    } catch (error) {
      console.error('💥 Error en desactivarCliente:', error);
      throw error;
    }
  }

  // Eliminar cliente físicamente
  async eliminarClienteFisicamente(id: number): Promise<void> {
    try {
      console.log('🔄 Eliminando físicamente cliente ID:', id);

      const { error } = await this.supabaseService.client
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error al eliminar cliente:', error);
        throw error;
      }

      console.log('✅ Cliente eliminado físicamente');
      await this.cargarClientes();

    } catch (error) {
      console.error('💥 Error en eliminarClienteFisicamente:', error);
      throw error;
    }
  }

  // Actualizar balance pendiente del cliente
  async actualizarBalance(id: number, nuevoBalance: number): Promise<void> {
    try {
      console.log('🔄 Actualizando balance cliente ID:', id);

      const { error } = await this.supabaseService.client
        .from('clientes')
        .update({
          balance_pendiente: nuevoBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Error al actualizar balance:', error);
        throw error;
      }

      console.log('✅ Balance actualizado');
      await this.cargarClientes();

    } catch (error) {
      console.error('💥 Error en actualizarBalance:', error);
      throw error;
    }
  }

  // Verificar si el cliente puede comprar a crédito
  puedeComprarACredito(cliente: Cliente, montoCompra: number): boolean {
    const nuevoBalance = cliente.balance_pendiente + montoCompra;
    return nuevoBalance <= cliente.limite_credito;
  }

  // Obtener clientes activos
  getClientesActivos(): Cliente[] {
    return this.clientesSubject.value.filter(c => c.activo);
  }

  // Buscar cliente por cédula
  buscarPorCedula(cedula: string): Cliente | undefined {
    return this.clientesSubject.value.find(
      c => c.cedula?.toLowerCase() === cedula.toLowerCase()
    );
  }

  // Obtener cliente general (para ventas sin cliente específico)
  async getClienteGeneral(): Promise<Cliente | null> {
    try {
      if (this.syncService.isOffline()) {
         const tenantId = this.tenantService.getTenantIdOrThrow();
         const clientes = await this.dbService.clientes.where({ tenant_id: tenantId }).toArray();
         return clientes.find(c => c.nombre === 'Cliente General') || null;
      }

      const { data, error } = await this.supabaseService.client
        .from('clientes')
        .select('*')
        .eq('nombre', 'Cliente General')
        .single();

      if (error) {
        console.error('❌ Error al obtener cliente general:', error);
        return null;
      }

      return data;

    } catch (error) {
      console.error('💥 Error en getClienteGeneral:', error);
      return null;
    }
  }
}
