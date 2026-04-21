import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Productos } from '../../models/productos.model';
import { Categoria } from '../../models/categorias.model';
import { ModalProductosComponent } from './modal.productos/modal.productos';
import { ModalGestionCategoriasComponent } from './modal.gestion-categorias/modal.gestion-categorias';
import { ModalGestionUnidadesComponent } from './modal.gestion-unidades/modal.gestion-unidades';
import { TransferenciasStockComponent } from './transferencias/transferencias-stock.component';
import { ProductosService } from '../../services/productos.service';
import { CategoriasService } from '../../services/categorias.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-inventario',
  imports: [ModalProductosComponent, ModalGestionCategoriasComponent, ModalGestionUnidadesComponent, TransferenciasStockComponent, CommonModule, FormsModule],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.css',
})
export class Inventario implements OnInit, OnDestroy {
  isModalOpen = false;
  isModalGestionCategoriasOpen = false;
  isModalGestionUnidadesOpen = false;
  isModalTransferenciasOpen = false;
  productos: Productos[] = [];
  categorias: Categoria[] = [];
  isLoading = true;
  productoEditando?: Productos; // Producto que se está editando
  private productosSubscription?: Subscription;
  private categoriasSubscription?: Subscription;
  private subscriptions: Subscription[] = [];

  // === BÚSQUEDA, FILTRO, ORDEN, PAGINACIÓN ===
  searchTerm = '';
  filtroCategoria = '';
  filtroStock: 'todos' | 'bajo' | 'normal' | 'sin_stock' = 'todos';
  showFiltros = false;
  sortField: 'nombre' | 'precio_venta' | 'precio_compra' | 'stock' | 'categoria' = 'nombre';
  sortDirection: 'asc' | 'desc' = 'asc';
  showSortMenu = false;
  paginaActual = 1;
  itemsPorPagina = 50;

  // Estadísticas del mes pasado (se cargarán desde la BD)
  totalProductosMesPasado = 0;
  valorInventarioMesPasado = 0;

  constructor(
    private productosService: ProductosService,
    private categoriasService: CategoriasService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  ngOnInit() {
    console.log('🔄 Inventario: Iniciando carga reactiva...');

    // 1. Suscribirse a los productos (Observable)
    this.productosSubscription = this.productosService.productos$.subscribe(
      productos => {
        console.log('📦 Productos recibidos:', productos.length);
        this.productos = productos;
        // Si ya hay productos, ocultar loading de inmediato
        if (productos.length > 0) {
          this.isLoading = false;
        }
        this.cdr.detectChanges();
      }
    );

    // 2. Suscribirse a las categorías
    this.categoriasSubscription = this.categoriasService.categorias$.subscribe(
      categorias => {
        console.log('🏷️ Categorías recibidas:', categorias.length);
        this.categorias = categorias;
        this.cdr.detectChanges();
      }
    );

    // 3. Cargar datos en segundo plano
    this.cargarDatosIniciales();

    // 4. Recargar cuando se navega al inventario
    const navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        if (event.url.includes('/inventario')) {
          console.log('🔄 Recargando inventario por navegación...');
          this.cargarDatosIniciales();
        }
      });

