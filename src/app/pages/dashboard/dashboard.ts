import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { VentasService } from '../../services/ventas.service';
import { ComprasService } from '../../services/compras.service';
import { CajaService } from '../../services/caja.service';
import { CuentasCobrarService } from '../../services/cuentas-cobrar.service';
import { ProductosService } from '../../services/productos.service';
import { FiscalService } from '../../services/fiscal.service';
import { SupabaseService } from '../../services/supabase.service';
import { TenantService } from '../../services/tenant.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';

interface StatCard {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: string;
  iconBg: string;
  isUrgent?: boolean;
}

interface TopProduct {
  name: string;
  category: string;
  price: string;
  sales: string;
  initials: string;
}

interface Transaction {
  id: string;
  customer: string;
  customerInitials: string;
  date: string;
  status: 'completed' | 'pending';
  total: string;
}

interface ChartData {
  label: string;
  value: number;
  percentage: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  selectedPeriod: 'weekly' | 'monthly' | 'yearly' = 'weekly';
  activeTab: 'products' | 'transactions' = 'products';
  isLoading = true;

  stats: StatCard[] = [];
  topProducts: TopProduct[] = [];
  transactions: Transaction[] = [];
  chartData: ChartData[] = [];
  modoFiscalActivo = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private ventasService: VentasService,
    private comprasService: ComprasService,
    private cajaService: CajaService,
    private cuentasCobrarService: CuentasCobrarService,
    private productosService: ProductosService,
    private fiscalService: FiscalService,
    private supabaseService: SupabaseService,
    private tenantService: TenantService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    console.log('🔄 Iniciando dashboard reactivo...');
    this.isLoading = true;

    // 1. Suscribirse al estado fiscal
    const fiscalSub = this.fiscalService.config$.subscribe(cfg => {
      this.modoFiscalActivo = cfg?.modo_fiscal ?? false;
      this.cdr.detectChanges();
    });
    this.subscriptions.push(fiscalSub);

    // 2. Suscribirse a Ventas (Estadísticas, Gráfico, Transacciones)
    const ventasSub = this.ventasService.ventas$.subscribe(ventas => {
      this.actualizarVentasStats(ventas);
      this.actualizarTransacciones(ventas);
      this.actualizarChartDesdeVentas(ventas);
      this.isLoading = false;
      this.cdr.detectChanges();
    });
    this.subscriptions.push(ventasSub);

    // 3. Suscribirse a Productos (Stock Crítico, Top Productos)
    const productosSub = this.productosService.productos$.subscribe(productos => {
      this.actualizarProductosStats(productos);
      this.actualizarTopProductos(productos);
      this.cdr.detectChanges();
    });
    this.subscriptions.push(productosSub);

    // 4. Datos de Caja y Cuentas (Carga inicial y manual)
    await this.cargarDatosManuales();

