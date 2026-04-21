import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CuentaPorCobrar, METODOS_PAGO_CUENTA } from '../../../models/cuentas-cobrar.model';
import { CuentasCobrarService } from '../../../services/cuentas-cobrar.service';
import Swal from 'sweetalert2';

interface CuentaSeleccionable extends CuentaPorCobrar {
  seleccionada: boolean;
}

@Component({
  selector: 'app-modal-pago-masivo',
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-pago-masivo.component.html',
  styleUrl: './modal-pago-masivo.component.css'
})
export class ModalPagoMasivoComponent implements OnInit {
  @Input() clienteNombre: string = '';
  @Input() clienteId!: number;
  @Input() cuentas: CuentaPorCobrar[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() pagoRegistrado = new EventEmitter<void>();

  cuentasSeleccionables: CuentaSeleccionable[] = [];
  metodosPago = METODOS_PAGO_CUENTA;
  metodoPago = 'Efectivo';
  fechaPago = new Date().toISOString().split('T')[0];
  referencia = '';
  notas = '';
  montoPersonalizado: number | null = null;
  modoMonto: 'total' | 'personalizado' = 'total';
  isSaving = false;

  ngOnInit() {
    // Solo cuentas no pagadas
    this.cuentasSeleccionables = this.cuentas
      .filter(c => c.estado !== 'pagada' && c.monto_pendiente > 0)
      .map(c => ({ ...c, seleccionada: true }));
  }

  // === SELECCIÓN ===
  get todasSeleccionadas(): boolean {
    return this.cuentasSeleccionables.length > 0 && this.cuentasSeleccionables.every(c => c.seleccionada);
  }

  toggleTodas() {
    const nuevoValor = !this.todasSeleccionadas;
    this.cuentasSeleccionables.forEach(c => c.seleccionada = nuevoValor);
  }

  get cuentasSeleccionadasList(): CuentaSeleccionable[] {
    return this.cuentasSeleccionables.filter(c => c.seleccionada);
  }

  get totalSeleccionado(): number {
    return this.cuentasSeleccionadasList.reduce((sum, c) => sum + c.monto_pendiente, 0);
  }

  get cantidadSeleccionadas(): number {
    return this.cuentasSeleccionadasList.length;
  }

  // === MONTO A PAGAR ===
  get montoAPagar(): number {
    if (this.modoMonto === 'personalizado' && this.montoPersonalizado !== null) {
      return Math.min(this.montoPersonalizado, this.totalSeleccionado);
    }
    return this.totalSeleccionado;
  }

  get esPagoCompleto(): boolean {
    return this.montoAPagar >= this.totalSeleccionado;
  }

  get pendienteDespuesPago(): number {
    return Math.max(0, this.totalSeleccionado - this.montoAPagar);
  }

  // === VALIDACIÓN ===
  get puedeConfirmar(): boolean {
    return this.cantidadSeleccionadas > 0 && this.montoAPagar > 0 && !this.isSaving;
  }

  // === ACCIONES ===
  cerrar() {
    this.close.emit();
  }

  async confirmarPago() {
    if (!this.puedeConfirmar) return;

    const cuentasAPagar = this.cuentasSeleccionadasList;
    const montoTotal = this.montoAPagar;

    // Confirmar con el usuario
    const result = await Swal.fire({
      title: 'Confirmar Pago Masivo',
      html: `
        <div class="text-start">
          <p><strong>Cliente:</strong> ${this.clienteNombre}</p>
          <p><strong>Facturas:</strong> ${cuentasAPagar.length}</p>
          <p><strong>Monto total:</strong> ${this.formatearMoneda(montoTotal)}</p>
          <p><strong>Método:</strong> ${this.metodoPago}</p>
          ${this.esPagoCompleto
            ? '<p class="text-success fw-bold">✅ Se saldarán todas las facturas seleccionadas</p>'
            : `<p class="text-warning fw-bold">⚠️ Quedará un pendiente de ${this.formatearMoneda(this.pendienteDespuesPago)}</p>`
          }
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar Pago',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0d6efd'
    });

    if (!result.isConfirmed) return;

    this.isSaving = true;

    try {
      // Distribuir el monto entre las facturas seleccionadas (FIFO: primero las más viejas)
      let montoRestante = montoTotal;

      for (const cuenta of cuentasAPagar) {
        if (montoRestante <= 0) break;

        const montoParaEstaCuenta = Math.min(montoRestante, cuenta.monto_pendiente);
        montoRestante -= montoParaEstaCuenta;

        await this.cuentasService.registrarPago({
          cuenta_id: cuenta.id!,
          monto: montoParaEstaCuenta,
          metodo_pago: this.metodoPago,
          fecha_pago: this.fechaPago,
          referencia: this.referencia || undefined,
          notas: this.notas || `Pago masivo - ${cuentasAPagar.length} facturas`
        });
      }

      this.cerrar();

      await new Promise(resolve => setTimeout(resolve, 200));

      await Swal.fire({
        title: '✅ Pago Masivo Registrado',
        html: `
          <div class="text-start">
            <p><strong>Cliente:</strong> ${this.clienteNombre}</p>
            <p><strong>Facturas procesadas:</strong> ${cuentasAPagar.length}</p>
            <p><strong>Monto pagado:</strong> ${this.formatearMoneda(montoTotal)}</p>
            ${this.esPagoCompleto
              ? '<p class="text-success fw-bold mt-2">Todas las facturas han sido saldadas ✨</p>'
              : `<p class="text-warning mt-2">Pendiente restante: ${this.formatearMoneda(this.pendienteDespuesPago)}</p>`
            }
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'Aceptar',
        timer: 5000,
        timerProgressBar: true
      });

      this.pagoRegistrado.emit();

    } catch (error: any) {
      console.error('❌ Error en pago masivo:', error);
      await Swal.fire({
        title: 'Error al Procesar Pago',
        text: error.message || 'Ocurrió un error. Algunas facturas podrían haberse procesado.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    } finally {
      this.isSaving = false;
    }
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  constructor(private cuentasService: CuentasCobrarService) {}
}
