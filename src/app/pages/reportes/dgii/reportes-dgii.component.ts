import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../services/supabase.service';
import { TenantService } from '../../../services/tenant.service';
import { FiscalService } from '../../../services/fiscal.service';
import Swal from 'sweetalert2';

interface Registro606 {
    rnc_cedula: string;
    tipo_id: string;
    tipo_bienes_servicios: string;
    ncf: string;
    ncf_modificado: string;
    fecha_comprobante: string;
    fecha_pago: string;
    monto_servicios: number;
    monto_bienes: number;
    total: number;
    itbis_facturado: number;
    itbis_retenido: number;
    monto_isr: number;
    forma_pago: string;
}

interface Registro607 {
    rnc_cedula: string;
    tipo_id: string;
    ncf: string;
    ncf_modificado: string;
    tipo_ingreso: string;
    fecha_comprobante: string;
    fecha_retencion: string;
    monto_facturado: number;
    itbis_facturado: number;
    itbis_retenido_terceros: number;
    itbis_percibido: number;
    retencion_renta_terceros: number;
    isr_percibido: number;
    impuesto_selectivo: number;
    otros_impuestos: number;
    monto_propina_legal: number;
    forma_pago: string;
}

interface Registro608 {
    ncf: string;
    tipo_anulacion: string;
    fecha_anulacion: string;
}

