import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProveedoresService } from '../../../services/proveedores.service';
import { Proveedor } from '../../../models/proveedores.model';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-proveedores',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './modal.proveedores.html',
  styleUrl: './modal.proveedores.css'
})
export class ModalProveedoresComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() proveedorGuardado = new EventEmitter<Proveedor>();
  @Input() proveedorEditar?: Proveedor;

  proveedorForm: FormGroup;
  isLoading = false;
  editando = false;

  constructor(
    private fb: FormBuilder,
    private proveedoresService: ProveedoresService
  ) {
    this.proveedorForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      documento: ['', [Validators.maxLength(50)]],
      tipo_documento: ['RNC', [Validators.maxLength(20)]], // Defaulting to RNC as it is LicorPos (likely DR)
      telefono: ['', [Validators.maxLength(20)]],
      email: ['', [Validators.email, Validators.maxLength(255)]],
      direccion: ['', []], // Text type, no specific max length in validator usually, but let's keep it open
      ciudad: ['', [Validators.maxLength(100)]],
      pais: ['República Dominicana', [Validators.maxLength(100)]], // Default to RD
      contacto: ['', [Validators.maxLength(100)]],
      activo: [true]
    });
  }

  ngOnInit() {
    if (this.proveedorEditar) {
      this.editando = true;
      this.llenarFormulario(this.proveedorEditar);
    }
  }

  private llenarFormulario(proveedor: Proveedor) {
    this.proveedorForm.patchValue({
      nombre: proveedor.nombre,
      documento: proveedor.documento || '',
      tipo_documento: proveedor.tipo_documento || 'RNC',
      telefono: proveedor.telefono || '',
      email: proveedor.email || '',
      direccion: proveedor.direccion || '',
      ciudad: proveedor.ciudad || '',
      pais: proveedor.pais || 'República Dominicana',
      contacto: proveedor.contacto || '',
      activo: proveedor.activo
    });
  }

  cerrarModal() {
    this.close.emit();
  }

  async guardarProveedor() {
    if (this.proveedorForm.valid && !this.isLoading) {
      this.isLoading = true;

      try {
        const formData = this.proveedorForm.value;
        let proveedorGuardado: Proveedor;

        if (this.editando && this.proveedorEditar) {
          proveedorGuardado = await this.proveedoresService.actualizarProveedor(
            this.proveedorEditar.id!,
            formData
          );

          await Swal.fire({
            title: '¡Actualizado!',
            text: `El proveedor "${proveedorGuardado.nombre}" ha sido actualizado.`,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        } else {
          proveedorGuardado = await this.proveedoresService.crearProveedor(formData);

          await Swal.fire({
            title: '¡Creado!',
            text: `El proveedor "${proveedorGuardado.nombre}" ha sido creado exitosamente.`,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        }

        this.proveedorForm.reset();
        this.proveedorGuardado.emit(proveedorGuardado);
        this.cerrarModal();

      } catch (error: any) {
        console.error('❌ Error al guardar proveedor:', error);

        let mensajeError = `Error al ${this.editando ? 'actualizar' : 'crear'} el proveedor.`;
        if (error.message) {
          mensajeError = error.message;
        }

        await Swal.fire({
          title: 'Error',
          text: mensajeError,
          icon: 'error',
          confirmButtonText: 'Entendido'
        });

      } finally {
        this.isLoading = false;
      }
    } else {
      this.marcarCamposComoTocados();
    }
  }

  private marcarCamposComoTocados() {
    Object.keys(this.proveedorForm.controls).forEach(key => {
      this.proveedorForm.get(key)?.markAsTouched();
    });
  }

  get f() {
    return this.proveedorForm.controls;
  }

  tieneError(campo: string): boolean {
    const control = this.proveedorForm.get(campo);
    return !!(control && control.invalid && control.touched);
  }

  getMensajeError(campo: string): string {
    const control = this.proveedorForm.get(campo);

    if (control?.errors) {
      if (control.errors['required']) return `${campo} es requerido`;
      if (control.errors['minlength']) return `${campo} debe tener al menos ${control.errors['minlength'].requiredLength} caracteres`;
      if (control.errors['maxlength']) return `${campo} no puede tener más de ${control.errors['maxlength'].requiredLength} caracteres`;
      if (control.errors['email']) return 'Email inválido';
      if (control.errors['min']) return `El valor mínimo es ${control.errors['min'].min}`;
      if (control.errors['max']) return `El valor máximo es ${control.errors['max'].max}`;
    }

    return '';
  }
}
