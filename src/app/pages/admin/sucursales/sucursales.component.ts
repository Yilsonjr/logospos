import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SucursalService } from '../../../services/sucursal.service';
import { Sucursal } from '../../../models/sucursal.model';
import Swal from 'sweetalert2';

declare var bootstrap: any;

@Component({
  selector: 'app-sucursales',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './sucursales.component.html',
  styleUrl: './sucursales.component.css'
})
export class SucursalesComponent implements OnInit {
  sucursales: Sucursal[] = [];
  cargando = true;
  
  sucursalForm: FormGroup;
  editando = false;
  sucursalSeleccionadaId: number | null = null;
  modal: any;

  constructor(
    private sucursalService: SucursalService,
    private fb: FormBuilder
  ) {
    this.sucursalForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      direccion: [''],
      telefono: [''],
      activa: [true]
    });
  }

  ngOnInit(): void {
    this.cargarSucursales();
  }

  async cargarSucursales() {
    this.cargando = true;
    try {
      this.sucursales = await this.sucursalService.obtenerTodasSucursales();
    } catch (error) {
      console.error('Error cargando sucursales', error);
      Swal.fire('Error', 'No se pudieron cargar las sucursales', 'error');
    } finally {
      this.cargando = false;
    }
  }

  abrirModalNuevo() {
    this.editando = false;
    this.sucursalSeleccionadaId = null;
    this.sucursalForm.reset({ activa: true });
    
    if (!this.modal) {
      this.modal = new bootstrap.Modal(document.getElementById('sucursalModal'));
    }
    this.modal.show();
  }

  abrirModalEditar(sucursal: Sucursal) {
    this.editando = true;
    if (sucursal.id) {
       this.sucursalSeleccionadaId = sucursal.id;
    }
    this.sucursalForm.patchValue({
      nombre: sucursal.nombre,
      direccion: sucursal.direccion,
      telefono: sucursal.telefono,
      activa: sucursal.activa
    });
    
    if (!this.modal) {
      this.modal = new bootstrap.Modal(document.getElementById('sucursalModal'));
    }
    this.modal.show();
  }

  cerrarModal() {
    if (this.modal) {
      this.modal.hide();
    }
  }

  async guardarSucursal() {
    if (this.sucursalForm.invalid) {
      this.sucursalForm.markAllAsTouched();
      return;
    }

    try {
      const formValue = this.sucursalForm.value;
      
      if (this.editando && this.sucursalSeleccionadaId) {
        await this.sucursalService.actualizarSucursal(this.sucursalSeleccionadaId, formValue);
        Swal.fire({
          title: 'Actualizada',
          text: 'La sucursal ha sido actualizada.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        await this.sucursalService.crearSucursal(formValue);
        Swal.fire({
          title: 'Creada',
          text: 'La sucursal ha sido creada exitosamente.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }

      this.cerrarModal();
      this.cargarSucursales();
    } catch (error) {
      Swal.fire('Error', 'Hubo un error al guardar la sucursal', 'error');
    }
  }

  async toggleActiva(sucursal: Sucursal) {
    if (!sucursal.id) return;
    
    try {
      const nuevoEstado = !sucursal.activa;
      await this.sucursalService.actualizarSucursal(sucursal.id, { activa: nuevoEstado });
      sucursal.activa = nuevoEstado;
    } catch (error) {
      Swal.fire('Error', 'No se pudo cambiar el estado de la sucursal', 'error');
    }
  }
}
