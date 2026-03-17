import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { VentasService } from '../../../services/ventas.service';
import { FiscalService } from '../../../services/fiscal.service';
import { Venta, VentaCompleta } from '../../../models/ventas.model';
import { PrintService } from '../../../services/print.service';
import { TIPOS_COMPROBANTE } from '../../../models/fiscal.model';
import { ModalNotaCreditoComponent } from '../notas-credito/modal-nota-credito.component';
import { ModalConduceComponent } from '../modal-conduce/modal-conduce.component';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-historial-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalConduceComponent],
  templateUrl: './historial-ventas.component.html',
  styleUrl: './historial-ventas.component.css'
})
export class HistorialVentasComponent implements OnInit, OnDestroy {
  ventas: Venta[] = [];
  ventasFiltradas: Venta[] = [];
  ventaSeleccionada?: VentaCompleta;

  busqueda: string = '';
  filtroMetodoPago: string = 'todos';
  filtroEstado: string = 'todos';
  filtroTipoNCF: string = 'todos';
  fechaInicio: string = '';
  fechaFin: string = '';

  totalVentas: number = 0;
  totalEfectivo: number = 0;
  totalTarjeta: number = 0;
  totalCredito: number = 0;
  totalITBIS: number = 0;

  mostrarDetalles: boolean = false;
  mostrarFiltros: boolean = false;
  modoFiscalActivo: boolean = false;
  isLoading: boolean = true;

  // Nota de Crédito modal
  mostrarNotaCredito = false;
  ventaIdNotaCredito?: number;

  // Conduce de salida
  mostrarConduce = false;
  conduceVenta?: VentaCompleta;

  tiposNcf = TIPOS_COMPROBANTE;

  private subscriptions: Subscription[] = [];

  constructor(
    private ventasService: VentasService,
    private fiscalService: FiscalService,
    private printService: PrintService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.isLoading = true;
    this.inicializarFechas();

    // Suscribirse al estado fiscal
    const fiscalSub = this.fiscalService.config$.subscribe(cfg => {
      this.modoFiscalActivo = cfg?.modo_fiscal ?? false;
      this.cdr.detectChanges();
    });

    // Suscribirse al observable de ventas
    const ventasSub = this.ventasService.ventas$.subscribe(ventas => {
      console.log('📊 Recibiendo ventas en historial:', ventas.length);
      this.ventas = ventas;
      this.aplicarFiltros();
      this.calcularEstadisticas();

      // Si ya tenemos datos, quitamos el loading
      if (ventas.length > 0) {
        this.isLoading = false;
      }
      this.cdr.detectChanges();
    });

    this.subscriptions.push(fiscalSub, ventasSub);

    // Cargar datos en segundo plano (sin bloquear ngOnInit)
    this.cargarVentas().finally(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    });

