import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VentasService } from '../../../services/ventas.service';
import { FiscalService } from '../../../services/fiscal.service';
import { Venta } from '../../../models/ventas.model';
import { Subscription } from 'rxjs';
import { ChartConfiguration, ChartOptions, Chart, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

Chart.register(...registerables);

@Component({
    selector: 'app-reportes-ventas',
    standalone: true,
    imports: [CommonModule, FormsModule, BaseChartDirective],
    templateUrl: './reportes-ventas.component.html',
    styleUrls: ['./reportes-ventas.component.css']
})
export class ReportesVentasComponent implements OnInit, OnDestroy {
    fechaInicio: string = '';
    fechaFin: string = '';
    ventas: Venta[] = [];
    ventasFiltradas: Venta[] = [];
    isLoading = false;
    modoFiscalActivo = false;

    // Resumen
    totalVentas = 0;
    totalEfectivo = 0;
    totalTarjeta = 0;
    totalTransacciones = 0;
    ticketPromedio = 0;

    // Charts Config
    @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

    // Line Chart (Ventas Diarias)
    public lineChartData: ChartConfiguration<'line'>['data'] = {
        labels: [],
        datasets: [
            {
                data: [],
                label: 'Ventas 💰',
                fill: true,
                tension: 0.4,
                borderColor: 'rgba(59, 130, 246, 1)', // Azul primary
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                pointBackgroundColor: 'rgba(59, 130, 246, 1)',
            }
        ]
    };
    public lineChartOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
            x: { grid: { display: false } }
        }
    };

    // Doughnut Chart (Medios de Pago)
    public doughnutChartData: ChartConfiguration<'doughnut'>['data'] = {
        labels: ['Efectivo', 'Tarjeta/Transf.'],
        datasets: [
            {
                data: [0, 0],
                backgroundColor: ['#10b981', '#6366f1'], // Verde y Indigo
                borderWidth: 0,
                hoverOffset: 4
            }
        ]
    };
    public doughnutChartOptions: ChartOptions<'doughnut'> = {
        responsive: true,
        plugins: {
            legend: { position: 'bottom' }
        },
        cutout: '70%'
    };

    private subscriptions: Subscription[] = [];

    constructor(
        private ventasService: VentasService,
        private fiscalService: FiscalService,
        private cdr: ChangeDetectorRef
    ) {
        // Inicializar fechas: Últimos 30 días por defecto (más rápido que cargar todo)
        const hoy = new Date();
        const hace30Dias = new Date();
        hace30Dias.setDate(hoy.getDate() - 30);
        this.fechaFin = hoy.toISOString().split('T')[0];
        this.fechaInicio = hace30Dias.toISOString().split('T')[0];
    }

    ngOnInit() {
        console.log('📊 Iniciando Reporte de Ventas Reactivo...');

        // Suscribirse al stream de ventas (refleja actualizaciones en tiempo real desde otras secciones)
        const salesSub = this.ventasService.ventas$.subscribe(ventas => {
            if (ventas.length > 0) {
                // Solo mostramos las ventas que ya están en el store (no recargamos, ya están filtradas)
                this.ventas = ventas;
                this.aplicarFiltrosYCalcular();
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });

        const fiscalSub = this.fiscalService.config$.subscribe(config => {
            this.modoFiscalActivo = config?.modo_fiscal ?? false;
            this.cdr.detectChanges();
        });

        this.subscriptions.push(salesSub, fiscalSub);

        // Carga inicial con filtro de fecha para evitar traer miles de registros
        this.cargarReporte();
    }

    ngOnDestroy() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
    }

    async cargarReporte() {
        this.isLoading = true;
        this.cdr.detectChanges();
        
        // Timeout de seguridad: si tarda más de 15s, dejar de mostrar spinner
        const timeoutId = setTimeout(() => {
            if (this.isLoading) {
                this.isLoading = false;
                this.cdr.detectChanges();
                console.warn('⚠️ Reporte: timeout al cargar datos');
            }
        }, 15000);

        try {
            // Cargar con límite razonable (500 max) para evitar peticiones masivas
            await this.ventasService.cargarVentas(500);
        } catch (error) {
            console.error('Error al cargar reporte de ventas:', error);
        } finally {
            clearTimeout(timeoutId);
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    aplicarFiltrosYCalcular() {
        if (!this.ventas) return;

        // Si hay fechas seleccionadas, filtramos la lista en memoria
        const fI = this.fechaInicio ? new Date(this.fechaInicio + 'T00:00:00') : null;
        const fF = this.fechaFin ? new Date(this.fechaFin + 'T23:59:59') : null;

        this.ventasFiltradas = this.ventas.filter(v => {
            const fechaVenta = new Date(v.created_at || '');
            if (fI && fechaVenta < fI) return false;
            if (fF && fechaVenta > fF) return false;
            return true;
        });

        this.calcularResumen(this.ventasFiltradas);
    }

    calcularResumen(ventasInteres: Venta[]) {
        this.totalVentas = 0;
        this.totalEfectivo = 0;
        this.totalTarjeta = 0;
        this.totalTransacciones = ventasInteres.length;

        ventasInteres.forEach(venta => {
            if (venta.estado === 'completada') {
                this.totalVentas += venta.total;

                if (venta.metodo_pago === 'efectivo') {
                    this.totalEfectivo += venta.total;
                } else if (venta.metodo_pago === 'mixto') {
                    // Desglose proporcional si no hay detalle exacto en BD
                    this.totalEfectivo += (venta.monto_efectivo || venta.total / 2);
                    this.totalTarjeta += (venta.monto_tarjeta || venta.total / 2);
                } else if (venta.metodo_pago === 'tarjeta') {
                    this.totalTarjeta += venta.total;
                }
            }
        });

        this.ticketPromedio = this.totalTransacciones > 0 ? this.totalVentas / this.totalTransacciones : 0;
        
        // Actualizar Gráficos
        this.actualizarGraficos(ventasInteres);
        
        this.cdr.detectChanges();
    }

    actualizarGraficos(ventas: Venta[]) {
        // Doughnut: Medios de pago
        this.doughnutChartData.datasets[0].data = [this.totalEfectivo, this.totalTarjeta];

        // Line: Agrupación por días
        const ventasPorDia = new Map<string, number>();
        
        // Ordenamos ventas por fecha ascendente para el chart
        const ventasOrdenadas = [...ventas].sort((a, b) => 
            new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
        );

        ventasOrdenadas.forEach(v => {
            if (v.estado === 'completada') {
                const diaStr = new Date(v.created_at || '').toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
                ventasPorDia.set(diaStr, (ventasPorDia.get(diaStr) || 0) + v.total);
            }
        });

        this.lineChartData.labels = Array.from(ventasPorDia.keys());
        this.lineChartData.datasets[0].data = Array.from(ventasPorDia.values());

        // Forzar actualización del componente gráfico
        this.chart?.update();
    }

    exportarReporte() {
        if (this.ventas.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        const datosExportar = this.ventas.map(v => ({
            Fecha: new Date(v.created_at || '').toLocaleDateString(),
            Factura: v.numero_venta,
            NCF: v.ncf || '',
            RNC: v.rnc_cliente || '',
            Cliente: v.cliente_id ? `Cliente #${v.cliente_id}` : 'General',
            Metodo: v.metodo_pago,
            Total: v.total,
            Estado: v.estado
        }));

        const headers = Object.keys(datosExportar[0]).join(',');
        const csvContent = datosExportar.map(row =>
            Object.values(row).map(val => `"${val}"`).join(',')
        ).join('\n');

        const blob = new Blob([headers + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_ventas_${this.fechaInicio}_${this.fechaFin}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    formatearMoneda(valor: number): string {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP'
        }).format(valor);
    }

    formatearFecha(fecha: string): string {
        return new Date(fecha).toLocaleDateString() + ' ' + new Date(fecha).toLocaleTimeString();
    }
}
