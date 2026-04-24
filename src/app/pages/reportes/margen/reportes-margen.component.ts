import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../services/supabase.service';
import { TenantService } from '../../../services/tenant.service';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProductoMargen {
  producto_id: number;
  producto_nombre: string;
  precio_compra: number;
  precio_venta: number;
  cantidad_vendida: number;
  total_vendido: number;
  costo_total: number;
  ganancia: number;
  margen_porcentaje: number;
}

@Component({
  selector: 'app-reportes-margen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="margen-container">
      <div class="margen-header">
        <div>
          <h1><i class="fa-solid fa-chart-pie"></i> Reporte de Márgenes de Ganancia</h1>
          <p class="subtitle">Análisis de beneficio por producto basado en ventas realizadas</p>
        </div>
      </div>

      <!-- Filtros -->
      <div class="filtros-bar">
        <div class="filtro-grupo">
          <label>Desde</label>
          <input type="date" [(ngModel)]="fechaInicio" (change)="limpiarDatos()">
        </div>
        <div class="filtro-grupo">
          <label>Hasta</label>
          <input type="date" [(ngModel)]="fechaFin" (change)="limpiarDatos()">
        </div>
        <div class="filtro-grupo">
          <label>Ordenar por</label>
          <select [(ngModel)]="ordenarPor" (change)="ordenarProductos()">
            <option value="ganancia_desc">Mayor Ganancia</option>
            <option value="ganancia_asc">Menor Ganancia</option>
            <option value="margen_desc">Mayor Margen %</option>
            <option value="margen_asc">Menor Margen %</option>
            <option value="cantidad_desc">Más Vendidos</option>
            <option value="nombre_asc">Nombre A-Z</option>
          </select>
        </div>
        <button class="btn-generar" (click)="generarReporte()" [disabled]="isLoading">
          <i class="fa-solid" [class.fa-spinner]="isLoading" [class.fa-rotate]="isLoading" [class.fa-magnifying-glass-chart]="!isLoading"></i>
          {{ isLoading ? 'Cargando...' : 'Generar Reporte' }}
        </button>
        <button class="btn-exportar" (click)="exportarCSV()" [disabled]="productos.length === 0">
          <i class="fa-solid fa-file-csv"></i> CSV
        </button>
        <button class="btn-exportar-pdf" (click)="exportarPDF()" [disabled]="productos.length === 0">
          <i class="fa-solid fa-file-pdf"></i> PDF
        </button>
      </div>

      <!-- Resumen Cards -->
      <div class="resumen-cards" *ngIf="productos.length > 0">
        <div class="card-resumen ingresos">
          <i class="fa-solid fa-coins"></i>
          <div>
            <span class="label">Total Vendido</span>
            <span class="valor">{{ formatMoneda(totalVendido) }}</span>
          </div>
        </div>
        <div class="card-resumen costos">
          <i class="fa-solid fa-boxes-stacked"></i>
          <div>
            <span class="label">Costo Total</span>
            <span class="valor">{{ formatMoneda(costoTotal) }}</span>
          </div>
        </div>
        <div class="card-resumen ganancia">
          <i class="fa-solid fa-arrow-trend-up"></i>
          <div>
            <span class="label">Ganancia Neta</span>
            <span class="valor">{{ formatMoneda(gananciaNeta) }}</span>
          </div>
        </div>
        <div class="card-resumen margen">
          <i class="fa-solid fa-percent"></i>
          <div>
            <span class="label">Margen Promedio</span>
            <span class="valor">{{ margenPromedio.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <!-- Tabla de Productos -->
      <div class="tabla-container" *ngIf="productos.length > 0">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Producto</th>
              <th class="num">P. Compra</th>
              <th class="num">P. Venta</th>
              <th class="num">Unidades</th>
              <th class="num">Total Vendido</th>
              <th class="num">Costo Total</th>
              <th class="num">Ganancia</th>
              <th class="num">Margen %</th>
              <th>Visual</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of productos; let i = index"
                [class.row-negativo]="p.ganancia < 0"
                [class.row-bajo]="p.margen_porcentaje >= 0 && p.margen_porcentaje < 10">
              <td class="idx">{{ i + 1 }}</td>
              <td class="nombre">{{ p.producto_nombre }}</td>
              <td class="num">{{ formatMoneda(p.precio_compra) }}</td>
              <td class="num">{{ formatMoneda(p.precio_venta) }}</td>
              <td class="num">{{ p.cantidad_vendida }}</td>
              <td class="num">{{ formatMoneda(p.total_vendido) }}</td>
              <td class="num">{{ formatMoneda(p.costo_total) }}</td>
              <td class="num" [class.ganancia-positiva]="p.ganancia >= 0" [class.ganancia-negativa]="p.ganancia < 0">
                {{ formatMoneda(p.ganancia) }}
              </td>
              <td class="num" [class.margen-alto]="p.margen_porcentaje >= 30"
                  [class.margen-medio]="p.margen_porcentaje >= 15 && p.margen_porcentaje < 30"
                  [class.margen-bajo]="p.margen_porcentaje < 15">
                {{ p.margen_porcentaje.toFixed(1) }}%
              </td>
              <td>
                <div class="margen-bar">
                  <div class="margen-fill" [style.width.%]="getBarWidth(p.margen_porcentaje)"
                    [style.background]="getBarColor(p.margen_porcentaje)"></div>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="totals-row">
              <td colspan="4"><strong>TOTALES</strong></td>
              <td class="num"><strong>{{ totalUnidades }}</strong></td>
              <td class="num"><strong>{{ formatMoneda(totalVendido) }}</strong></td>
              <td class="num"><strong>{{ formatMoneda(costoTotal) }}</strong></td>
              <td class="num ganancia-positiva"><strong>{{ formatMoneda(gananciaNeta) }}</strong></td>
              <td class="num"><strong>{{ margenPromedio.toFixed(1) }}%</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="productos.length === 0 && !isLoading">
        <i class="fa-solid fa-chart-pie fa-3x"></i>
        <p>Selecciona un rango de fechas y presiona "Generar Reporte"</p>
      </div>

      <!-- Loading -->
      <div class="loading" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Calculando márgenes...</p>
      </div>
    </div>
  `,
  styleUrls: ['./reportes-margen.component.css']
})
export class ReportesMargenComponent implements OnInit {
  productos: ProductoMargen[] = [];
  isLoading = false;
  fechaInicio = '';
  fechaFin = '';
  ordenarPor = 'ganancia_desc';

  // Totals
  totalVendido = 0;
  costoTotal = 0;
  gananciaNeta = 0;
  margenPromedio = 0;
  totalUnidades = 0;

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService,
    private cdr: ChangeDetectorRef
  ) {
    const hoy = new Date();
    this.fechaFin = hoy.toISOString().split('T')[0];
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.fechaInicio = inicioMes.toISOString().split('T')[0];
  }

  ngOnInit() { }

  limpiarDatos() {
    this.productos = [];
    this.totalVendido = 0;
    this.costoTotal = 0;
    this.gananciaNeta = 0;
    this.margenPromedio = 0;
    this.totalUnidades = 0;
  }

  async generarReporte() {
    this.isLoading = true;
    try {
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) {
        this.isLoading = false;
        this.cdr.detectChanges();
        return;
      }

      // Get sales details with product prices
      const { data: detalles, error } = await this.supabaseService.client
        .from('ventas_detalle')
        .select(`
          producto_id,
          producto_nombre,
          cantidad,
          precio_unitario,
          subtotal,
          ventas!inner(estado, created_at, tenant_id)
        `)
        .eq('ventas.tenant_id', tenantId)
        .eq('ventas.estado', 'completada')
        .gte('ventas.created_at', this.fechaInicio + 'T00:00:00')
        .lte('ventas.created_at', this.fechaFin + 'T23:59:59');

      if (error) throw error;

      // Get all products for their purchase prices
      const { data: productosDB, error: errProd } = await this.supabaseService.client
        .from('productos')
        .select('id, precio_compra, precio_venta')
        .eq('tenant_id', tenantId);

      if (errProd) throw errProd;

      const preciosMap = new Map<number, { compra: number; venta: number }>();
      (productosDB || []).forEach((p: any) => {
        preciosMap.set(p.id, { compra: p.precio_compra || 0, venta: p.precio_venta || 0 });
      });

      // Aggregate by product
      const agrupado = new Map<number, ProductoMargen>();

      (detalles || []).forEach((d: any) => {
        const precios = preciosMap.get(d.producto_id);
        const precioCompra = precios?.compra || 0;
        const precioVenta = d.precio_unitario;

        if (agrupado.has(d.producto_id)) {
          const existing = agrupado.get(d.producto_id)!;
          existing.cantidad_vendida += d.cantidad;
          existing.total_vendido += d.subtotal;
          existing.costo_total += precioCompra * d.cantidad;
        } else {
          agrupado.set(d.producto_id, {
            producto_id: d.producto_id,
            producto_nombre: d.producto_nombre,
            precio_compra: precioCompra,
            precio_venta: precioVenta,
            cantidad_vendida: d.cantidad,
            total_vendido: d.subtotal,
            costo_total: precioCompra * d.cantidad,
            ganancia: 0,
            margen_porcentaje: 0
          });
        }
      });

      // Calculate margins
      this.productos = Array.from(agrupado.values()).map(p => {
        p.ganancia = p.total_vendido - p.costo_total;
        p.margen_porcentaje = p.total_vendido > 0 ? (p.ganancia / p.total_vendido) * 100 : 0;
        return p;
      });

      this.ordenarProductos();
      this.calcularTotales();

    } catch (err: any) {
      console.error('Error generando reporte:', err);
      Swal.fire('Error', err.message || 'Error al generar reporte', 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  ordenarProductos() {
    switch (this.ordenarPor) {
      case 'ganancia_desc': this.productos.sort((a, b) => b.ganancia - a.ganancia); break;
      case 'ganancia_asc': this.productos.sort((a, b) => a.ganancia - b.ganancia); break;
      case 'margen_desc': this.productos.sort((a, b) => b.margen_porcentaje - a.margen_porcentaje); break;
      case 'margen_asc': this.productos.sort((a, b) => a.margen_porcentaje - b.margen_porcentaje); break;
      case 'cantidad_desc': this.productos.sort((a, b) => b.cantidad_vendida - a.cantidad_vendida); break;
      case 'nombre_asc': this.productos.sort((a, b) => a.producto_nombre.localeCompare(b.producto_nombre)); break;
    }
    this.cdr.detectChanges();
  }

  calcularTotales() {
    this.totalVendido = this.productos.reduce((s, p) => s + p.total_vendido, 0);
    this.costoTotal = this.productos.reduce((s, p) => s + p.costo_total, 0);
    this.gananciaNeta = this.totalVendido - this.costoTotal;
    this.totalUnidades = this.productos.reduce((s, p) => s + p.cantidad_vendida, 0);
    this.margenPromedio = this.totalVendido > 0 ? (this.gananciaNeta / this.totalVendido) * 100 : 0;
  }

  getBarWidth(margen: number): number {
    return Math.min(Math.max(margen, 0), 100);
  }

  getBarColor(margen: number): string {
    if (margen >= 30) return '#16a34a';
    if (margen >= 15) return '#f59e0b';
    if (margen >= 0) return '#ef4444';
    return '#dc2626';
  }

  formatMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(valor);
  }

  exportarCSV() {
    const headers = 'Producto,P. Compra,P. Venta,Unidades,Total Vendido,Costo Total,Ganancia,Margen %';
    const rows = this.productos.map(p =>
      `"${p.producto_nombre}",${p.precio_compra.toFixed(2)},${p.precio_venta.toFixed(2)},${p.cantidad_vendida},${p.total_vendido.toFixed(2)},${p.costo_total.toFixed(2)},${p.ganancia.toFixed(2)},${p.margen_porcentaje.toFixed(1)}`
    ).join('\n');

    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `margen_ganancia_${this.fechaInicio}_${this.fechaFin}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    Swal.fire({ title: '✅ Exportado', icon: 'success', timer: 1500, showConfirmButton: false });
  }

  exportarPDF() {
    if (this.productos.length === 0) return;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Reporte de Márgenes de Ganancia', 14, 20);
    doc.setFontSize(10);
    doc.text(`Período: ${this.fechaInicio} al ${this.fechaFin}`, 14, 28);
    doc.text(`Fecha de generación: ${new Date().toLocaleString()}`, 14, 34);

    // Resumen
    doc.setFontSize(12);
    doc.text('Resumen del Análisis', 14, 45);
    doc.setFontSize(10);
    doc.text(`Total Vendido: ${this.formatMoneda(this.totalVendido)}`, 14, 52);
    doc.text(`Costo Total: ${this.formatMoneda(this.costoTotal)}`, 14, 58);
    doc.text(`Ganancia Neta: ${this.formatMoneda(this.gananciaNeta)}`, 14, 64);
    doc.text(`Margen Promedio: ${this.margenPromedio.toFixed(1)}%`, 14, 70);

    // Tabla
    const head = [['Producto', 'P. Compra', 'P. Venta', 'Cant', 'Venta Total', 'Ganancia', 'Margen %']];
    const data = this.productos.map(p => [
        p.producto_nombre,
        this.formatMoneda(p.precio_compra),
        this.formatMoneda(p.precio_venta),
        p.cantidad_vendida,
        this.formatMoneda(p.total_vendido),
        this.formatMoneda(p.ganancia),
        `${p.margen_porcentaje.toFixed(1)}%`
    ]);

    autoTable(doc, {
        head: head,
        body: data,
        startY: 75,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 }
    });

    doc.save(`reporte_margen_${this.fechaInicio}_${this.fechaFin}.pdf`);
  }
}
