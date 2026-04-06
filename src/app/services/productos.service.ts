import { Injectable, Injector } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { SucursalService } from './sucursal.service';
import { Productos } from '../models/productos.model';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { DbService } from './offline/db.service';
import { SyncService } from './offline/sync.service';
import { AuditoriaService } from './auditoria.service';

@Injectable({
  providedIn: 'root'
})
export class ProductosService {
  private productosSubject = new BehaviorSubject<Productos[]>([]);
  public productos$ = this.productosSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService,
    private sucursalService: SucursalService,
    private injector: Injector,
    private dbService: DbService,
    private auditoriaService: AuditoriaService
  ) {
    this.cargarProductos().catch(err => console.error('Error in initial cargarProductos:', err));
  }

  private get syncService(): SyncService {
    return this.injector.get(SyncService);
  }

  // Obtener todos los productos
  async cargarProductos(): Promise<void> {
    try {
      if (this.syncService.isOffline()) {
        const tenantId = this.tenantService.getTenantIdOrThrow();
        const localProds = await this.dbService.productos.where({ tenant_id: tenantId }).toArray();
        this.productosSubject.next(localProds);
        return;
      }
      const sucursalId = this.sucursalService.getSucursalActivaIdOrThrow();

      const { data, error } = await this.supabaseService.client
        .from('productos')
        .select(`
          *,
          categorias (
            nombre
          ),
          stock_sucursales!inner (
            cantidad,
            stock_minimo,
            precio_venta_override
          )
        `)
        .eq('stock_sucursales.sucursal_id', sucursalId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al cargar productos:', error);
        throw error;
      }

      // Mapear los datos para aplanar la estructura de categoría y normalizar stock por sucursal
      const productosMapeados = (data || []).map((prod: any) => {
        const stockData = Array.isArray(prod.stock_sucursales) ? prod.stock_sucursales[0] : prod.stock_sucursales;
        return {
          ...prod,
          categoria: prod.categorias?.nombre || 'Sin Categoría',
          stock: stockData?.cantidad ?? 0,
          stock_minimo: stockData?.stock_minimo ?? 0,
          // Use override price if exists, else global base price
          precio_venta: stockData?.precio_venta_override ?? prod.precio_venta
        };
      });

      this.productosSubject.next(productosMapeados);
    } catch (error) {
      console.error('Error en cargarProductos:', error);
      throw error;
    }
  }

  // Crear un nuevo producto
  async crearProducto(producto: Omit<Productos, 'id' | 'created_at' | 'updated_at'>): Promise<Productos> {
    try {
      // Obtener el ID de la categoría por su nombre (case-insensitive)
      const { data: categoriaData, error: categoriaError } = await this.supabaseService.client
        .from('categorias')
        .select('id')
        .ilike('nombre', producto.categoria) // Usar ilike para búsqueda case-insensitive
        .single();

      if (categoriaError || !categoriaData) {
        console.error('Error al buscar categoría:', categoriaError);
        throw new Error(`No se encontró la categoría "${producto.categoria}". Por favor, créala primero.`);
      }

      // Insert global product data
      const { data, error } = await this.supabaseService.client
        .from('productos')
        .insert([{
          tenant_id: this.tenantService.getTenantIdOrThrow(),
          nombre: producto.nombre,
          categoria_id: categoriaData.id,
          precio_compra: producto.precio_compra,
          precio_venta: producto.precio_venta,
          sku: producto.sku,
          codigo_barras: producto.codigo_barras || null,
          unidad_medida: producto.unidad,
          imagen_url: producto.imagen_url || null,
          imagen_nombre: producto.imagen_nombre
        }])
        .select()
        .single();

      if (error) {
        console.error('Error al crear producto:', error);
        throw error;
      }

      // Insert localized stock data right away for the active branch
      const sucursalId = this.sucursalService.sucursalActiva?.id;
      if (sucursalId) {
        await this.supabaseService.client.from('stock_sucursales').insert([{
           tenant_id: this.tenantService.getTenantIdOrThrow(),
           sucursal_id: sucursalId,
           producto_id: data.id,
           cantidad: producto.stock || 0,
           stock_minimo: producto.stock_minimo || 0,
           precio_venta_override: null
        }]);
      }

      // Recargar la lista de productos
      await this.cargarProductos();

      return data;
    } catch (error) {
      console.error('Error en crearProducto:', error);
      throw error;
    }
  }

  // Actualizar un producto
  async actualizarProducto(id: number, producto: Partial<Productos>): Promise<Productos> {
    try {
      // Si se está actualizando la categoría, obtener su ID
      let categoria_id: number | undefined;
      if (producto.categoria) {
        const { data: categoriaData, error: categoriaError } = await this.supabaseService.client
          .from('categorias')
          .select('id')
          .ilike('nombre', producto.categoria) // Usar ilike para búsqueda case-insensitive
          .single();

        if (categoriaError || !categoriaData) {
          console.error('Error al buscar categoría:', categoriaError);
          throw new Error(`No se encontró la categoría "${producto.categoria}"`);
        }
        categoria_id = categoriaData.id;
      }

      // Preparar objeto de actualización
      const updateData: any = {
        ...producto,
        updated_at: new Date().toISOString()
      };

      // Mapear campos frontend -> backend para productos globales
      if (producto.unidad !== undefined) updateData.unidad_medida = producto.unidad;
      // Extract branch-specific properties
      const stockLocal = producto.stock;
      const stockMinimoLocal = producto.stock_minimo;
      
      delete updateData.stock;
      delete updateData.unidad;
      delete updateData.categoria; 

      if (categoria_id) updateData.categoria_id = categoria_id;

      const { data, error } = await this.supabaseService.client
        .from('productos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error al actualizar producto:', error);
        throw error;
      }

      // Sync localized stock if provided
      if (stockLocal !== undefined || stockMinimoLocal !== undefined) {
         const sucursalId = this.sucursalService.sucursalActiva?.id;
         if (sucursalId) {
            const stockUpdate: any = {};
            if (stockLocal !== undefined) stockUpdate.cantidad = stockLocal;
            if (stockMinimoLocal !== undefined) stockUpdate.stock_minimo = stockMinimoLocal;
            
            await this.supabaseService.client
               .from('stock_sucursales')
               .update(stockUpdate)
               .eq('producto_id', id)
               .eq('sucursal_id', sucursalId);
         }
      }

      // Recargar la lista de productos
      await this.cargarProductos();

      return data;
    } catch (error) {
      console.error('Error en actualizarProducto:', error);
      throw error;
    }
  }

  // Eliminar un producto
  async eliminarProducto(id: number): Promise<void> {
    try {
      // Obtener nombre antes de borrar
      const { data: prodInfo } = await this.supabaseService.client
        .from('productos')
        .select('nombre, codigo_barras')
        .eq('id', id)
        .single();

      const { error } = await this.supabaseService.client
        .from('productos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error al eliminar producto:', error);
        throw error;
      }

      if (prodInfo) {
        this.auditoriaService.registrarTraza(
          'PRODUCTO_ELIMINADO', 
          `Se eliminó el producto "${prodInfo.nombre}" (Código: ${prodInfo.codigo_barras || 'N/A'}) del inventario general.`, 
          { id_producto: id }
        );
      }

      // Recargar la lista de productos
      await this.cargarProductos();
    } catch (error) {
      console.error('Error en eliminarProducto:', error);
      throw error;
    }
  }

  // Obtener productos con stock bajo
  async getProductosStockBajo(limite: number = 10): Promise<Productos[]> {
    try {
      const sucursalId = this.sucursalService.getSucursalActivaIdOrThrow();
      
      const { data, error } = await this.supabaseService.client
        .from('productos')
        .select(`*, categorias(nombre), stock_sucursales!inner(cantidad, stock_minimo, precio_venta_override)`)
        .eq('stock_sucursales.sucursal_id', sucursalId)
        .lt('stock_sucursales.cantidad', limite);

      if (error) {
        console.error('Error al obtener productos con stock bajo:', error);
        throw error;
      }

      return (data || []).map((prod: any) => {
        const stockData = Array.isArray(prod.stock_sucursales) ? prod.stock_sucursales[0] : prod.stock_sucursales;
        return {
          ...prod,
          categoria: prod.categorias?.nombre || 'Sin Categoría',
          stock: stockData?.cantidad ?? 0,
          stock_minimo: stockData?.stock_minimo ?? 0,
          precio_venta: stockData?.precio_venta_override ?? prod.precio_venta
        };
      });
    } catch (error) {
      console.error('Error en getProductosStockBajo:', error);
      throw error;
    }
  }

  // Obtener productos por categoría
  async getProductosPorCategoria(categoriaNombre: string): Promise<Productos[]> {
    try {
      // 1. Obtener ID de la categoría
      const { data: catData, error: catError } = await this.supabaseService.client
        .from('categorias')
        .select('id')
        .ilike('nombre', categoriaNombre)
        .single();

      if (catError || !catData) {
        return [];
      }

      // 2. Obtener productos de esa categoría
      const sucursalId = this.sucursalService.getSucursalActivaIdOrThrow();
      const { data, error } = await this.supabaseService.client
        .from('productos')
        .select('*, categorias(nombre), stock_sucursales!inner(cantidad, stock_minimo, precio_venta_override)')
        .eq('categoria_id', catData.id)
        .eq('stock_sucursales.sucursal_id', sucursalId);

      if (error) {
        console.error('Error al obtener productos por categoría:', error);
        throw error;
      }

      return (data || []).map((prod: any) => {
        const stockData = Array.isArray(prod.stock_sucursales) ? prod.stock_sucursales[0] : prod.stock_sucursales;
        return {
          ...prod,
          categoria: prod.categorias?.nombre || 'Sin Categoría',
          stock: stockData?.cantidad ?? 0,
          stock_minimo: stockData?.stock_minimo ?? 0,
          precio_venta: stockData?.precio_venta_override ?? prod.precio_venta
        };
      });
    } catch (error) {
      console.error('Error en getProductosPorCategoria:', error);
      throw error;
    }
  }

  // Actualizar stock localmente (offline o UX rapida)
  async descontarStockLocal(productoId: number, cantidad: number): Promise<void> {
    try {
      const prod = await this.dbService.productos.get(productoId);
      if (prod) {
          prod.stock = Math.max(0, (prod.stock || 0) - cantidad);
          await this.dbService.productos.put(prod);
      }
      
      const actuales = this.productosSubject.getValue();
      const index = actuales.findIndex(p => p.id === productoId);
      if (index !== -1) {
          actuales[index].stock = Math.max(0, (actuales[index].stock || 0) - cantidad);
          this.productosSubject.next([...actuales]);
      }
    } catch(e) {
      console.error('Error descontando stock local:', e);
    }
  }
}