    this.subscriptions.push(navSub);
  }

  private async cargarDatosIniciales() {
    await Promise.all([
      this.cargarProductos(),
      this.cargarCategorias()
    ]);
    await this.cargarEstadisticasMesPasado();
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    if (this.productosSubscription) {
      this.productosSubscription.unsubscribe();
    }
    if (this.categoriasSubscription) {
      this.categoriasSubscription.unsubscribe();
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarProductos() {
    try {
      if (this.productos.length === 0) {
        this.isLoading = true;
      }
      await this.productosService.cargarProductos();
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async cargarCategorias() {
    try {
      await this.categoriasService.cargarCategorias();
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  }

  abrirModal() {
    this.productoEditando = undefined; // Limpiar producto editando
    this.isModalOpen = true;
  }

  abrirModalCategorias() {
    this.isModalGestionCategoriasOpen = true;
  }

  abrirModalUnidades() {
    this.isModalGestionUnidadesOpen = true;
  }

  handleCerrarModal() {
    this.isModalOpen = false;
    this.productoEditando = undefined; // Limpiar al cerrar
  }

  handleCerrarModalCategorias() {
    this.isModalGestionCategoriasOpen = false;
  }

  handleCerrarModalUnidades() {
    this.isModalGestionUnidadesOpen = false;
  }

  abrirModalTransferencias() {
    this.isModalTransferenciasOpen = true;
  }

  handleCerrarModalTransferencias() {
    this.isModalTransferenciasOpen = false;
  }

  onProductoCreado() {
    console.log('✅ Producto creado, recargando lista...');
    // La lista se actualiza automáticamente gracias al Observable
  }

  getBadgeClass(categoria: string): string {
    const base = 'badge rounded-pill ';
    switch (categoria.toLowerCase()) {
      case 'detergente': return base + 'bg-primary-subtle text-primary border border-primary-subtle';
      case 'cereal': return base + 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      case 'lacteos': return base + 'bg-success-subtle text-success border border-success-subtle';
      case 'bebidas': return base + 'bg-info-subtle text-info-emphasis border border-info-subtle';
      case 'snacks': return base + 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      case 'limpieza': return base + 'bg-success-subtle text-success border border-success-subtle';
      default: return base + 'bg-secondary-subtle text-secondary border border-secondary-subtle';
    }
  }

  getStockMin(stock: number): string {
    const base = 'fw-bold small text-uppercase ';
    if (stock < 20) {
      return base + 'text-danger';
    }
    return base + 'text-success';
  }

  get totalProductos(): number {
    return this.productos.length;
  }

  // === PRODUCTOS FILTRADOS Y PAGINADOS ===
  get productosFiltrados(): Productos[] {
    let resultado = [...this.productos];

    // 1. Búsqueda por texto
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      resultado = resultado.filter(p =>
        p.nombre?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.codigo_barras?.toLowerCase().includes(term) ||
        p.categoria?.toLowerCase().includes(term)
      );
    }

    // 2. Filtro por categoría
    if (this.filtroCategoria) {
      resultado = resultado.filter(p => p.categoria === this.filtroCategoria);
    }

    // 3. Filtro por stock
    if (this.filtroStock === 'bajo') {
      resultado = resultado.filter(p => p.stock > 0 && p.stock < (p.stock_minimo || 10));
    } else if (this.filtroStock === 'sin_stock') {
      resultado = resultado.filter(p => p.stock <= 0);
    } else if (this.filtroStock === 'normal') {
      resultado = resultado.filter(p => p.stock >= (p.stock_minimo || 10));
    }

    // 4. Ordenamiento
    resultado.sort((a, b) => {
      let valA: any, valB: any;
      switch (this.sortField) {
        case 'nombre': valA = a.nombre?.toLowerCase() || ''; valB = b.nombre?.toLowerCase() || ''; break;
        case 'precio_venta': valA = a.precio_venta || 0; valB = b.precio_venta || 0; break;
        case 'precio_compra': valA = a.precio_compra || 0; valB = b.precio_compra || 0; break;
        case 'stock': valA = a.stock || 0; valB = b.stock || 0; break;
        case 'categoria': valA = a.categoria?.toLowerCase() || ''; valB = b.categoria?.toLowerCase() || ''; break;
        default: valA = a.nombre?.toLowerCase() || ''; valB = b.nombre?.toLowerCase() || '';
      }
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });

    return resultado;
  }

  get productosPaginados(): Productos[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.productosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.productosFiltrados.length / this.itemsPorPagina));
  }

  get paginasArray(): number[] {
    const total = this.totalPaginas;
    const current = this.paginaActual;
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // === ACCIONES DE BÚSQUEDA/FILTRO/ORDEN ===
  onSearchChange() {
    this.paginaActual = 1;
  }

  toggleFiltros() {
    this.showFiltros = !this.showFiltros;
    this.showSortMenu = false;
  }

  toggleSortMenu() {
    this.showSortMenu = !this.showSortMenu;
    this.showFiltros = false;
  }

  setFiltroCategoria(cat: string) {
    this.filtroCategoria = this.filtroCategoria === cat ? '' : cat;
    this.paginaActual = 1;
  }

  setFiltroStock(filtro: 'todos' | 'bajo' | 'normal' | 'sin_stock') {
    this.filtroStock = filtro;
    this.paginaActual = 1;
  }

  setSortField(field: 'nombre' | 'precio_venta' | 'precio_compra' | 'stock' | 'categoria') {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.showSortMenu = false;
    this.paginaActual = 1;
  }

  limpiarFiltros() {
    this.searchTerm = '';
    this.filtroCategoria = '';
    this.filtroStock = 'todos';
    this.sortField = 'nombre';
    this.sortDirection = 'asc';
    this.paginaActual = 1;
    this.showFiltros = false;
  }

  irPagina(p: number) {
    if (p >= 1 && p <= this.totalPaginas) this.paginaActual = p;
  }

  get paginaDesde(): number {
    return this.productosFiltrados.length === 0 ? 0 : ((this.paginaActual - 1) * this.itemsPorPagina) + 1;
  }

  get paginaHasta(): number {
    return Math.min(this.paginaActual * this.itemsPorPagina, this.productosFiltrados.length);
  }

  get categoriasUnicas(): string[] {
    const cats = new Set(this.productos.map(p => p.categoria).filter(Boolean));
    return Array.from(cats).sort();
  }

  get hayFiltrosActivos(): boolean {
    return !!this.searchTerm || !!this.filtroCategoria || this.filtroStock !== 'todos';
  }

  exportarDatos() {
    if (this.productos.length === 0) {
      alert('No hay productos para exportar');
      return;
    }

    // Crear datos para exportar
    const datosExportar = this.productos.map(producto => ({
      ID: producto.id,
      Nombre: producto.nombre,
      Categoria: producto.categoria,
      'Precio Compra': producto.precio_compra,
      'Precio Venta': producto.precio_venta,
      Stock: producto.stock,
      SKU: producto.sku || '',
      'Código Barras': producto.codigo_barras || '',
      'Stock Mínimo': producto.stock_minimo || 0,
      'Estado Stock': producto.stock < (producto.stock_minimo || 10) ? 'Bajo' : 'Normal'
    }));

    // Función para escapar valores CSV
    const escaparCSV = (valor: any): string => {
      if (valor === null || valor === undefined) return '';
      const valorStr = String(valor);
      // Si contiene coma, comillas, salto de línea o punto y coma, envolver en comillas
      if (valorStr.includes(',') || valorStr.includes('"') || valorStr.includes('\n') || valorStr.includes(';')) {
        return `"${valorStr.replace(/"/g, '""')}"`;
      }
      return valorStr;
    };

    // Convertir a CSV con delimitador de punto y coma (mejor para Excel en español)
    const headers = Object.keys(datosExportar[0]).map(escaparCSV).join(';');
    const csvContent = datosExportar.map(row =>
      Object.values(row).map(escaparCSV).join(';')
    ).join('\n');

    // Agregar BOM para que Excel reconozca UTF-8
    const BOM = '\uFEFF';
    const csv = BOM + headers + '\n' + csvContent;

    // Crear y descargar archivo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getProductosStockMin(limite: number): number {
    return this.productos.filter(producto => producto.stock < limite).length;
  }

  getTotalInventario(): number {
    return this.productos.reduce((total, producto) => {
      return total + (producto.precio_compra * producto.stock);
    }, 0);
  }

  // Calcular porcentaje de cambio vs mes pasado
  getPorcentajeCambioProductos(): string {
    if (this.totalProductosMesPasado === 0) return '+0.0%';

    const cambio = ((this.totalProductos - this.totalProductosMesPasado) / this.totalProductosMesPasado) * 100;
    const signo = cambio >= 0 ? '+' : '';
    return `${signo}${cambio.toFixed(1)}%`;
  }

  // Calcular valoración de mercado (diferencia entre precio venta y compra)
  getValoracionMercado(): string {
    const valorCompra = this.getTotalInventario();
    const valorVenta = this.productos.reduce((total, producto) => {
      return total + (producto.precio_venta * producto.stock);
    }, 0);

    if (valorCompra === 0) return '+0.0%';

    const valoracion = ((valorVenta - valorCompra) / valorCompra) * 100;
    const signo = valoracion >= 0 ? '+' : '';
    return `${signo}${valoracion.toFixed(1)}%`;
  }

  // Cargar estadísticas del mes pasado
  async cargarEstadisticasMesPasado() {
    try {
      // Calcular fecha del mes pasado
      const hoy = new Date();
      const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());

      // Por ahora, usar valores simulados
      // En producción, deberías guardar snapshots mensuales del inventario
      this.totalProductosMesPasado = Math.max(0, this.totalProductos - Math.floor(Math.random() * 3));
      this.valorInventarioMesPasado = this.getTotalInventario() * 0.95; // 5% menos que ahora

    } catch (error) {
      console.error('Error al cargar estadísticas del mes pasado:', error);
    }
  }

  async eliminarProducto(producto: Productos) {

    if (!producto.id) return;

    const result = await Swal.fire({
      title: `¿Eliminar "${producto.nombre}"?`,
      text: "No podrás revertir esto",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });

    // Si el usuario confirmó
    if (result.isConfirmed) {
      try {
        await this.productosService.eliminarProducto(producto.id);

        Swal.fire({
          title: "¡Eliminado!",
          text: "✅ Producto eliminado correctamente",
          icon: "success"
        });

        // Opcional: refrescar lista de productos aquí
        // this.cargarProductos();

      } catch (error) {
        console.error('Error al eliminar producto:', error);

        Swal.fire({
          title: "Error",
          text: "❌ No se pudo eliminar el producto. Intenta nuevamente.",
          icon: "error"
        });
      }
    }
  }

  editarProducto(producto: Productos) {
    this.productoEditando = producto;
    this.isModalOpen = true;
  }

  // Obtener productos con stock bajo (urgente)
  getProductosUrgentes(): number {
    return this.productos.filter(producto => {
      const stockMinimo = producto.stock_minimo || 10;
      return producto.stock < stockMinimo;
    }).length;
  }

  // Manejar errores de carga de imagen
  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';

    // Mostrar icono de imagen rota en su lugar
    const parent = img.parentElement;
    if (parent && !parent.querySelector('.fa-image-slash')) {
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-image-slash text-gray-400 text-lg';
      parent.appendChild(icon);
    }
  }
}
