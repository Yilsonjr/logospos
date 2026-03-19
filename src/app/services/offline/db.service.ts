import { Injectable } from '@angular/core';
import { Dexie, Table } from 'dexie';
import { Productos } from '../../models/productos.model';
import { Cliente } from '../../models/clientes.model';
import { CrearVenta } from '../../models/ventas.model';

export interface VentaPendiente {
  id?: number;
  tenant_id: string;
  payload: CrearVenta;
  fecha: string;
  intentos: number;
  error_message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DbService extends Dexie {
  productos!: Table<Productos, number>;
  clientes!: Table<Cliente, number>;
  ventasPendientes!: Table<VentaPendiente, number>;

  constructor() {
    super('LogosPOSOfflineDB');
    
    // Esquema de la base de datos local (versión 1)
    // Se definen únicamente las llaves primarias y los índices para búsquedas rápidas.
    this.version(1).stores({
      productos: 'id, tenant_id, nombre, categoria, codigo_barras',
      clientes: 'id, tenant_id, rnc, nombre_completo, telefono',
      // ++id autoincremental para las transacciones pendientes que aún no tocan Supabase
      ventasPendientes: '++id, tenant_id, fecha'
    });
  }

  // --- Helpers rápidos para limpieza de DB en base al Tenant ---
  
  async limpiarTablas(tenantId: string) {
    await this.transaction('rw', this.productos, this.clientes, this.ventasPendientes, async () => {
      await this.productos.where('tenant_id').equals(tenantId).delete();
      await this.clientes.where('tenant_id').equals(tenantId).delete();
      await this.ventasPendientes.where('tenant_id').equals(tenantId).delete();
    });
  }
}
