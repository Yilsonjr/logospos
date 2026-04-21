import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CuentaPorCobrar, METODOS_PAGO_CUENTA } from '../../../models/cuentas-cobrar.model';
import { CuentasCobrarService } from '../../../services/cuentas-cobrar.service';
import Swal from 'sweetalert2';

export interface FacturaSimulada {
  cuenta: CuentaPorCobrar;
  montoAplicado: number;       // cuánto de este abono va a esta factura
  pendienteDespues: number;    // lo que queda después del pago
  saldada: boolean;            // ¿queda en 0?
  parcial: boolean;            // ¿pago parcial?
  sinTocar: boolean;           // ¿el abono no alcanzó?
}

@Component({
  selector: 'app-modal-pago-masivo',
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-pago-masivo.component.html',
  styleUrl: './modal-pago-masivo.component.css'
})
export class ModalPagoMasivoComponent implements OnInit, OnChanges {
  @Input() clienteNombre: string = '';
  @Input() clienteId!: number;
  @Input() cuentas: CuentaPorCobrar[] = [];  // ya vienen ordenadas FIFO (más antiguas primero)
  @Output() close = new EventEmitter<void>();
  @Output() pagoRegistrado = new EventEmitter<void>();

  metodosPago = METODOS_PAGO_CUENTA;
  metodoPago = 'Efectivo';
  fechaPago = new Date().toISOString().split('T')[0];
  referencia = '';
  notas = '';
  isSaving = false;

  // Monto ingresado como string para controlar la entrada
  montoInput: number = 0;

  // Simulación FIFO
  simulacion: FacturaSimulada[] = [];

  constructor(private cuentasService: CuentasCobrarService) {}

  ngOnInit() {
    this.montoInput = this.totalDeuda;
    this.recalcularSimulacion();
  }

  ngOnChanges() {
    this.montoInput = this.totalDeuda;
    this.recalcularSimulacion();
  }

  // === CÓMPUTOS BÁSICOS ===
  get totalDeuda(): number {
    return this.cuentas.reduce((s, c) => s + c.monto_pendiente, 0);
  }

  get cantidadFacturas(): number {
    return this.cuentas.length;
  }

  get esSaldoTotal(): boolean {
    return this.montoInput >= this.totalDeuda;
  }

  get pendienteResidualdespuesPago(): number {
    return Math.max(0, this.totalDeuda - this.montoInput);
  }

  get facturasSaldadas(): number {
    return this.simulacion.filter(s => s.saldada).length;
  }

  get facturasParciales(): number {
    return this.simulacion.filter(s => s.parcial).length;
  }

  get facturasSinTocar(): number {
    return this.simulacion.filter(s => s.sinTocar).length;
  }

  get puedeConfirmar(): boolean {
    return this.montoInput > 0 && this.montoInput <= this.totalDeuda && !this.isSaving;
  }

  // === SIMULACIÓN FIFO ===
  recalcularSimulacion() {
    let restante = Math.max(0, this.montoInput || 0);
    this.simulacion = this.cuentas.map(cuenta => {
      if (restante <= 0) {
        return { cuenta, montoAplicado: 0, pendienteDespues: cuenta.monto_pendiente, saldada: false, parcial: false, sinTocar: true };
      }
      const aplicar = Math.min(restante, cuenta.monto_pendiente);
      restante -= aplicar;
      const despues = Math.max(0, cuenta.monto_pendiente - aplicar);
      return {
        cuenta,
        montoAplicado: aplicar,
        pendienteDespues: despues,
        saldada: despues <= 0,
        parcial: aplicar > 0 && despues > 0,
        sinTocar: aplicar === 0
      };
    });
  }

  onMontoChange() {
    // clamp al total
    if (this.montoInput > this.totalDeuda) {
      this.montoInput = this.totalDeuda;
    }
    this.recalcularSimulacion();
  }

  pagarTodo() {
    this.montoInput = this.totalDeuda;
    this.recalcularSimulacion();
  }

  // === CONFIRMAR PAGO ===
  async confirmarPago() {
    if (!this.puedeConfirmar) return;

    const result = await Swal.fire({
      title: 'Confirmar Pago',
      html: `
        <div class="text-start">
          <p><strong>Cliente:</strong> ${this.clienteNombre}</p>
          <p><strong>Monto a pagar:</strong> ${this.formatearMoneda(this.montoInput)}</p>
          <p><strong>Facturas a saldar:</strong> ${this.facturasSaldadas}</p>
          ${this.facturasParciales > 0 ? `<p><strong>Facturas con abono parcial:</strong> ${this.facturasParciales}</p>` : ''}
          ${this.pendienteResidualdespuesPago > 0
            ? `<p class="text-warning fw-bold">⚠️ Quedará pendiente: ${this.formatearMoneda(this.pendienteResidualdespuesPago)}</p>`
            : '<p class="text-success fw-bold">✅ Toda la deuda quedará saldada</p>'
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
      // Procesar solo facturas que recibieron algo
      const conPago = this.simulacion.filter(s => s.montoAplicado > 0);

      for (const sim of conPago) {
        await this.cuentasService.registrarPago({
          cuenta_id: sim.cuenta.id!,
          monto: sim.montoAplicado,
          metodo_pago: this.metodoPago,
          fecha_pago: this.fechaPago,
          referencia: this.referencia || undefined,
          notas: this.notas || `Abono masivo FIFO – ${conPago.length} facturas`
        });
      }

      this.close.emit();
      await new Promise(r => setTimeout(r, 200));

      await Swal.fire({
        title: '✅ Pago Registrado',
        html: `
          <div class="text-start">
            <p><strong>Cliente:</strong> ${this.clienteNombre}</p>
            <p><strong>Monto aplicado:</strong> ${this.formatearMoneda(this.montoInput)}</p>
            <p><strong>Facturas saldadas:</strong> ${this.facturasSaldadas}</p>
            ${this.pendienteResidualdespuesPago > 0
              ? `<p class="text-warning">Pendiente restante: ${this.formatearMoneda(this.pendienteResidualdespuesPago)}</p>`
              : '<p class="text-success">Toda la deuda fue saldada ✨</p>'
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
      console.error('Error en pago masivo:', error);
      await Swal.fire({
        title: 'Error al Procesar Pago',
        text: error.message || 'Ocurrió un error inesperado.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    } finally {
      this.isSaving = false;
    }
  }

  cerrar() { this.close.emit(); }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(valor);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-DO', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
