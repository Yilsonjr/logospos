import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { Productos } from '../models/productos.model';
import { Observable, from, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductosService {
  private productosSubject = new BehaviorSubject<Productos[]>([]);
  public productos$ = this.productosSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService
  ) {
    this.cargarProductos().catch(err => console.error('Error in initial cargarProductos:', err));
  }

  // Obtener todos los productos
  async cargarProductos(): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('productos')
        .select(`
          *,
          categorias (
            nombre
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al cargar productos:', error);
        throw error;
      }

      // Mapear los datos para aplanar la estructura de categoría y normalizar stock
      const productosMapeados = (data || []).map((prod: any) => ({
        ...prod,
        categoria: prod.categorias?.nombre || 'Sin Categoría',
        stock: prod.stock_actual
      }));

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

      const { data, error } = await this.supabaseService.client
        .from('productos')
        .insert([{
          tenant_id: this.tenantService.getTenantIdOrThrow(),
          nombre: producto.nombre,
          categoria_id: categoriaData.id,
          precio_compra: producto.precio_compra,
          precio_venta: producto.precio_venta,
          sku: producto.sku,
          stock_actual: producto.stock,
          codigo_barras: producto.codigo_barras || null,
          stock_minimo: producto.stock_minimo,
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

      // Mapear campos frontend -> backend
      if (producto.stock !== undefined) updateData.stock_actual = producto.stock;
      if (producto.unidad !== undefined) updateData.unidad_medida = producto.unidad;
      // Eliminar campos que no existen en BD o ya fueron mapeados
      delete updateData.stock;
      delete updateData.unidad;
      delete updateData.categoria; // Ya se manejó con categoria_id

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
      const { error } = await this.supabaseService.client
        .from('productos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error al eliminar producto:', error);
        throw error;
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
      const { data, error } = await this.supabaseService.client
        .from('productos')
        .select('*, categorias(nombre)')
        .lt('stock_actual', limite);

      if (error) {
        console.error('Error al obtener productos con stock bajo:', error);
        throw error;
      }

      return (data || []).map((prod: any) => ({
        ...prod,
        categoria: prod.categorias?.nombre || 'Sin Categoría',
        stock: prod.stock_actual
      }));
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
      const { data, error } = await this.supabaseService.client
        .from('productos')
        .select('*, categorias(nombre)')
        .eq('categoria_id', catData.id);

      if (error) {
        console.error('Error al obtener productos por categoría:', error);
        throw error;
      }

      return (data || []).map((prod: any) => ({
        ...prod,
        categoria: prod.categorias?.nombre || 'Sin Categoría',
        stock: prod.stock_actual
      }));
    } catch (error) {
      console.error('Error en getProductosPorCategoria:', error);
      throw error;
    }
  }
}