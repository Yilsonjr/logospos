import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { AuthService } from '../../../services/auth.service';
import { Caja, CrearCaja } from '../../../models/caja.model';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-apertura-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './apertura-caja.component.html',
  styleUrl: './apertura-caja.component.css'
})
export class AperturaCajaComponent implements OnInit, OnDestroy {
  cajaAbierta: Caja | null = null;
  montoInicial: number | null = null;
  notasApertura: string = '';
  usuario: string = '';
  fechaActual: string = new Date().toISOString();

  mostrarConfirmacion: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private cajaService: CajaService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    console.log('🔄 Apertura Caja: Iniciando...');
    this.usuario = this.authService.usuarioActual?.username || 'Desconocido';

    // Cargar datos iniciales INMEDIATAMENTE
    await this.cargarDatos();

    // Suscribirse a cambios de navegación para recargar
    const navSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(async (event: any) => {
      if (event.url.includes('/caja/apertura')) {
        console.log('🔄 Recargando apertura por navegación...');
        await this.cargarDatos();
      }
    });

    this.subscriptions.push(navSub);
    console.log('✅ Apertura Caja: Inicialización completada');
  }

  ngOnDestroy() {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarDatos() {
    console.log('🔄 Apertura: Verificando estado de caja...');

    try {
      // Forzar verificación fresca de la base de datos (sin cache)
      const caja = await this.cajaService.verificarCajaAbierta(true);
      this.cajaAbierta = caja;

      // Forzar detección de cambios
      this.cdr.detectChanges();

      if (caja) {
        console.log('✅ Caja abierta encontrada:', {
          id: caja.id,
          monto_inicial: caja.monto_inicial,
          fecha_apertura: caja.fecha_apertura
        });
      } else {
        console.log('✅ No hay caja abierta - listo para apertura');
      }
    } catch (error) {
      console.error('❌ Error al verificar caja:', error);
      this.cajaAbierta = null;
      this.cdr.detectChanges();
    }
  }

  async verificarCajaAbierta() {
    try {
      console.log('🔄 Verificación manual de caja...');
      await this.cargarDatos();
    } catch (error) {
      console.error('Error al verificar caja:', error);
    }
  }

  async validarFormulario(): Promise<boolean> {
    if (this.montoInicial === null || this.montoInicial < 0) {
      await Swal.fire({
        title: 'Error',
        text: 'El monto inicial no puede ser negativo',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
      return false;
    }

    if (this.montoInicial === 0) {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Deseas abrir la caja con RD$0.00?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, abrir',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) {
        return false;
      }
    }

    return true;
  }

  async mostrarModalConfirmacion() {
    if (!(await this.validarFormulario())) return;
    this.mostrarConfirmacion = true;
  }

  cerrarModalConfirmacion() {
    this.mostrarConfirmacion = false;
  }

  async abrirCaja() {
    console.log('🚀 Iniciando proceso de apertura de caja...');

    // Cerrar modal INMEDIATAMENTE para feedback rápido
    this.mostrarConfirmacion = false;

    if (this.montoInicial === null) {
      console.warn('⚠️ Monto inicial es null, abortando.');
      return;
    }

    try {
      const nuevaCaja: CrearCaja = {
        fecha_apertura: new Date().toISOString(),
        monto_inicial: this.montoInicial || 0,
        estado: 'abierta',
        usuario_apertura: this.usuario,
        notas_apertura: this.notasApertura
      };

      console.log('📡 Enviando datos al servicio:', nuevaCaja);
      const cajaCreada = await this.cajaService.abrirCaja(nuevaCaja);
      console.log('✅ Caja creada recibida:', cajaCreada);

      // Esperar un momento para que el modal se cierre visualmente
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mostrar SweetAlert de éxito
      await Swal.fire({
        title: '✅ Caja Abierta',
        html: `Monto inicial: ${this.formatearMoneda(this.montoInicial)}<br>Fecha: ${this.formatearFecha(cajaCreada.fecha_apertura)}`,
        icon: 'success',
        confirmButtonText: 'Aceptar',
        timer: 3000,
        timerProgressBar: true
      });

      // Actualizar la vista local
      this.cajaAbierta = cajaCreada;
      this.cdr.detectChanges();

      // Limpiar formulario
      this.montoInicial = null;
      this.notasApertura = '';

    } catch (error: any) {
      console.error('Error al abrir caja:', error);

      // Cerrar modal en caso de error también
      this.mostrarConfirmacion = false;

      // Esperar un momento
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mostrar error más detallado
      let mensajeError = 'Error al abrir la caja. Intenta nuevamente.';

      if (error.message?.includes('Ya existe una caja abierta')) {
        mensajeError = 'Ya existe una caja abierta. Debe cerrarla primero.';
      } else if (error.code) {
        mensajeError = `Error de base de datos: ${error.message || error.code}`;
      }

      await Swal.fire({
        title: 'Error',
        text: mensajeError,
        icon: 'error',
        confirmButtonText: 'Aceptar',
        footer: error.hint ? `<small>${error.hint}</small>` : undefined
      });

      if (error.message?.includes('Ya existe una caja abierta')) {
        await this.verificarCajaAbierta();
      }
    }
  }

  irACierre() {
    this.router.navigate(['/caja/cierre']);
  }

  irAHistorial() {
    this.router.navigate(['/caja/historial']);
  }

  formatearMoneda(valor: number | null): string {
    if (valor === null) return 'RD$0.00';
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
