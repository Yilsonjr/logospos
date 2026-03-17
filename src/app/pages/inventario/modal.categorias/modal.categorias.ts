import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CategoriasService } from '../../../services/categorias.service';
import { Categoria } from '../../../models/categorias.model';

// Decorador @Component: define metadatos del componente
@Component({
  selector: 'app-modal-categorias',     // Nombre del tag HTML
  imports: [ReactiveFormsModule, CommonModule], // Módulos que necesita
  templateUrl: './modal.categorias.html',       // Archivo HTML
  styleUrl: './modal.categorias.css'           // Archivo CSS
})
export class ModalCategoriasComponent implements OnInit {

  // @Output: Eventos que el componente puede emitir hacia el padre
  @Output() close = new EventEmitter<void>();
  @Output() categoriaGuardada = new EventEmitter<Categoria>();

  // @Input: Datos que recibe del componente padre
  @Input() categoriaEditar?: Categoria; // Opcional: para editar categoría existente

  // Propiedades del componente
  categoriaForm: FormGroup;  // Formulario reactivo
  isLoading = false;         // Estado de carga
  editando = false;          // Modo edición o creación

  // Array de colores predefinidos para seleccionar
  coloresPredefinidos = [
    { nombre: 'Azul', valor: '#3b82f6' },
    { nombre: 'Verde', valor: '#10b981' },
    { nombre: 'Rojo', valor: '#ef4444' },
    { nombre: 'Amarillo', valor: '#f59e0b' },
    { nombre: 'Púrpura', valor: '#8b5cf6' },
    { nombre: 'Rosa', valor: '#ec4899' },
    { nombre: 'Gris', valor: '#6b7280' },
    { nombre: 'Naranja', valor: '#f97316' }
  ];

  // Constructor: inyección de dependencias
  constructor(
    private fb: FormBuilder,              // Para crear formularios reactivos
    private categoriasService: CategoriasService  // Servicio de categorías
  ) {
    // Inicializar el formulario reactivo
    this.categoriaForm = this.fb.group({
      nombre: ['', [
        Validators.required,              // Campo requerido
        Validators.minLength(2),          // Mínimo 2 caracteres
        Validators.maxLength(50)          // Máximo 50 caracteres
      ]],
      descripcion: ['', [
        Validators.maxLength(200)         // Máximo 200 caracteres
      ]],
      color: ['#3b82f6', Validators.required], // Color por defecto: azul
      activo: [true]                      // Por defecto activa
    });
  }

  // ngOnInit: se ejecuta después de que Angular inicializa el componente
  ngOnInit() {
    // Si recibimos una categoría para editar, llenar el formulario
    if (this.categoriaEditar) {
      this.editando = true;
      this.llenarFormulario(this.categoriaEditar);
    }
  }

  // Método para llenar el formulario con datos existentes
  private llenarFormulario(categoria: Categoria) {
    this.categoriaForm.patchValue({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || '',
      color: categoria.color,
      activo: categoria.activo
    });
  }

  // Método para cerrar el modal
  cerrarModal() {
    this.close.emit(); // Emitir evento al componente padre
  }

  // Método para seleccionar un color predefinido
  seleccionarColor(color: string) {
    this.categoriaForm.patchValue({ color }); // Actualizar solo el campo color
  }

  // Método principal para guardar la categoría
  async guardarCategoria() {
    // Validar que el formulario sea válido
    if (this.categoriaForm.valid && !this.isLoading) {
      this.isLoading = true; // Activar estado de carga

      try {
        const formData = this.categoriaForm.value;
        let categoriaGuardada: Categoria;

        if (this.editando && this.categoriaEditar) {
          // Modo edición: actualizar categoría existente
          categoriaGuardada = await this.categoriasService.actualizarCategoria(
            this.categoriaEditar.id!,
            formData
          );
          console.log('✅ Categoría actualizada:', categoriaGuardada.nombre);
        } else {
          // Modo creación: crear nueva categoría
          categoriaGuardada = await this.categoriasService.crearCategoria(formData);
          console.log('✅ Categoría creada:', categoriaGuardada.nombre);
        }

        // Resetear el formulario con valores por defecto
        this.categoriaForm.reset({
          color: '#3b82f6',
          activo: true
        });

        // Emitir evento con la categoría guardada
        this.categoriaGuardada.emit(categoriaGuardada);

        // Cerrar el modal
        this.cerrarModal();

      } catch (error: any) {
        console.error('❌ Error al guardar categoría:', error);

        // Mostrar mensaje de error más específico
        let mensajeError = `Error al ${this.editando ? 'actualizar' : 'crear'} la categoría.`;

        if (error.code === '23505') {
          mensajeError = `Ya existe una categoría con el nombre "${this.categoriaForm.get('nombre')?.value}"`;
        } else if (error.message) {
          mensajeError = error.message;
        }

        alert(mensajeError);

      } finally {
        this.isLoading = false; // Desactivar estado de carga
      }
    } else {
      // Si el formulario no es válido, marcar todos los campos como tocados
      this.marcarCamposComoTocados();
    }
  }

  // Método para marcar todos los campos como tocados (mostrar errores)
  private marcarCamposComoTocados() {
    Object.keys(this.categoriaForm.controls).forEach(key => {
      this.categoriaForm.get(key)?.markAsTouched();
    });
  }

  // Getter para facilitar el acceso a los controles del formulario en el template
  get f() {
    return this.categoriaForm.controls;
  }

  // Método para verificar si un campo tiene errores
  tieneError(campo: string): boolean {
    const control = this.categoriaForm.get(campo);
    return !!(control && control.invalid && control.touched);
  }

  // Método para obtener el mensaje de error de un campo
  getMensajeError(campo: string): string {
    const control = this.categoriaForm.get(campo);

    if (control?.errors) {
      if (control.errors['required']) {
        return `${campo} es requerido`;
      }
      if (control.errors['minlength']) {
        return `${campo} debe tener al menos ${control.errors['minlength'].requiredLength} caracteres`;
      }
      if (control.errors['maxlength']) {
        return `${campo} no puede tener más de ${control.errors['maxlength'].requiredLength} caracteres`;
      }
    }

    return '';
  }

  // TrackBy function para optimizar *ngFor
  trackByColor(index: number, color: any): string {
    return color.valor; // Usar el valor del color como identificador único
  }

  // Método para determinar el color del texto basado en el fondo
  getTextColor(backgroundColor: string): string {
    // Convertir hex a RGB y calcular luminancia
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Fórmula de luminancia
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Si es oscuro, texto blanco; si es claro, texto negro
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }
}