    // Recargar cuando se navega al dashboard
    const navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(async (event: any) => {
        if (event.url === '/' || event.url === '/dashboard') {
          console.log('🔄 Recargando dashboard por navegación...');
          await Promise.all([
            this.ventasService.cargarVentas(),
            this.productosService.cargarProductos(),
            this.comprasService.cargarCompras(),
            this.cargarDatosManuales()
          ]);
        }
      });
    this.subscriptions.push(navSub);
  }

  async cargarDatosManuales() {
    // Estas estadísticas aún requieren llamadas directas o servicios sin subject
    try {
      const efectivoCaja = await this.obtenerEfectivoCaja();
      const cuentasPorCobrar = await this.obtenerCuentasPorCobrar();

      this.stats = this.stats.map(s => {
        if (s.title === 'Efectivo en Caja') s.value = this.formatearMoneda(efectivoCaja);
        if (s.title === 'Cuentas por Cobrar') s.value = this.formatearMoneda(cuentasPorCobrar);
        return s;
      });
      this.cdr.detectChanges();
    } catch (e) {
      console.warn('Error cargando datos manuales:', e);
    }
  }

  actualizarVentasStats(ventas: any[]) {
    const hoy = new Date().toISOString().split('T')[0];
    const totalVentasHoy = ventas
      .filter(v => v.created_at.startsWith(hoy) && v.estado === 'completada')
      .reduce((sum, v) => sum + v.total, 0);

    const sIndex = this.stats.findIndex(s => s.title === 'Ventas de Hoy');
    const newStat = {
      title: 'Ventas de Hoy',
      value: this.formatearMoneda(totalVentasHoy),
      change: 'Calculado',
      isPositive: true,
      icon: 'fa-money-bill-wave',
      iconBg: 'bg-primary-subtle text-primary'
    };

    if (sIndex > -1) this.stats[sIndex] = newStat;
    else this.stats.push(newStat);

    // Asegurar que existan las otras tarjetas si no están
    this.inicializarTarjetaSiFalta('Efectivo en Caja', 'fa-wallet', 'bg-success-subtle text-success');
    this.inicializarTarjetaSiFalta('Cuentas por Cobrar', 'fa-file-invoice-dollar', 'bg-warning-subtle text-warning');
  }

  actualizarProductosStats(productos: any[]) {
    const stockCritico = productos.filter(p => (p.stock_actual || 0) < (p.stock_minimo || 5)).length;

    const sIndex = this.stats.findIndex(s => s.title === 'Stock Crítico');
    const newStat = {
      title: 'Stock Crítico',
      value: `${stockCritico} items`,
      change: stockCritico > 0 ? 'Revisar' : 'OK',
      isPositive: stockCritico === 0,
      icon: 'fa-box-open',
      iconBg: stockCritico > 0 ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success',
      isUrgent: stockCritico > 0
    };

    if (sIndex > -1) this.stats[sIndex] = newStat;
    else this.stats.push(newStat);
  }

  private inicializarTarjetaSiFalta(title: string, icon: string, iconBg: string) {
    if (!this.stats.find(s => s.title === title)) {
      this.stats.push({
        title,
        value: this.formatearMoneda(0),
        change: '0%',
        isPositive: true,
        icon,
        iconBg
      });
    }
  }

  actualizarTopProductos(productos: any[]) {
    // Mostrar los últimos agregados como "novedades" o top si tuviéramos tabla de relación
    this.topProducts = productos.slice(0, 5).map(p => ({
      name: p.nombre,
      category: p.categoria || 'Sin categoría',
      price: this.formatearMoneda(p.precio_venta),
      sales: `Stock: ${p.stock_actual}`,
      initials: this.obtenerIniciales(p.nombre)
    }));
  }

  actualizarTransacciones(ventas: any[]) {
    this.transactions = ventas.slice(0, 10).map(v => ({
      id: v.numero_venta,
      customer: v.cliente_nombre || 'Cliente General',
      customerInitials: this.obtenerIniciales(v.cliente_nombre || 'Cliente General'),
      date: this.formatearFecha(v.created_at),
      status: v.estado === 'completada' ? 'completed' : 'pending',
      total: this.formatearMoneda(v.total)
    }));
  }

  actualizarChartDesdeVentas(ventas: any[]) {
    const fechaFin = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaFin.getDate() - 7); // Default a semanal

    const ventasFiltradas = ventas.filter(v =>
      new Date(v.created_at) >= fechaInicio &&
      v.estado === 'completada'
    );

    const ventasPorDia = new Map<string, number>();
    ventasFiltradas.forEach(venta => {
      const fecha = new Date(venta.created_at).toISOString().split('T')[0];
      ventasPorDia.set(fecha, (ventasPorDia.get(fecha) || 0) + venta.total);
    });

    const maxVenta = Math.max(...Array.from(ventasPorDia.values()), 1);

    this.chartData = Array.from(ventasPorDia.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, total]) => ({
        label: this.formatearDia(fecha),
        value: total,
        percentage: (total / maxVenta) * 100
      }));
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarDatosDashboard() {
    try {
      console.log('📊 Cargando datos del dashboard...');

      // Cargar datos en paralelo pero sin bloquear si uno falla
      await Promise.allSettled([
        this.cargarEstadisticas(),
        this.cargarProductosRecientes(),
        this.cargarTransaccionesRecientes(),
        this.cargarDatosGrafico()
      ]);

      // Forzar detección de cambios después de cargar todos los datos
      this.cdr.detectChanges();
      console.log('✅ Datos del dashboard cargados:', {
        stats: this.stats.length,
        products: this.topProducts.length,
        transactions: this.transactions.length,
        chartData: this.chartData.length
      });
    } catch (error) {
      console.error('❌ Error al cargar dashboard:', error);
    }
  }

  async cargarEstadisticas() {
    try {
      console.log('📊 Cargando estadísticas...');

      const totalVentasHoy = await this.obtenerVentasHoy();
      const efectivoCaja = await this.obtenerEfectivoCaja();
      const cuentasPorCobrar = await this.obtenerCuentasPorCobrar();
      const stockCritico = await this.obtenerStockCritico();

      this.stats = [
        {
          title: 'Ventas de Hoy',
          value: this.formatearMoneda(totalVentasHoy),
          change: '12.5%',
          isPositive: true,
          icon: 'fa-money-bill-wave',
          iconBg: 'bg-primary-subtle text-primary'
        },
        {
          title: 'Efectivo en Caja',
          value: this.formatearMoneda(efectivoCaja),
          change: '5.0%',
          isPositive: true,
          icon: 'fa-wallet',
          iconBg: 'bg-success-subtle text-success'
        },
        {
          title: 'Cuentas por Cobrar',
          value: this.formatearMoneda(cuentasPorCobrar),
          change: '2.1%',
          isPositive: false,
          icon: 'fa-file-invoice-dollar',
          iconBg: 'bg-warning-subtle text-warning'
        },
        {
          title: 'Stock Crítico',
          value: `${stockCritico} items`,
          change: 'Urgente',
          isPositive: false,
          icon: 'fa-box-open',
          iconBg: 'bg-danger-subtle text-danger',
          isUrgent: true
        }
      ];

      console.log('✅ Estadísticas cargadas:', this.stats);
    } catch (error) {
      console.error('❌ Error al cargar estadísticas:', error);
      // Inicializar con valores por defecto en caso de error
      this.stats = [
        {
          title: 'Ventas de Hoy',
          value: this.formatearMoneda(0),
          change: '0%',
          isPositive: true,
          icon: 'fa-money-bill-wave',
          iconBg: 'bg-primary-subtle text-primary'
        },
        {
          title: 'Efectivo en Caja',
          value: this.formatearMoneda(0),
          change: '0%',
          isPositive: true,
          icon: 'fa-wallet',
          iconBg: 'bg-success-subtle text-success'
        },
        {
          title: 'Cuentas por Cobrar',
          value: this.formatearMoneda(0),
          change: '0%',
          isPositive: false,
          icon: 'fa-file-invoice-dollar',
          iconBg: 'bg-warning-subtle text-warning'
        },
        {
          title: 'Stock Crítico',
          value: '0 items',
          change: 'OK',
          isPositive: true,
          icon: 'fa-box-open',
          iconBg: 'bg-success-subtle text-success',
          isUrgent: false
        }
      ];
    }
  }

  async obtenerVentasHoy(): Promise<number> {
    try {
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) return 0;

      const hoy = new Date().toISOString().split('T')[0];

      const { data, error } = await this.supabaseService.client
        .from('ventas')
        .select('total')
        .eq('tenant_id', tenantId)
        .gte('fecha', `${hoy}T00:00:00`)
        .lte('fecha', `${hoy}T23:59:59`)
        .eq('estado', 'completada');

      if (error) throw error;
      return data?.reduce((sum, venta) => sum + venta.total, 0) || 0;
    } catch (error) {
      console.error('Error al obtener ventas hoy:', error);
      return 0;
    }
  }

  async obtenerEfectivoCaja(): Promise<number> {
    try {
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) return 0;

      const { data, error } = await this.supabaseService.client
        .from('cajas')
        .select('monto_inicial, total_ventas_efectivo, total_entradas, total_salidas')
        .eq('tenant_id', tenantId)
        .eq('estado', 'abierta')
        .order('fecha_apertura', { ascending: false })
        .limit(1)
        .maybeSingle(); // Usar maybeSingle en lugar de single para evitar error si no hay resultados

      if (error) {
        // Si la tabla no existe o hay error de permisos
        console.warn('Error al obtener efectivo en caja:', error.message);
        return 0;
      }

      if (!data) {
        console.warn('No hay caja abierta');
        return 0;
      }

      return data.monto_inicial + data.total_ventas_efectivo + data.total_entradas - data.total_salidas;
    } catch (error) {
      console.error('Error al obtener efectivo en caja:', error);
      return 0;
    }
  }

  async obtenerCuentasPorCobrar(): Promise<number> {
    try {
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) return 0;

      const { data, error } = await this.supabaseService.client
        .from('cuentas_por_cobrar')
        .select('monto_pendiente')
        .eq('tenant_id', tenantId)
        .eq('estado', 'pendiente');

      if (error) {
        // Si la tabla no existe, retornar 0
        if (error.code === 'PGRST204' || error.code === '42P01') {
          console.warn('Tabla cuentas_por_cobrar no existe aún');
          return 0;
        }
        throw error;
      }
      return data?.reduce((sum, cuenta) => sum + cuenta.monto_pendiente, 0) || 0;
    } catch (error) {
      console.error('Error al obtener cuentas por cobrar:', error);
      return 0;
    }
  }

  async obtenerStockCritico(): Promise<number> {
    try {
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) return 0;

      const { data, error } = await this.supabaseService.client
        .from('productos')
        .select('id, stock_actual, stock_minimo')
        .eq('tenant_id', tenantId)
        .lt('stock_actual', 20);

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error al obtener stock crítico:', error);
      return 0;
    }
  }

  async cargarProductosRecientes() {
    try {
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) {
        this.topProducts = [];
        return;
      }

      const { data, error } = await this.supabaseService.client
        .from('productos')
        .select('*, categorias(nombre)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      this.topProducts = (data as any[])?.map(producto => ({
        name: producto.nombre,
        category: producto.categorias?.nombre || 'Sin categoría',
        price: this.formatearMoneda(producto.precio_venta),
        sales: `Stock: ${producto.stock_actual}`,
        initials: this.obtenerIniciales(producto.nombre)
      })) || [];

    } catch (error) {
      console.error('Error al cargar productos recientes:', error);
      this.topProducts = [];
    }
  }

  async cargarTransaccionesRecientes() {
    try {
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) {
        this.transactions = [];
        return;
      }

      const { data, error } = await this.supabaseService.client
        .from('ventas')
        .select('id, numero_venta, cliente_id, created_at, estado, total')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Obtener nombres de clientes
      const clientesIds = data?.filter(v => v.cliente_id).map(v => v.cliente_id) || [];
      const { data: clientes } = await this.supabaseService.client
        .from('clientes')
        .select('id, nombre')
        .eq('tenant_id', tenantId)
        .in('id', clientesIds);

      const clientesMap = new Map(clientes?.map(c => [c.id, c.nombre]) || []);

      this.transactions = data?.map(venta => {
        const clienteNombre = venta.cliente_id ? clientesMap.get(venta.cliente_id) || 'Cliente General' : 'Cliente General';
        return {
          id: venta.numero_venta,
          customer: clienteNombre,
          customerInitials: this.obtenerIniciales(clienteNombre),
          date: this.formatearFecha(venta.created_at),
          status: venta.estado === 'completada' ? 'completed' : 'pending',
          total: this.formatearMoneda(venta.total)
        };
      }) || [];

    } catch (error) {
      console.error('Error al cargar transacciones recientes:', error);
      this.transactions = [];
    }
  }

  async cargarDatosGrafico() {
    try {
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) {
        this.chartData = [];
        return;
      }

      const fechaFin = new Date();
      const fechaInicio = new Date();

      if (this.selectedPeriod === 'weekly') {
        fechaInicio.setDate(fechaFin.getDate() - 7);
      } else if (this.selectedPeriod === 'monthly') {
        fechaInicio.setMonth(fechaFin.getMonth() - 1);
      } else {
        fechaInicio.setFullYear(fechaFin.getFullYear() - 1);
      }

      const { data, error } = await this.supabaseService.client
        .from('ventas')
        .select('created_at, total')
        .eq('tenant_id', tenantId)
        .gte('created_at', fechaInicio.toISOString())
        .lte('created_at', fechaFin.toISOString())
        .eq('estado', 'completada')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Agrupar por día
      const ventasPorDia = new Map<string, number>();
      data?.forEach(venta => {
        const fecha = new Date(venta.created_at).toISOString().split('T')[0];
        ventasPorDia.set(fecha, (ventasPorDia.get(fecha) || 0) + venta.total);
      });

      // Calcular porcentajes para el gráfico
      const maxVenta = Math.max(...Array.from(ventasPorDia.values()));

      this.chartData = Array.from(ventasPorDia.entries()).map(([fecha, total]) => ({
        label: this.formatearDia(fecha),
        value: total,
        percentage: maxVenta > 0 ? (total / maxVenta) * 100 : 0
      }));

    } catch (error) {
      console.error('Error al cargar datos del gráfico:', error);
      this.chartData = [];
    }
  }

  async setPeriod(period: 'weekly' | 'monthly' | 'yearly') {
    this.selectedPeriod = period;
    await this.cargarDatosGrafico();
    this.cdr.detectChanges();
  }

  exportReport() {
    if (this.transactions.length === 0) {
      alert('No hay transacciones para exportar');
      return;
    }

    const datosExportar = this.transactions.map(t => ({
      'ID Transacción': t.id,
      'Cliente': t.customer,
      'Fecha': t.date,
      'Estado': t.status === 'completed' ? 'Completada' : 'Pendiente',
      'Total': t.total
    }));

    const headers = Object.keys(datosExportar[0]).join(',');
    const csvContent = datosExportar.map(row =>
      Object.values(row).join(',')
    ).join('\n');

    const csv = headers + '\n' + csvContent;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transacciones_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  viewAllItems() {
    this.router.navigate(['/inventario']);
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }

  formatearFecha(fecha: string): string {
    const date = new Date(fecha);
    return new Intl.DateTimeFormat('es-DO', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  formatearDia(fecha: string): string {
    const date = new Date(fecha);
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return dias[date.getDay()];
  }

  obtenerIniciales(nombre: string): string {
    return nombre
      .split(' ')
      .map(palabra => palabra[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  // =========================================
  // REPORTES FISCALES (DGII)
  // =========================================

  async generarReporte607() {
    // Reporte de Ventas (607)
    const { value: periodo } = await Swal.fire({
      title: 'Generar Reporte 607 (Ventas)',
      text: 'Seleccione el mes y año para el reporte fiscal',
      html: `
        <div class="d-flex gap-2 justify-content-center mt-3">
          <select id="mes_607" class="form-select">
            ${Array.from({ length: 12 }, (_, i) => `<option value="${(i + 1).toString().padStart(2, '0')}" ${new Date().getMonth() === i ? 'selected' : ''}>${new Date(0, i).toLocaleString('es', { month: 'long' })}</option>`).join('')}
          </select>
          <select id="anio_607" class="form-select">
            ${[2024, 2025, 2026].map(y => `<option value="${y}" ${new Date().getFullYear() === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Descargar CSV',
      preConfirm: () => {
        return {
          mes: (document.getElementById('mes_607') as HTMLSelectElement).value,
          anio: (document.getElementById('anio_607') as HTMLSelectElement).value
        }
      }
    });

    if (!periodo) return;

    try {
      Swal.fire({ title: 'Generando...', text: 'Buscando transacciones...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const fechaInicio = `${periodo.anio}-${periodo.mes}-01T00:00:00`;
      const ultimoDia = new Date(Number(periodo.anio), Number(periodo.mes), 0).getDate();
      const fechaFin = `${periodo.anio}-${periodo.mes}-${ultimoDia}T23:59:59`;

      const { data: ventas, error } = await this.supabaseService.client
        .from('ventas')
        .select('*')
        .gte('created_at', fechaInicio)
        .lte('created_at', fechaFin)
        .eq('estado', 'completada');

      if (error) throw error;

      if (!ventas || ventas.length === 0) {
        Swal.fire('Información', 'No hay ventas registradas para este periodo.', 'info');
        return;
      }

      // Estructura simplificada 607
      const headers = ['RNC/Cedula', 'Tipo Id', 'NCF', 'NCF Modificado', 'Tipo Ingreso', 'Fecha Factura', 'ITBIS', 'Monto Facturado', 'Efectivo', 'Tarjeta', 'Otros'];

      const csvContent = [
        headers.join(','),
        ...ventas.map(v => {
          const rnc = v.rnc_cliente || '';
          const tipoId = rnc.length === 9 ? '1' : (rnc.length === 11 ? '2' : '3');
          return [
            rnc,
            tipoId,
            v.ncf || '',
            '', // NCF Modificado
            '01', // Ingresos por operaciones (Simplificado)
            new Date(v.created_at).toISOString().split('T')[0].replace(/-/g, ''),
            (v.impuestos || 0).toFixed(2),
            (v.total || 0).toFixed(2),
            v.metodo_pago === 'efectivo' ? v.total.toFixed(2) : '0.00',
            v.metodo_pago === 'tarjeta' ? v.total.toFixed(2) : '0.00',
            (v.metodo_pago !== 'efectivo' && v.metodo_pago !== 'tarjeta') ? v.total.toFixed(2) : '0.00'
          ].join(',');
        })
      ].join('\n');

      this.descargarAchivo(csvContent, `Reporte_607_${periodo.mes}_${periodo.anio}.csv`);
      Swal.fire('¡Éxito!', 'Reporte 607 generado correctamente.', 'success');

    } catch (error) {
      console.error('Error al generar 607:', error);
      Swal.fire('Error', 'No se pudieron recuperar los datos de ventas.', 'error');
    }
  }

  async generarReporte606() {
    // Reporte de Compras (606)
    const { value: periodo } = await Swal.fire({
      title: 'Generar Reporte 606 (Compras)',
      text: 'Seleccione el mes y año para el reporte de gastos',
      html: `
        <div class="d-flex gap-2 justify-content-center mt-3">
          <select id="mes_606" class="form-select">
            ${Array.from({ length: 12 }, (_, i) => `<option value="${(i + 1).toString().padStart(2, '0')}" ${new Date().getMonth() === i ? 'selected' : ''}>${new Date(0, i).toLocaleString('es', { month: 'long' })}</option>`).join('')}
          </select>
          <select id="anio_606" class="form-select">
            ${[2024, 2025, 2026].map(y => `<option value="${y}" ${new Date().getFullYear() === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Descargar CSV',
      preConfirm: () => {
        return {
          mes: (document.getElementById('mes_606') as HTMLSelectElement).value,
          anio: (document.getElementById('anio_606') as HTMLSelectElement).value
        }
      }
    });

    if (!periodo) return;

    try {
      Swal.fire({ title: 'Generando...', text: 'Buscando gastos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const fechaInicio = `${periodo.anio}-${periodo.mes}-01T00:00:00`;
      const ultimoDia = new Date(Number(periodo.anio), Number(periodo.mes), 0).getDate();
      const fechaFin = `${periodo.anio}-${periodo.mes}-${ultimoDia}T23:59:59`;

      const { data: compras, error } = await this.supabaseService.client
        .from('compras')
        .select(`
          *,
          proveedores (rnc, nombre)
        `)
        .gte('created_at', fechaInicio)
        .lte('created_at', fechaFin)
        .neq('estado', 'cancelada');

      if (error) throw error;

      if (!compras || compras.length === 0) {
        Swal.fire('Información', 'No hay compras registradas para este periodo.', 'info');
        return;
      }

      // Estructura simplificada 606
      const headers = ['RNC/Cedula', 'Tipo Id', 'Tipo Bienes y Serv.', 'NCF', 'Fecha Factura', 'Monto Facturado', 'ITBIS Facturado', 'ITBIS Retenido', 'Monto ITBIS Proporcional', 'Monto ITBIS Costo'];

      const csvContent = [
        headers.join(','),
        ...compras.map((c: any) => {
          const rnc = c.proveedores?.rnc || '';
          const tipoId = rnc.length === 9 ? '1' : (rnc.length === 11 ? '2' : '3');
          return [
            rnc,
            tipoId,
            '01', // Gastos de Personal (Simplificado)
            c.ncf || '',
            new Date(c.fecha_compra).toISOString().split('T')[0].replace(/-/g, ''),
            (c.total || 0).toFixed(2),
            (c.impuesto || 0).toFixed(2),
            '0.00', // Retenido
            '0.00',
            (c.impuesto || 0).toFixed(2)
          ].join(',');
        })
      ].join('\n');

      this.descargarAchivo(csvContent, `Reporte_606_${periodo.mes}_${periodo.anio}.csv`);
      Swal.fire('¡Éxito!', 'Reporte 606 generado correctamente.', 'success');

    } catch (error) {
      console.error('Error al generar 606:', error);
      Swal.fire('Error', 'No se pudieron recuperar los datos de compras.', 'error');
    }
  }

  private descargarAchivo(contenido: string, nombre: string) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + contenido], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', nombre);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
