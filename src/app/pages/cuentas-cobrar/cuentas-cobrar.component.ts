import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CuentaPorCobrar } from '../../models/cuentas-cobrar.model';
import { CuentasCobrarService } from '../../services/cuentas-cobrar.service';
import { ModalPagoMasivoComponent } from './modal-pago-masivo/modal-pago-masivo.component';
import { HistorialPagosComponent } from './historial-pagos/historial-pagos.component';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

// Interfaz para agrupar cuentas por cliente
export interface ClienteDeudor {
  clienteId: number;
  clienteNombre: string;
  cantidadFacturas: number;
  montoTotal: number;
  montoPagado: number;
  montoPendiente: number;
  fechaMasAntigua: string;
  fechaVencimientoMasAntigua: string;
  estadoPeor: 'pendiente' | 'parcial' | 'pagada' | 'vencida';
  cuentas: CuentaPorCobrar[]; // todas sus facturas activas
}

@Component({
  selector: 'app-cuentas-cobrar',
  imports: [CommonModule, FormsModule, RouterModule, ModalPagoMasivoComponent, HistorialPagosComponent],
  templateUrl: './cuentas-cobrar.component.html',
  styleUrl: './cuentas-cobrar.component.css'
})
export class CuentasCobrarComponent implements OnInit, OnDestroy {
  cuentas: CuentaPorCobrar[] = [];
  isLoading = true;
  vistaActual: 'tarjetas' | 'tabla' = 'tarjetas';
  busqueda: string = '';
  filtroEstado: string = 'todas';

  // Clientes agrupados (fuente principal de la vista)
  clientesDeudores: ClienteDeudor[] = [];
  clientesFiltrados: ClienteDeudor[] = [];

  // Modal pago masivo
  isModalPagoMasivoOpen = false;
  pagoMasivoClienteNombre = '';
  pagoMasivoClienteId = 0;
  pagoMasivoCuentas: CuentaPorCobrar[] = [];

  // Historial (por factura individual)
  isHistorialOpen = false;
  cuentaIdHistorial?: number;