@Component({
    selector: 'app-reportes-dgii',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="dgii-container">
      <!-- Header -->
      <div class="dgii-header">
        <div>
          <h1><i class="fa-solid fa-file-invoice"></i> Reportes DGII</h1>
          <p class="subtitle">Genera los formatos requeridos por la Dirección General de Impuestos Internos</p>
        </div>
      </div>

      <!-- Periodo -->
      <div class="periodo-selector">
        <div class="form-group">
          <label>Período</label>
          <div class="periodo-inputs">
            <select [(ngModel)]="mesSeleccionado" (change)="limpiarDatos()">
              <option *ngFor="let m of meses; let i = index" [value]="i + 1">{{ m }}</option>
            </select>
            <select [(ngModel)]="anioSeleccionado" (change)="limpiarDatos()">
              <option *ngFor="let a of anios" [value]="a">{{ a }}</option>
            </select>
          </div>
        </div>
        <div class="rnc-info" *ngIf="rncEmpresa">
          <label>RNC Empresa</label>
          <span class="rnc-badge">{{ rncEmpresa }}</span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab" [class.active]="tabActiva === '607'" (click)="tabActiva = '607'">
          <i class="fa-solid fa-receipt"></i>
          607 — Ventas
          <span class="badge" *ngIf="registros607.length">{{ registros607.length }}</span>
        </button>
        <button class="tab" [class.active]="tabActiva === '606'" (click)="tabActiva = '606'">
          <i class="fa-solid fa-shopping-bag"></i>
          606 — Compras
          <span class="badge" *ngIf="registros606.length">{{ registros606.length }}</span>
        </button>
        <button class="tab" [class.active]="tabActiva === '608'" (click)="tabActiva = '608'">
          <i class="fa-solid fa-ban"></i>
          608 — Anulaciones
          <span class="badge" *ngIf="registros608.length">{{ registros608.length }}</span>
        </button>
      </div>

      <!-- Content Area -->
      <div class="tab-content">

        <!-- Actions -->
        <div class="actions-bar">
          <button class="btn-generar" (click)="generarReporte()" [disabled]="isLoading">
            <i class="fa-solid" [class.fa-spinner]="isLoading" [class.fa-rotate]="isLoading" [class.fa-search]="!isLoading"></i>
            {{ isLoading ? 'Generando...' : 'Generar Reporte' }}
          </button>
          <button class="btn-exportar" (click)="exportarTXT()" [disabled]="!tieneRegistros()">
            <i class="fa-solid fa-download"></i> Exportar TXT (DGII)
          </button>
          <button class="btn-exportar-csv" (click)="exportarCSV()" [disabled]="!tieneRegistros()">
            <i class="fa-solid fa-file-csv"></i> Exportar CSV
          </button>
        </div>

        <!-- 607 - Ventas -->
        <div *ngIf="tabActiva === '607'">
          <div class="resumen-cards">
            <div class="resumen-card">
              <span class="resumen-label">Total Facturado</span>
              <span class="resumen-valor">{{ formatMoneda(totalFacturado607) }}</span>
            </div>
            <div class="resumen-card">
              <span class="resumen-label">ITBIS Facturado</span>
              <span class="resumen-valor">{{ formatMoneda(totalItbis607) }}</span>
            </div>
            <div class="resumen-card">
              <span class="resumen-label">Registros</span>
              <span class="resumen-valor">{{ registros607.length }}</span>
            </div>
          </div>

          <div class="tabla-container" *ngIf="registros607.length > 0">
            <table>
              <thead>
                <tr>
                  <th>RNC/Cédula</th>
                  <th>NCF</th>
                  <th>Fecha</th>
                  <th class="num">Monto Facturado</th>
                  <th class="num">ITBIS</th>
                  <th>Forma Pago</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of registros607">
                  <td>{{ r.rnc_cedula || 'N/A' }}</td>
                  <td class="ncf">{{ r.ncf }}</td>
                  <td>{{ r.fecha_comprobante }}</td>
                  <td class="num">{{ formatMoneda(r.monto_facturado) }}</td>
                  <td class="num">{{ formatMoneda(r.itbis_facturado) }}</td>
                  <td>{{ getFormaPagoLabel(r.forma_pago) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="empty-state" *ngIf="registros607.length === 0 && !isLoading">
            <i class="fa-solid fa-receipt fa-3x"></i>
            <p>Presiona "Generar Reporte" para cargar las ventas del período</p>
          </div>
        </div>

        <!-- 606 - Compras -->
        <div *ngIf="tabActiva === '606'">
          <div class="resumen-cards">
            <div class="resumen-card">
              <span class="resumen-label">Total Compras</span>
              <span class="resumen-valor">{{ formatMoneda(totalCompras606) }}</span>
            </div>
            <div class="resumen-card">
              <span class="resumen-label">ITBIS</span>
              <span class="resumen-valor">{{ formatMoneda(totalItbis606) }}</span>
            </div>
            <div class="resumen-card">
              <span class="resumen-label">Registros</span>
              <span class="resumen-valor">{{ registros606.length }}</span>
            </div>
          </div>

          <div class="tabla-container" *ngIf="registros606.length > 0">
            <table>
              <thead>
                <tr>
                  <th>RNC Proveedor</th>
                  <th>NCF</th>
                  <th>Fecha</th>
                  <th class="num">Monto Total</th>
                  <th class="num">ITBIS</th>
                  <th>Forma Pago</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of registros606">
                  <td>{{ r.rnc_cedula }}</td>
                  <td class="ncf">{{ r.ncf }}</td>
                  <td>{{ r.fecha_comprobante }}</td>
                  <td class="num">{{ formatMoneda(r.total) }}</td>
                  <td class="num">{{ formatMoneda(r.itbis_facturado) }}</td>
                  <td>{{ getFormaPagoLabel(r.forma_pago) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="empty-state" *ngIf="registros606.length === 0 && !isLoading">
            <i class="fa-solid fa-shopping-bag fa-3x"></i>
            <p>Presiona "Generar Reporte" para cargar las compras del período</p>
          </div>
        </div>

        <!-- 608 - Anulaciones -->
        <div *ngIf="tabActiva === '608'">
          <div class="resumen-cards">
            <div class="resumen-card">
              <span class="resumen-label">NCF Anulados</span>
              <span class="resumen-valor">{{ registros608.length }}</span>
            </div>
          </div>

          <div class="tabla-container" *ngIf="registros608.length > 0">
            <table>
              <thead>
                <tr>
                  <th>NCF Anulado</th>
                  <th>Tipo Anulación</th>
                  <th>Fecha Anulación</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of registros608">
                  <td class="ncf">{{ r.ncf }}</td>
                  <td>{{ getTipoAnulacion(r.tipo_anulacion) }}</td>
                  <td>{{ r.fecha_anulacion }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="empty-state" *ngIf="registros608.length === 0 && !isLoading">
            <i class="fa-solid fa-ban fa-3x"></i>
            <p>Presiona "Generar Reporte" para cargar las anulaciones del período</p>
          </div>
        </div>

        <!-- Loading -->
        <div class="loading-overlay" *ngIf="isLoading">
          <div class="spinner"></div>
          <p>Generando reporte {{ tabActiva }}...</p>
        </div>
      </div>
    </div>
  `,
    styleUrls: ['./reportes-dgii.component.css']
})
export class ReportesDgiiComponent implements OnInit {
    tabActiva: '606' | '607' | '608' = '607';
    isLoading = false;

    // Periodo
    mesSeleccionado: number;
    anioSeleccionado: number;
    meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    anios: number[] = [];
    rncEmpresa = '';

    // Data
    registros606: Registro606[] = [];
    registros607: Registro607[] = [];
    registros608: Registro608[] = [];

    // Totals
    totalFacturado607 = 0;
    totalItbis607 = 0;
    totalCompras606 = 0;
    totalItbis606 = 0;

    constructor(
        private supabaseService: SupabaseService,
        private tenantService: TenantService,
        private fiscalService: FiscalService,
        private cdr: ChangeDetectorRef
    ) {
        const hoy = new Date();
        this.mesSeleccionado = hoy.getMonth() + 1;
        this.anioSeleccionado = hoy.getFullYear();
        this.anios = Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - i);
    }

    ngOnInit() {
        this.fiscalService.config$.subscribe(config => {
            this.rncEmpresa = config?.rnc_empresa || '';
        });
    }

    limpiarDatos() {
        this.registros606 = [];
        this.registros607 = [];
        this.registros608 = [];
        this.totalFacturado607 = 0;
        this.totalItbis607 = 0;
        this.totalCompras606 = 0;
        this.totalItbis606 = 0;
    }

    tieneRegistros(): boolean {
        if (this.tabActiva === '607') return this.registros607.length > 0;
        if (this.tabActiva === '606') return this.registros606.length > 0;
        return this.registros608.length > 0;
    }

    async generarReporte() {
        this.isLoading = true;
        try {
            if (this.tabActiva === '607') await this.generar607();
            else if (this.tabActiva === '606') await this.generar606();
            else await this.generar608();
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Error al generar reporte', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // =================== 607 — VENTAS ===================
    private async generar607() {
        const { fechaInicio, fechaFin } = this.getRangoFechas();
        const tenantId = this.tenantService.tenantId;
        if (!tenantId) return;

        const { data, error } = await this.supabaseService.client
            .from('ventas')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('estado', 'completada')
            .not('ncf', 'is', null)
            .gte('created_at', fechaInicio)
            .lte('created_at', fechaFin)
            .order('created_at');

        if (error) throw error;

        this.registros607 = (data || []).map((v: any) => ({
            rnc_cedula: v.rnc_cliente || '',
            tipo_id: v.rnc_cliente ? (v.rnc_cliente.length <= 9 ? '1' : '2') : '3',
            ncf: v.ncf || '',
            ncf_modificado: '',
            tipo_ingreso: this.getTipoIngreso607(v.tipo_ncf),
            fecha_comprobante: this.formatFechaDGII(v.created_at),
            fecha_retencion: '',
            monto_facturado: v.total || 0,
            itbis_facturado: v.impuestos || 0,
            itbis_retenido_terceros: 0,
            itbis_percibido: 0,
            retencion_renta_terceros: 0,
            isr_percibido: 0,
            impuesto_selectivo: 0,
            otros_impuestos: 0,
            monto_propina_legal: 0,
            forma_pago: this.getFormaPagoDGII(v.metodo_pago)
        }));

        this.totalFacturado607 = this.registros607.reduce((s, r) => s + r.monto_facturado, 0);
        this.totalItbis607 = this.registros607.reduce((s, r) => s + r.itbis_facturado, 0);
    }

    // =================== 606 — COMPRAS ===================
    private async generar606() {
        const { fechaInicio, fechaFin } = this.getRangoFechas();
        const tenantId = this.tenantService.tenantId;
        if (!tenantId) return;

        const { data, error } = await this.supabaseService.client
            .from('compras')
            .select('*, proveedores(documento, nombre)')
            .eq('tenant_id', tenantId)
            .gte('created_at', fechaInicio)
            .lte('created_at', fechaFin)
            .order('created_at');

        if (error) throw error;

        this.registros606 = (data || []).map((c: any) => {
            const itbis = (c.total || 0) * 0.18 / 1.18; // Extraer ITBIS del total
            return {
                rnc_cedula: c.proveedores?.documento || '',
                tipo_id: '1',
                tipo_bienes_servicios: '01',
                ncf: c.ncf || '',
                ncf_modificado: '',
                fecha_comprobante: this.formatFechaDGII(c.created_at),
                fecha_pago: this.formatFechaDGII(c.created_at),
                monto_servicios: 0,
                monto_bienes: (c.total || 0) - itbis,
                total: c.total || 0,
                itbis_facturado: itbis,
                itbis_retenido: 0,
                monto_isr: 0,
                forma_pago: this.getFormaPagoDGII(c.metodo_pago || 'efectivo')
            };
        });

        this.totalCompras606 = this.registros606.reduce((s, r) => s + r.total, 0);
        this.totalItbis606 = this.registros606.reduce((s, r) => s + r.itbis_facturado, 0);
    }

    // =================== 608 — ANULACIONES ===================
    private async generar608() {
        const { fechaInicio, fechaFin } = this.getRangoFechas();
        const tenantId = this.tenantService.tenantId;
        if (!tenantId) return;

        const { data, error } = await this.supabaseService.client
            .from('ventas')
            .select('ncf, tipo_ncf, updated_at')
            .eq('tenant_id', tenantId)
            .eq('estado', 'cancelada')
            .not('ncf', 'is', null)
            .gte('updated_at', fechaInicio)
            .lte('updated_at', fechaFin)
            .order('updated_at');

        if (error) throw error;

        this.registros608 = (data || []).map((v: any) => ({
            ncf: v.ncf,
            tipo_anulacion: '02', // Corrección de datos
            fecha_anulacion: this.formatFechaDGII(v.updated_at)
        }));
    }

    // =================== EXPORT TXT (DGII FORMAT) ===================
    exportarTXT() {
        let contenido = '';
        let filename = '';
        const periodo = `${this.anioSeleccionado}${String(this.mesSeleccionado).padStart(2, '0')}`;
        const rnc = this.rncEmpresa.replace(/-/g, '');

        if (this.tabActiva === '607') {
            // Header 607
            contenido = `607|${rnc}|${periodo}|${this.registros607.length}\n`;
            this.registros607.forEach(r => {
                contenido += `${r.rnc_cedula}|${r.tipo_id}|${r.ncf}|${r.ncf_modificado}|${r.tipo_ingreso}|${r.fecha_comprobante}|${r.fecha_retencion}|${r.monto_facturado.toFixed(2)}|${r.itbis_facturado.toFixed(2)}|${r.itbis_retenido_terceros.toFixed(2)}|${r.itbis_percibido.toFixed(2)}|${r.retencion_renta_terceros.toFixed(2)}|${r.isr_percibido.toFixed(2)}|${r.impuesto_selectivo.toFixed(2)}|${r.otros_impuestos.toFixed(2)}|${r.monto_propina_legal.toFixed(2)}|${r.forma_pago}\n`;
            });
            filename = `607_${periodo}.txt`;
        } else if (this.tabActiva === '606') {
            contenido = `606|${rnc}|${periodo}|${this.registros606.length}\n`;
            this.registros606.forEach(r => {
                contenido += `${r.rnc_cedula}|${r.tipo_id}|${r.tipo_bienes_servicios}|${r.ncf}|${r.ncf_modificado}|${r.fecha_comprobante}|${r.fecha_pago}|${r.monto_servicios.toFixed(2)}|${r.monto_bienes.toFixed(2)}|${r.total.toFixed(2)}|${r.itbis_facturado.toFixed(2)}|${r.itbis_retenido.toFixed(2)}|${r.monto_isr.toFixed(2)}|${r.forma_pago}\n`;
            });
            filename = `606_${periodo}.txt`;
        } else {
            contenido = `608|${rnc}|${periodo}|${this.registros608.length}\n`;
            this.registros608.forEach(r => {
                contenido += `${r.ncf}|${r.tipo_anulacion}|${r.fecha_anulacion}\n`;
            });
            filename = `608_${periodo}.txt`;
        }

        this.descargar(contenido, filename, 'text/plain');
    }

    exportarCSV() {
        let headers = '';
        let rows = '';
        let filename = '';
        const periodo = `${this.anioSeleccionado}${String(this.mesSeleccionado).padStart(2, '0')}`;

        if (this.tabActiva === '607') {
            headers = 'RNC/Cédula,NCF,Fecha,Monto Facturado,ITBIS,Forma Pago';
            rows = this.registros607.map(r =>
                `"${r.rnc_cedula}","${r.ncf}","${r.fecha_comprobante}",${r.monto_facturado.toFixed(2)},${r.itbis_facturado.toFixed(2)},"${this.getFormaPagoLabel(r.forma_pago)}"`
            ).join('\n');
            filename = `607_ventas_${periodo}.csv`;
        } else if (this.tabActiva === '606') {
            headers = 'RNC Proveedor,NCF,Fecha,Monto Total,ITBIS,Forma Pago';
            rows = this.registros606.map(r =>
                `"${r.rnc_cedula}","${r.ncf}","${r.fecha_comprobante}",${r.total.toFixed(2)},${r.itbis_facturado.toFixed(2)},"${this.getFormaPagoLabel(r.forma_pago)}"`
            ).join('\n');
            filename = `606_compras_${periodo}.csv`;
        } else {
            headers = 'NCF,Tipo Anulación,Fecha';
            rows = this.registros608.map(r =>
                `"${r.ncf}","${this.getTipoAnulacion(r.tipo_anulacion)}","${r.fecha_anulacion}"`
            ).join('\n');
            filename = `608_anulaciones_${periodo}.csv`;
        }

        this.descargar(headers + '\n' + rows, filename, 'text/csv;charset=utf-8');
    }

    // =================== HELPERS ===================
    private getRangoFechas() {
        const fechaInicio = `${this.anioSeleccionado}-${String(this.mesSeleccionado).padStart(2, '0')}-01T00:00:00`;
        const ultimoDia = new Date(this.anioSeleccionado, this.mesSeleccionado, 0).getDate();
        const fechaFin = `${this.anioSeleccionado}-${String(this.mesSeleccionado).padStart(2, '0')}-${ultimoDia}T23:59:59`;
        return { fechaInicio, fechaFin };
    }

    private formatFechaDGII(fecha: string): string {
        if (!fecha) return '';
        const d = new Date(fecha);
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }

    private getFormaPagoDGII(metodo: string): string {
        switch (metodo) {
            case 'efectivo': return '01';
            case 'tarjeta': return '03';
            case 'credito': return '02';
            case 'mixto': return '06';
            default: return '01';
        }
    }

    private getTipoIngreso607(tipoNcf: string): string {
        switch (tipoNcf) {
            case 'B01': return '01'; // Ingresos por operaciones (crédito fiscal)
            case 'B02': return '02'; // Ingresos financieros (consumo)
            case 'B14': return '03'; // Ingresos extraordinarios
            case 'B15': return '04'; // Ingresos por arrendamientos
            default: return '01';
        }
    }

    getFormaPagoLabel(codigo: string): string {
        switch (codigo) {
            case '01': return 'Efectivo';
            case '02': return 'Cheque/Transferencia';
            case '03': return 'Tarjeta';
            case '04': return 'Crédito';
            case '06': return 'Mixto';
            default: return codigo;
        }
    }

    getTipoAnulacion(codigo: string): string {
        switch (codigo) {
            case '01': return 'Deterioro de Factura Pre-Impresa';
            case '02': return 'Errores de Impresión';
            case '03': return 'Impresión Defectuosa';
            case '04': return 'Corrección de Info';
            case '05': return 'Cambio de Productos';
            case '06': return 'Devolución de Productos';
            case '07': return 'Omisión de Productos';
            case '08': return 'Errores en Secuencia NCF';
            case '09': return 'Por Cese de Operaciones';
            default: return 'Otro';
        }
    }

    formatMoneda(valor: number): string {
        return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(valor);
    }

    private descargar(contenido: string, filename: string, tipo: string) {
        const blob = new Blob([contenido], { type: tipo });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        Swal.fire({
            title: '✅ Exportado',
            html: `Archivo <b>${filename}</b> descargado`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
    }
}
