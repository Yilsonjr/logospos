import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ClientesService } from '../../../services/clientes.service';
import { Cliente, TIPOS_CLIENTE } from '../../../models/clientes.model';

@Component({
  selector: 'app-modal-clientes',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './modal.clientes.html',
  styleUrl: './modal.clientes.css'
})
export class ModalClientesComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() clienteGuardado = new EventEmitter<Cliente>();
  @Input() clienteEditar?: Cliente;

  clienteForm: FormGroup;
  isLoading = false;
  editando = false;
  mostrarNotas = false;
  tiposCliente = TIPOS_CLIENTE;

  constructor(
    private fb: FormBuilder,
    private clientesService: ClientesService
  ) {
    this.clienteForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      cedula: ['', [Validators.maxLength(50)]],
      rnc: ['', [Validators.maxLength(50)]],
      telefono: ['', [Validators.maxLength(20)]],
      email: ['', [Validators.email, Validators.maxLength(100)]],
      direccion: ['', [Validators.maxLength(500)]],
      tipo_cliente: ['regular', Validators.required],
      limite_credito: [0, [Validators.min(0)]],
      descuento_porcentaje: [0, [Validators.min(0), Validators.max(100)]],
      notas: [''],
      activo: [true]
    });
  }

  ngOnInit() {
    if (this.clienteEditar) {
      this.editando = true;
      this.llenarFormulario(this.clienteEditar);
    }
  }

  private llenarFormulario(cliente: Cliente) {
    this.clienteForm.patchValue({
      nombre: cliente.nombre,
      cedula: cliente.cedula || '',
      rnc: cliente.rnc || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      direccion: cliente.direccion || '',
      tipo_cliente: cliente.tipo_cliente,
      limite_credito: cliente.limite_credito,
      descuento_porcentaje: cliente.descuento_porcentaje,
      notas: cliente.notas || '',
      activo: cliente.activo
    });
  }

  cerrarModal() {
    this.close.emit();
  }

  async guardarCliente() {
    if (this.clienteForm.valid && !this.isLoading) {
      this.isLoading = true;

      try {
        const formData = this.clienteForm.value;
        let clienteGuardado: Cliente;

        if (this.editando && this.clienteEditar) {
          clienteGuardado = await this.clientesService.actualizarCliente(
            this.clienteEditar.id!,
            formData
          );
          console.log('✅ Cliente actualizado:', clienteGuardado.nombre);
        } else {
          clienteGuardado = await this.clientesService.crearCliente(formData);
          console.log('✅ Cliente creado:', clienteGuardado.nombre);
        }

        this.clienteForm.reset();
        this.clienteGuardado.emit(clienteGuardado);
        this.cerrarModal();

      } catch (error: any) {
        console.error('❌ Error al guardar cliente:', error);

        let mensajeError = `Error al ${this.editando ? 'actualizar' : 'crear'} el cliente.`;
        if (error.message) {
          mensajeError = error.message;
        }
        alert(mensajeError);

      } finally {
        this.isLoading = false;
      }
    } else {
      this.marcarCamposComoTocados();
    }
  }

  private marcarCamposComoTocados() {
    Object.keys(this.clienteForm.controls).forEach(key => {
      this.clienteForm.get(key)?.markAsTouched();
    });
  }

  get f() {
    return this.clienteForm.controls;
  }

  tieneError(campo: string): boolean {
    const control = this.clienteForm.get(campo);
    return !!(control && control.invalid && control.touched);
  }

  getMensajeError(campo: string): string {
    const control = this.clienteForm.get(campo);

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

  getTipoClienteInfo(tipo: string) {
    return this.tiposCliente.find(t => t.valor === tipo);
  }
}
