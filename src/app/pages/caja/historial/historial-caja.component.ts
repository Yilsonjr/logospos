import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { Caja, ResumenCaja } from '../../../models/caja.model';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-historial-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial-caja.component.html',
  styleUrl: './historial-caja.component.css'
})
export class HistorialCajaComponent implements OnInit, OnDestroy {
  cajas: Caja[] = [];
  cajasFiltradas: Caja[] = [];
  cajaSeleccionada?: ResumenCaja;

  filtroEstado: string = 'todos';
  fechaInicio: string = '';
  fechaFin: string = '';

  mostrarDetalles: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private cajaService: CajaService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    this.inicializarFechas();

    // PRIMERO: Suscribirse
    this.cajaService.cajas$.subscribe(cajas => {
      this.cajas = cajas;
      this.aplicarFiltros();
      this.cdr.detectChanges();
      console.log('✅ Cajas actualizadas en vista:', cajas.length);
    });

    // DESPUÉS: Cargar datos
    await this.cargarHistorial();

    // Recargar en navegación
    const navSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(async () => {
      if (this.router.url.includes('/caja/historial')) {
        await this.cargarHistorial();
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

  async cargarHistorial() {
    try {
      console.log('🔄 Cargando historial de cajas...');
      await this.cajaService.cargarHistorial(100);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  }

  aplicarFiltros() {
    let resultado = [...this.cajas];

    if (this.filtroEstado !== 'todos') {
      resultado = resultado.filter(c => c.estado === this.filtroEstado);
    }

    if (this.fechaInicio && this.fechaFin) {
      resultado = resultado.filter(c => {
        const fechaCaja = new Date(c.fecha_apertura).toISOString().split('T')[0];
        return fechaCaja >= this.fechaInicio && fechaCaja <= this.fechaFin;
      });
    }

    this.cajasFiltradas = resultado;
  }

  async verDetalles(caja: Caja) {
    try {
      console.log('🔍 Obteniendo detalles de caja:', caja.id);

      // Mostrar loading en el modal visual (opcional si es rápido)
      this.mostrarDetalles = true;
      this.cajaSeleccionada = undefined; // Limpiar anterior para mostrar "Cargando..."

      const resumen = await this.cajaService.obtenerResumenCaja(caja.id!);

      if (resumen) {
        this.cajaSeleccionada = resumen;
        this.cdr.detectChanges();
        console.log('✅ Detalles cargados:', resumen.movimientos.length, 'movimientos');
      } else {
        // Si no hay resumen, cerramos para no quedar en loading infinito
        this.mostrarDetalles = false;
        this.cdr.detectChanges();
        console.error('❌ No se pudo generar el resumen de la caja');
      }

    } catch (error) {
      console.error('Error al cargar detalles:', error);
      this.mostrarDetalles = false;
    }
  }

  cerrarDetalles() {
    this.mostrarDetalles = false;
    this.cajaSeleccionada = undefined;
  }

  limpiarFiltros() {
    this.filtroEstado = 'todos';
    this.inicializarFechas();
    this.aplicarFiltros();
  }

  getColorEstado(estado: string): string {
    return estado === 'abierta' ? 'green' : 'gray';
  }

  getColorTipoMovimiento(tipo: string): string {
    const colores: { [key: string]: string } = {
      'entrada': 'green',
      'salida': 'red',
      'venta': 'blue'
    };
    return colores[tipo] || 'gray';
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

  formatearFechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  calcularDuracion(apertura: string, cierre?: string): string {
    if (!cierre) return 'En curso';

    const inicio = new Date(apertura);
    const fin = new Date(cierre);
    const diff = fin.getTime() - inicio.getTime();
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${horas}h ${minutos}m`;
  }
}
