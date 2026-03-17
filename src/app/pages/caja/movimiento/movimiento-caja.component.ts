import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { Caja, CrearMovimientoCaja, CONCEPTOS_ENTRADA, CONCEPTOS_SALIDA } from '../../../models/caja.model';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-movimiento-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './movimiento-caja.component.html',
  styleUrl: './movimiento-caja.component.css'
})
export class MovimientoCajaComponent implements OnInit, OnDestroy {
  tipo: 'entrada' | 'salida' = 'entrada';
  cajaActual: Caja | null = null;

  monto: number | null = null;
  concepto: string = '';
  metodo: 'efectivo' | 'tarjeta' = 'efectivo';
  referencia: string = '';
  notas: string = '';
  usuario: string = 'admin';

  conceptos: readonly string[] = [];
  movimientosRecientes: any[] = [];
  mostrarModal: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private cajaService: CajaService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) { }

  async ngOnInit() {
    await this.cargarDatos();

    const navSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(async (event: any) => {
      if (event.url.includes('/caja/entrada-efectivo') || event.url.includes('/caja/salida-efectivo')) {
        await this.cargarDatos();
      }
    });

    this.subscriptions.push(navSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarDatos() {
    this.route.url.subscribe(segments => {
      const path = segments[segments.length - 1]?.path;
      this.tipo = path === 'salida-efectivo' ? 'salida' : 'entrada';
      this.conceptos = this.tipo === 'entrada' ? CONCEPTOS_ENTRADA : CONCEPTOS_SALIDA;
    });

    await this.verificarCaja();
    if (this.cajaActual) {
      await this.cargarMovimientosRecientes();
    }

    this.cdr.detectChanges();
  }

  async verificarCaja() {
    this.cajaActual = await this.cajaService.verificarCajaAbierta(true);

    if (!this.cajaActual) {
      await Swal.fire({
        title: 'Sin Caja Abierta',
        text: 'No hay una caja abierta para registrar movimientos',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      this.router.navigate(['/caja/apertura']);
    }

    this.cdr.detectChanges();
  }

  async cargarMovimientosRecientes() {
    if (!this.cajaActual) return;

    try {
      const movimientos = await this.cajaService.obtenerMovimientos(this.cajaActual.id!);
      this.movimientosRecientes = movimientos
        .filter(m => m.tipo === this.tipo)
        .slice(0, 10);

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
    }
  }

  abrirModal() {
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.limpiarFormulario();
    this.cdr.detectChanges();
  }

  async registrarMovimiento() {
    if (!this.cajaActual || !this.monto || this.monto <= 0 || !this.concepto) {
      await Swal.fire({
        title: 'Campos Incompletos',
        text: 'Complete todos los campos requeridos',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    // Guardar valores ANTES de hacer cualquier cosa
    const montoRegistrado = this.monto;
    const conceptoRegistrado = this.concepto;

    try {
      const usuarioId = this.authService.usuarioActual?.id || 1;
      const conceptoFinal = this.metodo ? `${conceptoRegistrado} (${this.metodo.charAt(0).toUpperCase() + this.metodo.slice(1)})` : conceptoRegistrado;

      const movimiento: any = {
        caja_id: this.cajaActual.id!,
        tipo: this.tipo,
        concepto: conceptoFinal,
        monto: montoRegistrado,
        referencia: this.referencia || undefined,
        usuario_id: usuarioId
      };

      await this.cajaService.registrarMovimiento(movimiento);

      // Cerrar modal
      this.mostrarModal = false;
      this.cdr.detectChanges();

      // Limpiar formulario
      this.limpiarFormulario();

      // Recargar movimientos
      await this.cargarMovimientosRecientes();

      // Esperar antes de mostrar SweetAlert
      await new Promise(resolve => setTimeout(resolve, 200));

      // Mostrar mensaje de éxito
      await Swal.fire({
        title: `✅ ${this.tipo === 'entrada' ? 'Entrada' : 'Salida'} Registrada`,
        html: `Monto: ${this.formatearMoneda(montoRegistrado)}<br>Concepto: ${conceptoRegistrado}`,
        icon: 'success',
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: false
      });

    } catch (error) {
      console.error('Error al registrar movimiento:', error);

      this.mostrarModal = false;
      this.cdr.detectChanges();

      await new Promise(resolve => setTimeout(resolve, 100));

      await Swal.fire({
        title: 'Error',
        text: 'Error al registrar el movimiento. Intenta nuevamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  limpiarFormulario() {
    this.monto = null;
    this.concepto = '';
    this.referencia = '';
    this.notas = '';
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(valor);
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
