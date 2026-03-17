import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { RecordatoriosService } from '../../../services/recordatorios.service';
import { CuentasCobrarService } from '../../../services/cuentas-cobrar.service';
import { Recordatorio, TIPOS_RECORDATORIO, CANALES_RECORDATORIO, ESTADOS_RECORDATORIO } from '../../../models/recordatorios.model';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-recordatorios',
  imports: [CommonModule, FormsModule],
  templateUrl: './recordatorios.html',
  styleUrl: './recordatorios.css'
})
export class RecordatoriosComponent implements OnInit, OnDestroy {
  recordatorios: Recordatorio[] = [];
  recordatoriosFiltrados: Recordatorio[] = [];

  // Filtros
  filtroEstado: string = 'todos';
  filtroCanal: string = 'todos';
  filtroTipo: string = 'todos';
  busqueda: string = '';

  // UI
  isLoading = true;
  mostrarModalNuevo = false;

  // Constantes
  tiposRecordatorio = TIPOS_RECORDATORIO;
  canalesRecordatorio = CANALES_RECORDATORIO;
  estadosRecordatorio = ESTADOS_RECORDATORIO;

  private subscriptions: Subscription[] = [];

  constructor(
    private recordatoriosService: RecordatoriosService,
    private cuentasService: CuentasCobrarService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    await this.cargarDatos();

    // Recargar cuando se navega a recordatorios
    const navSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(async (event: any) => {
      if (event.url.includes('/recordatorios')) {
        await this.cargarDatos();
      }
    });

    this.subscriptions.push(navSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarDatos() {
    try {
      this.isLoading = true;

      // Suscribirse a recordatorios
      const recordatoriosSub = this.recordatoriosService.recordatorios$.subscribe(recordatorios => {
        this.recordatorios = recordatorios;
        this.aplicarFiltros();
        this.isLoading = false;
        this.cdr.detectChanges();
      });

      this.subscriptions.push(recordatoriosSub);

      // Cargar recordatorios
      await this.recordatoriosService.cargarRecordatorios();

    } catch (error) {
      console.error('Error al cargar recordatorios:', error);
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  aplicarFiltros() {
    let resultado = [...this.recordatorios];

    // Filtrar por estado
    if (this.filtroEstado !== 'todos') {
      resultado = resultado.filter(r => r.estado === this.filtroEstado);
    }

    // Filtrar por canal
    if (this.filtroCanal !== 'todos') {
      resultado = resultado.filter(r => r.canal === this.filtroCanal);
    }

    // Filtrar por tipo
    if (this.filtroTipo !== 'todos') {
      resultado = resultado.filter(r => r.tipo === this.filtroTipo);
    }

    // Filtrar por búsqueda
    if (this.busqueda.trim()) {
      const busquedaLower = this.busqueda.toLowerCase();
      resultado = resultado.filter(r =>
        r.cliente_nombre?.toLowerCase().includes(busquedaLower) ||
        r.mensaje.toLowerCase().includes(busquedaLower)
      );
    }

    this.recordatoriosFiltrados = resultado;
    this.cdr.detectChanges();
  }

  cambiarFiltroEstado(estado: string) {
    this.filtroEstado = estado;
    this.aplicarFiltros();
  }

  cambiarFiltroCanal(canal: string) {
    this.filtroCanal = canal;
    this.aplicarFiltros();
  }

  cambiarFiltroTipo(tipo: string) {
    this.filtroTipo = tipo;
    this.aplicarFiltros();
  }

  onBusquedaChange() {
    this.aplicarFiltros();
  }

  async enviarRecordatorio(recordatorio: Recordatorio) {
    const result = await Swal.fire({
      title: '¿Enviar Recordatorio?',
      html: `
        <div class="text-left">
          <p><strong>Cliente:</strong> ${recordatorio.cliente_nombre}</p>
          <p><strong>Canal:</strong> ${recordatorio.canal}</p>
          <p><strong>Mensaje:</strong></p>
          <div class="bg-gray-100 p-3 rounded mt-2 text-sm">${recordatorio.mensaje}</div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3085d6'
    });

    if (result.isConfirmed) {
      try {
        await this.recordatoriosService.enviarRecordatorio(recordatorio.id!);

        await Swal.fire({
          title: '✅ Recordatorio Enviado',
          text: `Se ha enviado el recordatorio por ${recordatorio.canal}`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });

      } catch (error) {
        console.error('Error al enviar recordatorio:', error);

        await Swal.fire({
          title: 'Error al Enviar',
          text: 'No se pudo enviar el recordatorio. Intenta nuevamente.',
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      }
    }
  }

  async cancelarRecordatorio(recordatorio: Recordatorio) {
    const result = await Swal.fire({
      title: '¿Cancelar Recordatorio?',
      text: `Se cancelará el recordatorio para ${recordatorio.cliente_nombre}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No',
      confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
      try {
        await this.recordatoriosService.cancelarRecordatorio(recordatorio.id!);

        await Swal.fire({
          title: 'Recordatorio Cancelado',
          text: 'El recordatorio ha sido cancelado',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });

      } catch (error) {
        console.error('Error al cancelar recordatorio:', error);

        await Swal.fire({
          title: 'Error',
          text: 'No se pudo cancelar el recordatorio',
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      }
    }
  }

  async programarRecordatoriosAutomaticos() {
    const result = await Swal.fire({
      title: '¿Programar Recordatorios Automáticos?',
      text: 'Se crearán recordatorios para todas las cuentas que vencen en los próximos 3 días',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, programar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await this.recordatoriosService.programarRecordatoriosVencimiento();

        await Swal.fire({
          title: '✅ Recordatorios Programados',
          text: 'Se han programado los recordatorios automáticos',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });

      } catch (error) {
        console.error('Error al programar recordatorios:', error);

        await Swal.fire({
          title: 'Error',
          text: 'No se pudieron programar los recordatorios',
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      }
    }
  }

  abrirWhatsApp(recordatorio: Recordatorio) {
    if (recordatorio.telefono) {
      const mensaje = encodeURIComponent(recordatorio.mensaje);
      const url = `https://wa.me/${recordatorio.telefono.replace(/\D/g, '')}?text=${mensaje}`;
      window.open(url, '_blank');
    }
  }

  getEstadoBadgeClass(estado: string): string {
    const estadoInfo = this.estadosRecordatorio.find(e => e.valor === estado);
    const base = 'badge rounded-pill ';

    switch (estadoInfo?.color) {
      case 'green': return base + 'bg-success-subtle text-success border border-success-subtle';
      case 'yellow': return base + 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      case 'red': return base + 'bg-danger-subtle text-danger border border-danger-subtle';
      case 'gray': return base + 'bg-secondary-subtle text-secondary border border-secondary-subtle';
      default: return base + 'bg-primary-subtle text-primary border border-primary-subtle';
    }
  }

  getCanalIcon(canal: string): string {
    const canalInfo = this.canalesRecordatorio.find(c => c.valor === canal);
    return canalInfo?.icono || 'fa-bell';
  }

  getTipoIcon(tipo: string): string {
    const tipoInfo = this.tiposRecordatorio.find(t => t.valor === tipo);
    return tipoInfo?.icono || 'fa-bell';
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get recordatoriosPendientes(): number {
    return this.recordatorios.filter(r => r.estado === 'pendiente').length;
  }

  get recordatoriosEnviados(): number {
    return this.recordatorios.filter(r => r.estado === 'enviado').length;
  }

  get recordatoriosFallidos(): number {
    return this.recordatorios.filter(r => r.estado === 'fallido').length;
  }
}