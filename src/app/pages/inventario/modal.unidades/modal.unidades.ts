import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UnidadesService } from '../../../services/unidades.service';
import { Unidad } from '../../../models/unidades.model';

@Component({
    selector: 'app-modal-unidades',
    imports: [ReactiveFormsModule, CommonModule],
    templateUrl: './modal.unidades.html',
    styleUrl: './modal.unidades.css'
})
export class ModalUnidadesComponent implements OnInit {
    @Output() close = new EventEmitter<void>();
    @Output() unidadGuardada = new EventEmitter<Unidad>();

    @Input() unidadEditar?: Unidad;

    unidadForm: FormGroup;
    isLoading = false;
    editando = false;

    constructor(
        private fb: FormBuilder,
        private unidadesService: UnidadesService
    ) {
        this.unidadForm = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
            abreviatura: ['', [Validators.maxLength(10)]],
            activo: [true]
        });
    }

    ngOnInit() {
        if (this.unidadEditar) {
            this.editando = true;
            this.llenarFormulario(this.unidadEditar);
        }
    }

    private llenarFormulario(unidad: Unidad) {
        this.unidadForm.patchValue({
            nombre: unidad.nombre,
            abreviatura: unidad.abreviatura || '',
            activo: unidad.activo
        });
    }

    cerrarModal() {
        this.close.emit();
    }

    async guardarUnidad() {
        if (this.unidadForm.valid && !this.isLoading) {
            this.isLoading = true;

            try {
                const formData = this.unidadForm.value;
                let unidadGuardada: Unidad;

                if (this.editando && this.unidadEditar) {
                    unidadGuardada = await this.unidadesService.actualizarUnidad(this.unidadEditar.id!, formData);
                } else {
                    unidadGuardada = await this.unidadesService.crearUnidad(formData);
                }

                this.unidadForm.reset({ activo: true });
                this.unidadGuardada.emit(unidadGuardada);
                this.cerrarModal();
            } catch (error: any) {
                let mensajeError = `Error al ${this.editando ? 'actualizar' : 'crear'} la unidad.`;
                if (error.code === '23505') {
                    mensajeError = `Ya existe una unidad con el nombre "${this.unidadForm.get('nombre')?.value}"`;
                } else if (error.message) {
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
        Object.keys(this.unidadForm.controls).forEach(key => {
            this.unidadForm.get(key)?.markAsTouched();
        });
    }

    get f() { return this.unidadForm.controls; }

    tieneError(campo: string): boolean {
        const control = this.unidadForm.get(campo);
        return !!(control && control.invalid && control.touched);
    }

    getMensajeError(campo: string): string {
        const control = this.unidadForm.get(campo);
        if (control?.errors) {
            if (control.errors['required']) return `${campo} es requerido`;
            if (control.errors['minlength']) return `${campo} debe tener al menos ${control.errors['minlength'].requiredLength} caracteres`;
            if (control.errors['maxlength']) return `${campo} no puede tener más de ${control.errors['maxlength'].requiredLength} caracteres`;
        }
        return '';
    }
}