    // Recargar en navegación
    const navSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      if (event.url.includes('/ventas/historial')) {
        this.cargarVentas();
      }
    });

    this.subscriptions.push(navSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  inicializarFechas() {
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);

    this.fechaFin = hoy.toISOString().split('T')[0];
    this.fechaInicio = hace30Dias.toISOString().split('T')[0];
  }

  async cargarVentas() {
    try {
      await this.ventasService.cargarVentas(500);
    } catch (error) {
      console.error('Error al cargar ventas:', error);
    }
  }

  aplicarFiltros() {
    let resultado = [...this.ventas];

    if (this.busqueda.trim()) {
      const busqueda = this.busqueda.toLowerCase();
      resultado = resultado.filter(v =>
        (v.numero_venta || '').toLowerCase().includes(busqueda) ||
        (v.ncf || '').toLowerCase().includes(busqueda) ||
        (v.rnc_cliente || '').toLowerCase().includes(busqueda)
      );
    }

    if (this.filtroMetodoPago !== 'todos') {
      resultado = resultado.filter(v => v.metodo_pago === this.filtroMetodoPago);
    }

    if (this.filtroEstado !== 'todos') {
      resultado = resultado.filter(v => v.estado === this.filtroEstado);
    }

    // Filtro por tipo NCF (solo activo en modo fiscal)
    if (this.filtroTipoNCF !== 'todos') {
      resultado = resultado.filter(v => v.tipo_ncf === this.filtroTipoNCF);
    }

    if (this.fechaInicio && this.fechaFin) {
      resultado = resultado.filter(v => {
        const fechaVenta = new Date(v.created_at || '').toISOString().split('T')[0];
        return fechaVenta >= this.fechaInicio && fechaVenta <= this.fechaFin;
      });
    }

    this.ventasFiltradas = resultado;
    this.calcularEstadisticas();
  }

  calcularEstadisticas() {
    const ventasCompletadas = this.ventasFiltradas.filter(v => v.estado === 'completada');

    this.totalVentas = ventasCompletadas.reduce((sum, v) => sum + v.total, 0);
    this.totalEfectivo = ventasCompletadas
      .filter(v => v.metodo_pago === 'efectivo')
      .reduce((sum, v) => sum + v.total, 0);
    this.totalTarjeta = ventasCompletadas
      .filter(v => v.metodo_pago === 'tarjeta')
      .reduce((sum, v) => sum + v.total, 0);
    this.totalCredito = ventasCompletadas
      .filter(v => v.metodo_pago === 'credito')
      .reduce((sum, v) => sum + v.total, 0);
    this.totalITBIS = ventasCompletadas
      .reduce((sum, v) => sum + (v.impuestos || 0), 0);
  }

  async verDetalles(venta: Venta) {
    try {
      const ventaCompleta = await this.ventasService.obtenerVentaCompleta(venta.id!);
      if (ventaCompleta) {
        this.ventaSeleccionada = ventaCompleta;
        this.mostrarDetalles = true;
      }
    } catch (error) {
      console.error('Error al cargar detalles:', error);
    }
  }

  cerrarDetalles() {
    this.mostrarDetalles = false;
    this.ventaSeleccionada = undefined;
    this.cdr.detectChanges();
  }

  abrirConduce(venta: VentaCompleta) {
    this.conduceVenta = venta;
    this.mostrarConduce = true;
    this.cdr.detectChanges();
  }

  cerrarConduce() {
    this.mostrarConduce = false;
    this.conduceVenta = undefined;
    this.cdr.detectChanges();
  }

  async cancelarVenta(venta: Venta) {
    const result = await Swal.fire({
      title: '¿Anular factura?',
      text: `¿Estás seguro de cancelar la venta ${venta.numero_venta}? Esta acción revertirá el stock y el balance del cliente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'No, mantener',
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    try {
      // Mostrar loading
      Swal.fire({
        title: 'Anulando...',
        text: 'Por favor espere',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      await this.ventasService.cancelarVenta(venta.id!);

      await Swal.fire({
        title: '¡Anulada!',
        text: 'La venta ha sido cancelada exitosamente.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

      await this.cargarVentas();
      this.cerrarDetalles();
    } catch (error) {
      console.error('Error al cancelar venta:', error);
      Swal.fire({
        title: 'Error',
        text: 'No se pudo anular la factura. Intente de nuevo.',
        icon: 'error'
      });
    }
  }

  async imprimirFactura(venta: Venta, formato: '80mm' | '58mm' | 'A4' = '80mm') {
    if (!venta.id) return;
    try {
      Swal.fire({
        title: 'Preparando ticket...',
        text: 'Cargando detalle de la factura.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      const ventaCompleta = await this.ventasService.obtenerVentaCompleta(venta.id);
      Swal.close();

      if (ventaCompleta) {
        this.printService.imprimirTicket(ventaCompleta, undefined, formato);
      } else {
        throw new Error('No se encontró el detalle de la factura');
      }
    } catch (error) {
      console.error('Error al imprimir', error);
      Swal.fire('Error', 'No se pudo cargar la factura para imprimir.', 'error');
    }
  }

  abrirNotaCredito(venta: Venta) {
    this.ventaIdNotaCredito = venta.id!;
    this.mostrarNotaCredito = true;
  }

  cerrarNotaCredito() {
    this.mostrarNotaCredito = false;
    this.ventaIdNotaCredito = undefined;
  }

  onNotaCreadaExitosa() {
    this.cerrarNotaCredito();
    this.cerrarDetalles();
    this.cargarVentas();
  }

  exportarCSV() {
    if (this.ventasFiltradas.length === 0) {
      Swal.fire({
        title: 'Sin datos',
        text: 'No hay ventas para exportar en el rango seleccionado.',
        icon: 'info'
      });
      return;
    }

    const headers = ['Fecha', 'Factura', 'NCF', 'Tipo NCF', 'RNC Cliente', 'Método Pago', 'Subtotal', 'Descuento', 'ITBIS', 'Total', 'Estado'];
    const rows = this.ventasFiltradas.map(v => [
      new Date(v.created_at || '').toLocaleDateString('es-DO'),
      v.numero_venta,
      v.ncf || '',
      v.tipo_ncf || '',
      v.rnc_cliente || '',
      v.metodo_pago,
      v.subtotal.toFixed(2),
      v.descuento.toFixed(2),
      v.impuestos.toFixed(2),
      v.total.toFixed(2),
      v.estado
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `ventas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  limpiarFiltros() {
    this.busqueda = '';
    this.filtroMetodoPago = 'todos';
    this.filtroEstado = 'todos';
    this.filtroTipoNCF = 'todos';
    this.inicializarFechas();
    this.aplicarFiltros();
  }

  toggleFiltros() {
    this.mostrarFiltros = !this.mostrarFiltros;
  }

  getColorMetodoPago(metodo: string): string {
    const colores: { [key: string]: string } = {
      'efectivo': 'green',
      'tarjeta': 'blue',
      'credito': 'orange',
      'mixto': 'purple'
    };
    return colores[metodo] || 'gray';
  }

  getColorEstado(estado: string): string {
    return estado === 'completada' ? 'green' : 'red';
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
