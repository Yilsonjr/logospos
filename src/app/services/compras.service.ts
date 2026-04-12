import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { CuentasPagarService } from './cuentas-pagar.service';
import { AuthService } from './auth.service';
import { SucursalService } from './sucursal.service';
import { Compra, DetalleCompra, CompraConDetalles, CrearCompra, CrearDetalleCompra } from '../models/compras.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ComprasService {
  private comprasSubject = new BehaviorSubject<Compra[]>([]);
  public compras$ = this.comprasSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService,
    private cuentasPagarService: CuentasPagarService,
    private authService: AuthService,
    private sucursalService: SucursalService
  ) {
    // Load purchases reactively when active branch changes (avoids startup crash)
    this.sucursalService.sucursalActiva$.subscribe(sucursal => {
      if (sucursal) {
        this.cargarCompras().catch(err => console.error('Error in cargarCompras:', err));
      } else {
        this.comprasSubject.next([]);
      }
    });
  }

  // Cargar todas las compras
  async cargarCompras(): Promise<void> {
    try {
      console.log('🔄 Cargando compras...');

      const sucursalId = this.sucursalService.getSucursalActivaIdOrThrow();

      const { data, error } = await this.supabaseService.client
        .from('compras')
        .select(`
          *,
          proveedores (nombre)
        `)
        .eq('sucursal_id', sucursalId)
        .order('fecha_compra', { ascending: false });

      if (error) {
        console.error('❌ Error al cargar compras:', error);
        throw error;
      }

      // Mapear los datos para incluir el nombre del proveedor
      // Tambien mapeamos columnas de DB a Modelo si es necesario
      const comprasConProveedor = data?.map(compra => ({
        ...compra,
        numero_factura: compra.numero_compra, // DB: numero_compra -> Model: numero_factura
        impuesto: compra.impuestos,           // DB: impuestos -> Model: impuesto
        proveedor_nombre: compra.proveedores?.nombre,
        // Los campos perdidos (descuento, etc) no se pueden recuperar tal cual si se guardaron en notas
      })) || [];

      console.log('✅ Compras cargadas:', comprasConProveedor.length);
      this.comprasSubject.next(comprasConProveedor);

    } catch (error) {
      console.error('💥 Error en cargarCompras:', error);
      throw error;
    }
  }

  // Obtener una compra con sus detalles
  async obtenerCompraConDetalles(compraId: number): Promise<CompraConDetalles> {
    try {
      console.log('🔄 Obteniendo compra con detalles:', compraId);

      // Obtener la compra
      const { data: compra, error: errorCompra } = await this.supabaseService.client
        .from('compras')
        .select(`
          *,
          proveedores (nombre)
        `)
        .eq('id', compraId)
        .single();

      if (errorCompra) {
        console.error('❌ Error al obtener compra:', errorCompra);
        throw errorCompra;
      }

      // Obtener los detalles
      const { data: detalles, error: errorDetalles } = await this.supabaseService.client
        .from('detalles_compra')
        .select(`
          *,
          productos (nombre)
        `)
        .eq('compra_id', compraId);

      if (errorDetalles) {
        console.error('❌ Error al obtener detalles:', errorDetalles);
        throw errorDetalles;
      }

      const compraConDetalles: CompraConDetalles = {
        ...compra,
        numero_factura: compra.numero_compra,
        impuesto: compra.impuestos,
        proveedor_nombre: compra.proveedores?.nombre,
        detalles: detalles?.map(detalle => ({
          ...detalle,
          producto_nombre: detalle.productos?.nombre
        })) || []
      };

      console.log('✅ Compra con detalles obtenida');
      return compraConDetalles;

    } catch (error) {
      console.error('💥 Error en obtenerCompraConDetalles:', error);
      throw error;
    }
  }

  // Crear nueva compra con detalles
  async crearCompra(compra: CrearCompra, detalles: CrearDetalleCompra[]): Promise<Compra> {
    try {
      console.log('🔄 Creando compra...');

      const usuarioId = this.authService.usuarioActual?.id;
      if (!usuarioId) throw new Error('No hay usuario autenticado para registrar la compra');

      // Preparar payload para la DB
      const tenantId = this.tenantService.getTenantIdOrThrow();
      const sucursalId = this.sucursalService.getSucursalActivaIdOrThrow();
      const compraDb = {
        tenant_id: tenantId,
        sucursal_id: sucursalId,
        proveedor_id: compra.proveedor_id,
        usuario_id: usuarioId,
        numero_compra: compra.numero_factura || `CMP-${Date.now()}`,
        fecha_compra: compra.fecha_compra,
        fecha_vencimiento: compra.fecha_vencimiento || null,
        subtotal: compra.subtotal,
        impuestos: compra.impuesto,
        descuento: compra.descuento || 0,
        total: compra.total,
        estado: compra.estado === 'pagada' ? 'completada' : 'pendiente',
        metodo_pago: compra.metodo_pago || null,
        notas: compra.notas || null
      };

      // Crear la compra
      const { data: nuevaCompra, error: errorCompra } = await this.supabaseService.client
        .from('compras')
        .insert([compraDb])
        .select()
        .single();

      if (errorCompra) {
        console.error('❌ Error al crear compra:', errorCompra);
        throw errorCompra;
      }

      // Crear los detalles con el ID de la compra
      const detallesConCompraId = detalles.map(detalle => ({
        ...detalle,
        tenant_id: tenantId,
        compra_id: nuevaCompra.id
      }));

      const { error: errorDetalles } = await this.supabaseService.client
        .from('detalles_compra')
        .insert(detallesConCompraId);

      if (errorDetalles) {
        console.error('❌ Error al crear detalles:', errorDetalles);
        // Intentar eliminar la compra si falló la creación de detalles
        await this.supabaseService.client
          .from('compras')
          .delete()
          .eq('id', nuevaCompra.id);
        throw errorDetalles;
      }

      // Actualizar el stock de los productos
      for (const detalle of detalles) {
        await this.actualizarStockProducto(detalle.producto_id, detalle.cantidad);
      }

      // === INTEGRACIÓN AUTOMÁTICA CON CUENTAS POR PAGAR ===
      if (compra.metodo_pago === 'Crédito') {
        try {
          console.log('💳 Compra a crédito detectada. Generando cuenta por pagar...');
          await this.cuentasPagarService.crearCuenta({
            proveedor_id: compra.proveedor_id,
            concepto: `Compra Inventario #${nuevaCompra.id} ${compraDb.numero_compra ? '- Fac: ' + compraDb.numero_compra : ''}`,
            monto_total: compra.total,
            fecha_factura: compra.fecha_compra,
            // Si no hay fecha vencimiento, usar 30 días por defecto
            fecha_vencimiento: compra.fecha_vencimiento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            prioridad: 'media',
            categoria: 'Mercancía',
            numero_factura: compraDb.numero_compra,
            notas: `Generada automáticamente desde Compras. ID Compra: ${nuevaCompra.id}`
          });
          console.log('✅ Cuenta por pagar generada exitosamente');
        } catch (errorCxP) {
          console.error('⚠️ Error al generar cuenta por pagar automática:', errorCxP);
          // No lanzamos error para no revertir la compra, pero alertamos
        }
      }

      console.log('✅ Compra creada:', nuevaCompra.id);
      await this.cargarCompras();
      return nuevaCompra;

    } catch (error) {
      console.error('💥 Error en crearCompra:', error);
      throw error;
    }
  }

  // Actualizar stock de producto en la sucursal activa
  private async actualizarStockProducto(productoId: number, cantidad: number): Promise<void> {
    try {
      const sucursalId = this.sucursalService.getSucursalActivaIdOrThrow();

      // Obtener el stock actual
      const { data: stockRef, error: errorGet } = await this.supabaseService.client
        .from('stock_sucursales')
        .select('cantidad')
        .eq('producto_id', productoId)
        .eq('sucursal_id', sucursalId)
        .maybeSingle();

      if (errorGet) throw errorGet;

      // Actualizar el stock
      const { error: errorUpdate } = await this.supabaseService.client
        .from('stock_sucursales')
        .update({
          cantidad: (stockRef?.cantidad || 0) + cantidad,
          updated_at: new Date().toISOString()
        })
        .eq('producto_id', productoId)
        .eq('sucursal_id', sucursalId);

      if (errorUpdate) throw errorUpdate;

      console.log(`✅ Stock actualizado para producto ${productoId}: +${cantidad}`);

    } catch (error) {
      console.error('❌ Error al actualizar stock:', error);
      throw error;
    }
  }

  // Actualizar estado de compra
  async actualizarEstadoCompra(compraId: number, estado: string): Promise<void> {
    try {
      console.log('🔄 Actualizando estado de compra:', compraId);

      const { error } = await this.supabaseService.client
        .from('compras')
        .update({
          estado,
          updated_at: new Date().toISOString()
        })
        .eq('id', compraId);

      if (error) {
        console.error('❌ Error al actualizar estado:', error);
        throw error;
      }

      console.log('✅ Estado actualizado');
      await this.cargarCompras();

    } catch (error) {
      console.error('💥 Error en actualizarEstadoCompra:', error);
      throw error;
    }
  }

  // Anular compra (soft delete - mantener registro)
  async anularCompra(compraId: number, motivo?: string): Promise<void> {
    try {
      console.log('🔄 Anulando compra:', compraId);

      const { error } = await this.supabaseService.client
        .from('compras')
        .update({
          estado: 'cancelada',
          notas: motivo ? `ANULADA: ${motivo}` : 'ANULADA',
          updated_at: new Date().toISOString()
        })
        .eq('id', compraId);

      if (error) {
        console.error('❌ Error al anular compra:', error);
        throw error;
      }

      console.log('✅ Compra anulada');
      await this.cargarCompras();

    } catch (error) {
      console.error('💥 Error en anularCompra:', error);
      throw error;
    }
  }

  // Eliminar compra físicamente (solo para casos especiales)
  async eliminarCompra(compraId: number): Promise<void> {
    try {
      console.log('🔄 Eliminando compra:', compraId);

      // Primero eliminar los detalles
      const { error: errorDetalles } = await this.supabaseService.client
        .from('detalles_compra')
        .delete()
        .eq('compra_id', compraId);

      if (errorDetalles) {
        console.error('❌ Error al eliminar detalles:', errorDetalles);
        throw errorDetalles;
      }

      // Luego eliminar la compra
      const { error: errorCompra } = await this.supabaseService.client
        .from('compras')
        .delete()
        .eq('id', compraId);

      if (errorCompra) {
        console.error('❌ Error al eliminar compra:', errorCompra);
        throw errorCompra;
      }

      console.log('✅ Compra eliminada');
      await this.cargarCompras();

    } catch (error) {
      console.error('💥 Error en eliminarCompra:', error);
      throw error;
    }
  }

  // Obtener compras por proveedor
  async obtenerComprasPorProveedor(proveedorId: number): Promise<Compra[]> {
    try {
      const sucursalId = this.sucursalService.getSucursalActivaIdOrThrow();
      const { data, error } = await this.supabaseService.client
        .from('compras')
        .select('*')
        .eq('proveedor_id', proveedorId)
        .eq('sucursal_id', sucursalId)
        .order('fecha_compra', { ascending: false });

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error al obtener compras por proveedor:', error);
      throw error;
    }
  }

  // Obtener compras por estado
  async obtenerComprasPorEstado(estado: string): Promise<Compra[]> {
    try {
      const sucursalId = this.sucursalService.getSucursalActivaIdOrThrow();
      const { data, error } = await this.supabaseService.client
        .from('compras')
        .select('*')
        .eq('estado', estado)
        .eq('sucursal_id', sucursalId)
        .order('fecha_compra', { ascending: false });

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error al obtener compras por estado:', error);
      throw error;
    }
  }
}
