import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CuentasCobrarService } from '../../../services/cuentas-cobrar.service';
import { ClientesService } from '../../../services/clientes.service';
import { TenantService } from '../../../services/tenant.service';
import { SupabaseService } from '../../../services/supabase.service';
import { CuentaPorCobrar } from '../../../models/cuentas-cobrar.model';
import { Cliente } from '../../../models/clientes.model';

interface AgingBand {
  label: string;
  dias: string;
  minDias: number;
  maxDias: number;
  color: string;
  bgColor: string;
  monto: number;
  cuentas: CuentaConAging[];
}

interface CuentaConAging extends CuentaPorCobrar {
  dias_atraso: number;
  dias_vence: number;
}

interface ClienteAging {
  cliente_id: number;
  cliente_nombre: string;
  total_pendiente: number;
  bands: AgingBand[];
  cuentas: CuentaConAging[];
}

@Component({
  selector: 'app-estado-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ec-container">
      <!-- Header -->
      <div class="ec-header">
        <div class="ec-title">
          <h1><i class="fa-solid fa-file-invoice-dollar"></i> Estado de Cuenta</h1>
          <p>Antigüedad de saldos y cartera vencida por cliente</p>
        </div>
        <div class="ec-actions">
          <button class="btn-export" (click)="exportarCSV()" [disabled]="!clienteSeleccionado">
            <i class="fa-solid fa-file-csv"></i> Exportar
          </button>
          <button class="btn-print" (click)="imprimir()" [disabled]="!clienteSeleccionado">
            <i class="fa-solid fa-print"></i> Imprimir
          </button>
        </div>
      </div>

      <!-- Client Selector -->
      <div class="cliente-selector">
        <div class="search-wrapper">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" [(ngModel)]="busquedaCliente" (input)="filtrarClientes()"
            placeholder="Buscar cliente por nombre..." class="search-input">
        </div>
        <div class="clientes-lista" *ngIf="clientesFiltrados.length > 0 && !clienteSeleccionado">
          <div class="cliente-item" *ngFor="let c of clientesFiltrados" (click)="seleccionarCliente(c)">
            <div class="cliente-avatar">{{ (c.nombre || '?').charAt(0).toUpperCase() }}</div>
            <div>
              <div class="cliente-nombre">{{ c.nombre }}</div>
              <div class="cliente-rnc" *ngIf="c.rnc">RNC: {{ c.rnc }}</div>
            </div>
            <div class="cliente-pendiente" *ngIf="getClienteAging(c.id!)">
              {{ formatMoneda(getClienteAging(c.id!)!.total_pendiente) }}
            </div>
          </div>
        </div>
        <!-- Selected client chip -->
        <div class="cliente-chip" *ngIf="clienteSeleccionado">
          <div class="chip-avatar">{{ (clienteSeleccionado.nombre || '?').charAt(0).toUpperCase() }}</div>
          <span>{{ clienteSeleccionado.nombre || '' }}</span>
          <span class="chip-rnc" *ngIf="clienteSeleccionado.rnc">· RNC {{ clienteSeleccionado.rnc }}</span>
          <button class="chip-clear" (click)="limpiarCliente()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div class="ec-loading" *ngIf="isLoading">
        <div class="spinner"></div>
        <span>Cargando estado de cuenta...</span>
      </div>

      <!-- Content: selected client -->
      <div class="ec-content" *ngIf="clienteSeleccionado && agingCliente && !isLoading">

        <!-- Summary Cards -->
        <div class="summary-cards">
          <div class="scard total">
            <div class="scard-icon"><i class="fa-solid fa-circle-dollar-to-slot"></i></div>
            <div class="scard-data">
              <span class="scard-label">Total Pendiente</span>
              <span class="scard-valor">{{ formatMoneda(agingCliente.total_pendiente) }}</span>
            </div>
          </div>
          <div class="scard corriente">
            <div class="scard-icon"><i class="fa-solid fa-circle-check"></i></div>
            <div class="scard-data">
              <span class="scard-label">Corriente (0-30d)</span>
              <span class="scard-valor">{{ formatMoneda(getBandMonto(0, 30)) }}</span>
            </div>
          </div>
          <div class="scard vencido">
            <div class="scard-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="scard-data">
              <span class="scard-label">Vencido (31-90d)</span>
              <span class="scard-valor">{{ formatMoneda(getBandMonto(31, 90)) }}</span>
            </div>
          </div>
          <div class="scard critico">
            <div class="scard-icon"><i class="fa-solid fa-circle-xmark"></i></div>
            <div class="scard-data">
              <span class="scard-label">Crítico (+90d)</span>
              <span class="scard-valor">{{ formatMoneda(getBandMonto(91, 9999)) }}</span>
            </div>
          </div>
        </div>

        <!-- Aging Bands Visual -->
        <div class="aging-bands-card">
          <h3 class="section-title">Antigüedad de Saldos</h3>
          <div class="bands-list">
            <div class="band-row" *ngFor="let band of agingBands">
              <div class="band-label">
                <span class="band-dot" [style.background]="band.color"></span>
                {{ band.label }}
                <span class="band-dias">{{ band.dias }}</span>
              </div>
              <div class="band-bar-wrap">
                <div class="band-bar">
                  <div class="band-fill"
                    [style.width.%]="getBandPercent(band.monto)"
                    [style.background]="band.color">
                  </div>
                </div>
              </div>
              <div class="band-monto" [style.color]="band.monto > 0 ? band.color : '#94a3b8'">
                {{ formatMoneda(band.monto) }}
              </div>
              <div class="band-pct">{{ getBandPercent(band.monto).toFixed(0) }}%</div>
            </div>
          </div>
        </div>

        <!-- Invoice Table -->
        <div class="invoices-card">
          <h3 class="section-title">Detalle de Facturas</h3>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha Venta</th>
                  <th>Vence</th>
                  <th class="num">Total</th>
                  <th class="num">Pagado</th>
                  <th class="num">Pendiente</th>
                  <th>Antigüedad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let c of agingCliente.cuentas" [class.row-critico]="c.dias_atraso > 90"
                    [class.row-vencido]="c.dias_atraso > 30 && c.dias_atraso <= 90"
                    [class.row-riesgo]="c.dias_atraso > 0 && c.dias_atraso <= 30">
                  <td class="factura-id">#{{ c.venta_id }}</td>
                  <td>{{ formatFecha(c.fecha_venta) }}</td>
                  <td>{{ formatFecha(c.fecha_vencimiento) }}</td>
                  <td class="num">{{ formatMoneda(c.monto_total) }}</td>
                  <td class="num text-success">{{ formatMoneda(c.monto_pagado) }}</td>
                  <td class="num fw-bold">{{ formatMoneda(c.monto_pendiente) }}</td>
                  <td>
                    <span class="dias-badge"
                      [class.dias-ok]="c.dias_atraso <= 0"
                      [class.dias-warn]="c.dias_atraso > 0 && c.dias_atraso <= 30"
                      [class.dias-danger]="c.dias_atraso > 30 && c.dias_atraso <= 90"
                      [class.dias-critico]="c.dias_atraso > 90">
                      <ng-container *ngIf="c.dias_atraso <= 0">
                        <i class="fa-solid fa-clock-rotate-left"></i> Vence en {{ -c.dias_atraso }}d
                      </ng-container>
                      <ng-container *ngIf="c.dias_atraso > 0">
                        <i class="fa-solid fa-triangle-exclamation"></i> {{ c.dias_atraso }}d atraso
                      </ng-container>
                    </span>
                  </td>
                  <td>
                    <span class="estado-badge" [class]="getEstadoClass(c.estado)">
                      {{ c.estado | titlecase }}
                    </span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="totals">
                  <td colspan="3"><strong>TOTALES</strong></td>
                  <td class="num"><strong>{{ formatMoneda(getTotalFacturado()) }}</strong></td>
                  <td class="num text-success"><strong>{{ formatMoneda(getTotalPagado()) }}</strong></td>
                  <td class="num"><strong>{{ formatMoneda(agingCliente.total_pendiente) }}</strong></td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- Global Aging (no client selected) -->
      <div class="ec-global" *ngIf="!clienteSeleccionado && !isLoading && agingGlobal.length > 0">
        <h3 class="section-title">Resumen de Cartera — Todos los Clientes</h3>
        <div class="global-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th class="num">Total Pendiente</th>
                <th class="num">Corriente</th>
                <th class="num">31-60 días</th>
                <th class="num">61-90 días</th>
                <th class="num">+90 días</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of agingGlobal" [class.row-critico]="getClienteCritico(a) > 0">
                <td class="cliente-cell">
                  <div class="mini-avatar">{{ a.cliente_nombre.charAt(0) }}</div>
                  {{ a.cliente_nombre }}
                </td>
                <td class="num fw-bold">{{ formatMoneda(a.total_pendiente) }}</td>
                <td class="num text-success">{{ formatMoneda(getClienteBand(a, 0, 30)) }}</td>
                <td class="num" [class.text-warning]="getClienteBand(a, 31, 60) > 0">
                  {{ formatMoneda(getClienteBand(a, 31, 60)) }}</td>
                <td class="num" [class.text-danger]="getClienteBand(a, 61, 90) > 0">
                  {{ formatMoneda(getClienteBand(a, 61, 90)) }}</td>
                <td class="num fw-bold" [class.text-danger]="getClienteCritico(a) > 0">
                  {{ formatMoneda(getClienteCritico(a)) }}</td>
                <td>
                  <button class="btn-ver" (click)="verCliente(a)">
                    <i class="fa-solid fa-eye"></i> Ver Estado
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!isLoading && agingGlobal.length === 0 && !clienteSeleccionado">
        <i class="fa-solid fa-inbox fa-3x"></i>
        <p>No hay facturas pendientes de cobro</p>
      </div>
    </div>
  `,
  styleUrls: ['./estado-cuenta.component.css']
})
export class EstadoCuentaComponent implements OnInit {
  // Data
  todasLasCuentas: CuentaConAging[] = [];
  agingGlobal: ClienteAging[] = [];
  clienteSeleccionado: Partial<Cliente> | null = null;
  agingCliente: ClienteAging | null = null;
  isLoading = true;

  // Client search
  busquedaCliente = '';
  todosLosClientes: Partial<Cliente>[] = [];
  clientesFiltrados: Partial<Cliente>[] = [];

  // Aging bands config
  agingBands: AgingBand[] = [
    { label: 'Corriente', dias: '0-30 días', minDias: 0, maxDias: 30, color: '#16a34a', bgColor: '#f0fdf4', monto: 0, cuentas: [] },
    { label: 'En riesgo', dias: '31-60 días', minDias: 31, maxDias: 60, color: '#f59e0b', bgColor: '#fffbeb', monto: 0, cuentas: [] },
    { label: 'Vencido', dias: '61-90 días', minDias: 61, maxDias: 90, color: '#ef4444', bgColor: '#fef2f2', monto: 0, cuentas: [] },
    { label: 'Crítico', dias: '+90 días', minDias: 91, maxDias: 9999, color: '#991b1b', bgColor: '#fef2f2', monto: 0, cuentas: [] }
  ];

  constructor(
    private cuentasService: CuentasCobrarService,
    private supabase: SupabaseService,
    private tenantService: TenantService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    await this.cargarDatos();
  }

  async cargarDatos() {
    this.isLoading = true;
    try {
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) {
        this.isLoading = false;
        this.cdr.detectChanges();
        return;
      }

      // Load all pending accounts with client data
      const { data, error } = await this.supabase.client
        .from('cuentas_por_cobrar')
        .select('*, clientes(nombre, rnc)')
        .eq('tenant_id', tenantId)
        .neq('estado', 'pagada')
        .order('fecha_vencimiento', { ascending: true });

      if (error) throw error;

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      this.todasLasCuentas = (data || []).map((c: any) => {
        const vencimiento = new Date(c.fecha_vencimiento);
        vencimiento.setHours(0, 0, 0, 0);
        const diffMs = hoy.getTime() - vencimiento.getTime();
        const dias_atraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return {
          ...c,
          cliente_nombre: c.clientes?.nombre || 'Sin nombre',
          dias_atraso,
          dias_vence: -dias_atraso
        };
      });

      // Group by client
      this.buildAgingGlobal();

      // Load clients for search
      const { data: clientes } = await this.supabase.client
        .from('clientes')
        .select('id, nombre, rnc, cedula')
        .eq('tenant_id', tenantId)
        .eq('activo', true)
        .order('nombre');
      this.todosLosClientes = clientes || [];

    } catch (err: any) {
      console.error('Error cargando estado de cuenta:', err);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  buildAgingGlobal() {
    const map = new Map<number, ClienteAging>();

    this.todasLasCuentas.forEach(c => {
      if (!map.has(c.cliente_id)) {
        map.set(c.cliente_id, {
          cliente_id: c.cliente_id,
          cliente_nombre: (c.cliente_nombre as string) || 'Sin nombre',
          total_pendiente: 0,
          bands: this.agingBands.map(b => ({ ...b, monto: 0, cuentas: [] })),
          cuentas: []
        });
      }
      const ag = map.get(c.cliente_id)!;
      ag.total_pendiente += c.monto_pendiente;
      ag.cuentas.push(c);

      // Place in appropriate band
      const diasAtraso = Math.max(0, c.dias_atraso);
      const band = ag.bands.find(b => diasAtraso >= b.minDias && diasAtraso <= b.maxDias);
      if (band) { band.monto += c.monto_pendiente; band.cuentas.push(c); }
    });

    this.agingGlobal = Array.from(map.values()).sort((a, b) => b.total_pendiente - a.total_pendiente);
  }

  // =================== SEARCH + SELECTION ===================
  filtrarClientes() {
    if (!this.busquedaCliente.trim()) { this.clientesFiltrados = []; return; }
    const q = this.busquedaCliente.toLowerCase();
    this.clientesFiltrados = this.todosLosClientes.filter(c =>
      c.nombre?.toLowerCase().includes(q) || c.rnc?.includes(q) || c.cedula?.includes(q)
    ).slice(0, 8);
  }

  seleccionarCliente(cliente: Partial<Cliente>) {
    this.clienteSeleccionado = cliente;
    this.busquedaCliente = '';
    this.clientesFiltrados = [];
    const ag = this.agingGlobal.find(a => a.cliente_id === cliente.id);
    if (ag) {
      this.agingCliente = ag;
      this.calcularBands(ag);
    } else {
      this.agingCliente = { cliente_id: cliente.id!, cliente_nombre: cliente.nombre || '', total_pendiente: 0, bands: this.agingBands.map(b => ({ ...b, monto: 0, cuentas: [] })), cuentas: [] };
    }
    this.cdr.detectChanges();
  }

  calcularBands(ag: ClienteAging) {
    this.agingBands.forEach((band, i) => {
      band.monto = ag.bands[i]?.monto || 0;
    });
  }

  verCliente(ag: ClienteAging) {
    const cliente = this.todosLosClientes.find(c => c.id === ag.cliente_id);
    if (cliente) this.seleccionarCliente(cliente);
    else {
      this.clienteSeleccionado = { id: ag.cliente_id, nombre: ag.cliente_nombre };
      this.agingCliente = ag;
      this.calcularBands(ag);
    }
  }

  limpiarCliente() {
    this.clienteSeleccionado = null;
    this.agingCliente = null;
    this.busquedaCliente = '';
  }

  getClienteAging(id: number): ClienteAging | undefined {
    return this.agingGlobal.find(a => a.cliente_id === id);
  }

  // =================== CALCULATIONS ===================
  getBandMonto(min: number, max: number): number {
    return this.agingCliente?.cuentas
      .filter(c => { const d = Math.max(0, c.dias_atraso); return d >= min && d <= max; })
      .reduce((s, c) => s + c.monto_pendiente, 0) || 0;
  }

  getBandPercent(monto: number): number {
    if (!this.agingCliente || this.agingCliente.total_pendiente === 0) return 0;
    return (monto / this.agingCliente.total_pendiente) * 100;
  }

  getClienteBand(ag: ClienteAging, min: number, max: number): number {
    return ag.cuentas.filter(c => { const d = Math.max(0, c.dias_atraso); return d >= min && d <= max; })
      .reduce((s, c) => s + c.monto_pendiente, 0);
  }

  getClienteCritico(ag: ClienteAging): number {
    return ag.cuentas.filter(c => c.dias_atraso > 90).reduce((s, c) => s + c.monto_pendiente, 0);
  }

  getTotalFacturado(): number {
    return this.agingCliente?.cuentas.reduce((s, c) => s + c.monto_total, 0) || 0;
  }

  getTotalPagado(): number {
    return this.agingCliente?.cuentas.reduce((s, c) => s + c.monto_pagado, 0) || 0;
  }

  getEstadoClass(estado: string): string {
    const m: Record<string, string> = {
      pendiente: 'badge-warn', parcial: 'badge-info', vencida: 'badge-danger', pagada: 'badge-ok'
    };
    return 'estado-badge ' + (m[estado] || 'badge-sec');
  }

  formatMoneda(v: number): string {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(v);
  }

  formatFecha(f: string): string {
    return new Date(f).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // =================== EXPORT ===================
  exportarCSV() {
    if (!this.agingCliente) return;
    const headers = 'Factura,Fecha Venta,Fecha Vencimiento,Total,Pagado,Pendiente,Días Atraso,Estado';
    const rows = this.agingCliente.cuentas.map(c =>
      `${c.venta_id},${c.fecha_venta},${c.fecha_vencimiento},${c.monto_total.toFixed(2)},${c.monto_pagado.toFixed(2)},${c.monto_pendiente.toFixed(2)},${c.dias_atraso},"${c.estado}"`
    ).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `estado_cuenta_${(this.clienteSeleccionado?.nombre ?? 'cliente').replace(/ /g, '_')}.csv`;
    a.click();
  }

  imprimir() { window.print(); }
}
