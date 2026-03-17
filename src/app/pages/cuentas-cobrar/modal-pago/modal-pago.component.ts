import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CuentaPorCobrar, METODOS_PAGO_CUENTA } from '../../../models/cuentas-cobrar.model';
import { CuentasCobrarService } from '../../../services/cuentas-cobrar.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-pago',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modal-pago.component.html',
  styleUrl: './modal-pago.component.css'
})
export class ModalPagoComponent implements OnInit {
  @Input() cuenta!: CuentaPorCobrar;
  @Output() close = new EventEmitter<void>();
  @Output() pagoRegistrado = new EventEmitter<void>();

  pagoForm: FormGroup;
  metodosPago = METODOS_PAGO_CUENTA;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private cuentasService: CuentasCobrarService
  ) {
    this.pagoForm = this.fb.group({
      monto: ['', [Validators.required, Validators.min(0.01)]],
      metodo_pago: ['Efectivo', Validators.required],
      fecha_pago: [new Date().toISOString().split('T')[0], Validators.required],
      referencia: [''],
      notas: ['']
    });
  }

  ngOnInit() {
    // Establecer el monto pendiente como valor por defecto
    this.pagoForm.patchValue({
      monto: this.cuenta.monto_pendiente
    });
  }

  cerrarModal() {
    this.close.emit();
  }

  async guardarPago() {
    if (this.pagoForm.valid && !this.isSaving) {
      this.isSaving = true;

      try {
        const formValue = this.pagoForm.value;
        const monto = Number(formValue.monto);

        // Validar que el monto no sea mayor al pendiente
        if (monto > this.cuenta.monto_pendiente) {
          await Swal.fire({
            title: 'Monto Inválido',
            text: `El monto no puede ser mayor al pendiente (${this.formatearMoneda(this.cuenta.monto_pendiente)})`,
            icon: 'warning',
            confirmButtonText: 'Entendido'
          });
          this.isSaving = false;
          return;
        }

        // Validar monto mínimo
        if (monto <= 0) {
          await Swal.fire({
            title: 'Monto Inválido',
            text: 'El monto debe ser mayor a cero',
            icon: 'warning',
            confirmButtonText: 'Entendido'
          });
          this.isSaving = false;
          return;
        }

        const pago = {
          cuenta_id: this.cuenta.id!,
          monto: monto,
          metodo_pago: formValue.metodo_pago,
          fecha_pago: formValue.fecha_pago,
          referencia: formValue.referencia || null,
          notas: formValue.notas || null
        };

        await this.cuentasService.registrarPago(pago);
        
        // Cerrar modal primero
        this.cerrarModal();
        
        // Esperar un momento antes de mostrar SweetAlert
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Mostrar mensaje de éxito
        await Swal.fire({
          title: '✅ Pago Registrado',
          html: `
            <div class="text-left">
              <p><strong>Cliente:</strong> ${this.cuenta.cliente_nombre}</p>
              <p><strong>Monto:</strong> ${this.formatearMoneda(monto)}</p>
              <p><strong>Método:</strong> ${formValue.metodo_pago}</p>
              <p><strong>Pendiente:</strong> ${this.formatearMoneda(this.cuenta.monto_pendiente - monto)}</p>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Aceptar',
          timer: 4000,
          timerProgressBar: true
        });
        
        this.pagoRegistrado.emit();

      } catch (error: any) {
        console.error('❌ Error al registrar pago:', error);
        
        await Swal.fire({
          title: 'Error al Registrar Pago',
          text: error.message || 'Ocurrió un error inesperado. Intenta nuevamente.',
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      } finally {
        this.isSaving = false;
      }
    } else {
      this.marcarCamposComoTocados();
      
      await Swal.fire({
        title: 'Campos Incompletos',
        text: 'Por favor completa todos los campos requeridos',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
    }
  }

  pagarTotal() {
    this.pagoForm.patchValue({
      monto: this.cuenta.monto_pendiente
    });
  }

  private marcarCamposComoTocados() {
    Object.keys(this.pagoForm.controls).forEach(key => {
      this.pagoForm.get(key)?.markAsTouched();
    });
  }

  get f() {
    return this.pagoForm.controls;
  }

  tieneError(campo: string): boolean {
    const control = this.pagoForm.get(campo);
    return !!(control && control.invalid && control.touched);
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }

  get montoPendienteDespuesPago(): number {
    const montoActual = Number(this.pagoForm.get('monto')?.value || 0);
    return Math.max(0, this.cuenta.monto_pendiente - montoActual);
  }

  get esPagoCompleto(): boolean {
    const montoActual = Number(this.pagoForm.get('monto')?.value || 0);
    return montoActual >= this.cuenta.monto_pendiente;
  }
}