  // Detalle de cliente (expandir sus facturas)
  clienteDetalleId: number | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private cuentasService: CuentasCobrarService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  ngOnInit() {
    const cuentasSub = this.cuentasService.cuentas$.subscribe(cuentas => {
      this.cuentas = cuentas;
      this.agruparPorCliente();
      this.aplicarFiltros();
      this.isLoading = false;
      this.cdr.detectChanges();
    });
    this.subscriptions.push(cuentasSub);

    const navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.router.url === '/cuentas-cobrar') {
          this.cargarCuentas();
        }
      });
    this.subscriptions.push(navSub);

    this.cargarCuentas();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarCuentas() {
    this.isLoading = true;
    this.cdr.detectChanges();
    try {
      await this.cuentasService.cargarCuentas();
    } catch (error) {
      console.error('Error al cargar cuentas:', error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
      setTimeout(() => this.cdr.detectChanges(), 100);
    }
  }

  // ==================== AGRUPACIÓN POR CLIENTE ====================

  agruparPorCliente() {
    const mapa = new Map<number, ClienteDeudor>();

    // Solo cuentas no pagadas
    const cuentasActivas = this.cuentas.filter(c => c.estado !== 'pagada' && c.monto_pendiente > 0);

    for (const c of cuentasActivas) {
      const existing = mapa.get(c.cliente_id);
      if (existing) {
        existing.cantidadFacturas++;
        existing.montoTotal += c.monto_total;
        existing.montoPagado += c.monto_pagado;
        existing.montoPendiente += c.monto_pendiente;
        existing.cuentas.push(c);
        // Fecha más antigua
        if (new Date(c.fecha_venta) < new Date(existing.fechaMasAntigua)) {
          existing.fechaMasAntigua = c.fecha_venta;
        }
        // Vencimiento más urgente
        if (new Date(c.fecha_vencimiento) < new Date(existing.fechaVencimientoMasAntigua)) {
          existing.fechaVencimientoMasAntigua = c.fecha_vencimiento;
        }
        // Estado peor
        existing.estadoPeor = this.estadoPeor(existing.estadoPeor, c.estado);
      } else {
        mapa.set(c.cliente_id, {
          clienteId: c.cliente_id,
          clienteNombre: c.cliente_nombre || 'Sin nombre',
          cantidadFacturas: 1,
          montoTotal: c.monto_total,
          montoPagado: c.monto_pagado,
          montoPendiente: c.monto_pendiente,
          fechaMasAntigua: c.fecha_venta,
          fechaVencimientoMasAntigua: c.fecha_vencimiento,
          estadoPeor: c.estado,
          cuentas: [c]
        });
      }
    }

    // Ordenar cuentas internas por fecha de venta (FIFO: más antiguas primero)
    mapa.forEach(deudor => {
      deudor.cuentas.sort((a, b) => new Date(a.fecha_venta).getTime() - new Date(b.fecha_venta).getTime());
    });

    // Lista de clientes ordenada por monto pendiente descendente
    this.clientesDeudores = Array.from(mapa.values())
      .sort((a, b) => b.montoPendiente - a.montoPendiente);
  }

  private estadoPeor(
    actual: 'pendiente' | 'parcial' | 'pagada' | 'vencida',
    nuevo: 'pendiente' | 'parcial' | 'pagada' | 'vencida'
  ): 'pendiente' | 'parcial' | 'pagada' | 'vencida' {
    const prioridad = { vencida: 4, pendiente: 3, parcial: 2, pagada: 1 };
    return prioridad[nuevo] > prioridad[actual] ? nuevo : actual;
  }

  // ==================== FILTROS ====================

  aplicarFiltros() {
    let resultado = this.clientesDeudores;

    if (this.filtroEstado !== 'todas') {
      resultado = resultado.filter(cd => cd.estadoPeor === this.filtroEstado);
    }

    if (this.busqueda.trim()) {
      const q = this.busqueda.toLowerCase();
      resultado = resultado.filter(cd =>
        cd.clienteNombre.toLowerCase().includes(q)
      );
    }

    this.clientesFiltrados = resultado;
  }

  onBusquedaChange() { this.aplicarFiltros(); }
  cambiarFiltro(estado: string) {
    this.filtroEstado = estado;
    this.aplicarFiltros();
  }

  // ==================== DETALLE INLINE ====================

  toggleDetalle(clienteId: number) {
    this.clienteDetalleId = this.clienteDetalleId === clienteId ? null : clienteId;
  }

  // ==================== PAGO MASIVO ====================

  abrirPagoMasivo(deudor: ClienteDeudor) {
    this.pagoMasivoClienteNombre = deudor.clienteNombre;
    this.pagoMasivoClienteId = deudor.clienteId;
    this.pagoMasivoCuentas = deudor.cuentas; // ya vienen ordenadas FIFO
    this.isModalPagoMasivoOpen = true;
  }

  cerrarPagoMasivo() {
    this.isModalPagoMasivoOpen = false;
    this.pagoMasivoCuentas = [];
  }

  onPagoMasivoRegistrado() {
    this.cerrarPagoMasivo();
  }

  // ==================== HISTORIAL ====================

  abrirHistorial(cuentaId: number) {
    this.cuentaIdHistorial = cuentaId;
    this.isHistorialOpen = true;
  }

  cerrarHistorial() {
    this.isHistorialOpen = false;
    this.cuentaIdHistorial = undefined;
  }

  // ==================== GETTERS ====================

  get totalPendiente(): number {
    return this.cuentas
      .filter(c => c.estado !== 'pagada')
      .reduce((s, c) => s + c.monto_pendiente, 0);
  }

  get totalVencido(): number {
    return this.cuentas
      .filter(c => c.estado === 'vencida')
      .reduce((s, c) => s + c.monto_pendiente, 0);
  }

  get cuentasVencidasCount(): number {
    return this.clientesDeudores.filter(cd => cd.estadoPeor === 'vencida').length;
  }

  get clientesPendientesCount(): number {
    return this.clientesDeudores.filter(cd => cd.estadoPeor !== 'pagada').length;
  }

  // ==================== HELPERS ====================

  getEstadoBadgeClass(estado: string): string {
    const base = 'badge rounded-pill ';
    switch (estado) {
      case 'pagada':    return base + 'bg-success-subtle text-success border border-success-subtle';
      case 'pendiente': return base + 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      case 'parcial':   return base + 'bg-info-subtle text-info-emphasis border border-info-subtle';
      case 'vencida':   return base + 'bg-danger-subtle text-danger border border-danger-subtle';
      default:          return base + 'bg-secondary-subtle text-secondary border border-secondary-subtle';
    }
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-DO', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  diasVencimiento(fechaVencimiento: string): number {
    const diff = new Date(fechaVencimiento).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  exportarDatos() {
    if (this.clientesFiltrados.length === 0) { alert('No hay datos para exportar'); return; }
    const rows = this.clientesFiltrados.map(cd => ({
      Cliente: cd.clienteNombre,
      Facturas: cd.cantidadFacturas,
      'Total Deuda': cd.montoPendiente,
      'Fecha Más Antigua': cd.fechaMasAntigua,
      'Vencimiento Más Urgente': cd.fechaVencimientoMasAntigua,
      Estado: cd.estadoPeor
    }));
    const csv = Object.keys(rows[0]).join(',') + '\n' +
      rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cuentas_cobrar_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }
}
