import { Component, Output, EventEmitter, Input, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProductosService } from '../../../services/productos.service';
import { StorageService } from '../../../services/storage.service';
import { CategoriasService } from '../../../services/categorias.service';
import { UnidadesService } from '../../../services/unidades.service';
import { SucursalService } from '../../../services/sucursal.service';
import { KardexTableComponent } from '../kardex/kardex-table.component';
import { Productos } from '../../../models/productos.model';
import { Categoria } from '../../../models/categorias.model';
import { Unidad } from '../../../models/unidades.model';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-modal-productos',
  imports: [ReactiveFormsModule, CommonModule, KardexTableComponent],
  templateUrl: './modal.productos.html',
  styleUrl: './modal.productos.css',
})
export class ModalProductosComponent implements OnInit, OnDestroy {
  @Input() productoEditar?: Productos; // Producto a editar (opcional)
  @Output() close = new EventEmitter<void>();
  @Output() productoCreado = new EventEmitter<void>();

  productoForm: FormGroup;
  isLoading = false;
  modoEdicion = false;
  activeTab: 'details' | 'kardex' = 'details';
  categorias: Categoria[] = [];
  categoriasSubscription?: Subscription;

  // Variables para manejo de imágenes
  imagenSeleccionada: File | null = null;
  imagenPreview: string | null = null;
  isDragOver = false;

  unidades: Unidad[] = [];
  unidadesSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private productosService: ProductosService,
    private storageService: StorageService,
    private categoriasService: CategoriasService,
    private unidadesService: UnidadesService,
    public sucursalService: SucursalService,
    private cdr: ChangeDetectorRef
  ) {
    this.productoForm = this.fb.group({
      nombre: ['', Validators.required],
      precio_compra: [0, [Validators.required, Validators.min(0)]],
      precio_venta: [0, [Validators.required, Validators.min(0)]],
      categoria: ['', Validators.required],
      stock: [0, [Validators.required, Validators.min(0)]],
      sku: [''],
      codigo_barras: [''],
      stock_minimo: [5, [Validators.required, Validators.min(1)]],
      unidad: ['Unidad', Validators.required]
    });
  }

  ngOnInit() {
    // Cargar categorías
    this.categoriasSubscription = this.categoriasService.categorias$.subscribe(cats => {
      this.categorias = cats;
    });
    this.categoriasService.cargarCategorias();

    // Cargar unidades de medida dinámicamente
    this.unidadesSubscription = this.unidadesService.unidades$.subscribe(units => {
      // Filtrar solo las activas para el form de creación/edición
      this.unidades = units.filter(u => u.activo);
      this.cdr.detectChanges();
    });
    this.unidadesService.cargarUnidades();

    // Si hay un producto para editar, cargar sus datos
    if (this.productoEditar) {
      this.modoEdicion = true;
      this.cargarDatosProducto();
    }
  }

  ngOnDestroy() {
    if (this.categoriasSubscription) {
      this.categoriasSubscription.unsubscribe();
    }
    if (this.unidadesSubscription) {
      this.unidadesSubscription.unsubscribe();
    }
  }

  cargarDatosProducto() {
    if (this.productoEditar) {
      this.productoForm.patchValue({
        nombre: this.productoEditar.nombre,
        precio_compra: this.productoEditar.precio_compra,
        precio_venta: this.productoEditar.precio_venta,
        categoria: this.productoEditar.categoria,
        stock: this.productoEditar.stock,
        codigo_barras: this.productoEditar.codigo_barras || '',
        stock_minimo: this.productoEditar.stock_minimo || 5,
        unidad: this.productoEditar.unidad || 'Unidad'
      });
      this.cdr.detectChanges();
    }
  }

  cerrarModal() {
    this.close.emit();
  }

  async guardarProducto() {
    if (this.productoForm.valid && !this.isLoading) {
      this.isLoading = true;

      try {
        const formData = this.productoForm.value;
        let imagenData: { url?: string; nombre?: string } = {};

        // Subir imagen si hay una seleccionada
        if (this.imagenSeleccionada) {
          try {
            if (this.modoEdicion && this.productoEditar?.id) {
              // Actualizar imagen existente
              imagenData = await this.storageService.actualizarImagenProducto(
                this.imagenSeleccionada,
                this.productoEditar.id,
                this.productoEditar.imagen_nombre
              );
            } else {
              // Subir nueva imagen
              imagenData = await this.storageService.subirImagenProducto(this.imagenSeleccionada);
            }
          } catch (error) {
            console.error('Error al subir imagen:', error);
            await Swal.fire({
              title: '⚠️ Advertencia',
              text: 'Error al subir la imagen, pero el producto se guardará sin imagen.',
              icon: 'warning',
              confirmButtonText: 'Continuar'
            });
          }
        }

        const productoData = {
          nombre: formData.nombre,
          categoria: formData.categoria,
          precio_compra: formData.precio_compra,
          precio_venta: formData.precio_venta,
          stock: formData.stock,
          sku: formData.sku || undefined,
          codigo_barras: formData.codigo_barras || undefined,
          stock_minimo: formData.stock_minimo,
          unidad: formData.unidad,
          ...(imagenData.url && { imagen_url: imagenData.url }),
          ...(imagenData.nombre && { imagen_nombre: imagenData.nombre })
        };

        if (this.modoEdicion && this.productoEditar?.id) {
          // Actualizar producto existente
          await this.productosService.actualizarProducto(this.productoEditar.id, productoData);

          await Swal.fire({
            title: '✅ Producto Actualizado',
            text: 'El producto se ha actualizado exitosamente',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        } else {
          // Crear nuevo producto
          await this.productosService.crearProducto(productoData);

          await Swal.fire({
            title: '✅ Producto Creado',
            text: 'El producto se ha creado exitosamente',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        }

        // Resetear el formulario
        this.productoForm.reset();
        this.limpiarImagen();

        // Emitir evento de producto creado/actualizado
        this.productoCreado.emit();

        // Cerrar el modal
        this.cerrarModal();

      } catch (error: any) {
        console.error('❌ Error al guardar producto:', error);

        let mensaje = 'Error al guardar el producto. Por favor, intenta nuevamente.';

        // Manejo de errores específicos
        if (error.code === '23505') {
          if (error.message?.includes('codigo_barras')) {
            mensaje = 'Ya existe un producto con este Código de Barras.';
          } else if (error.message?.includes('sku')) {
            mensaje = 'Ya existe un producto con este SKU.';
          } else {
            mensaje = 'Ya existe un producto con estos datos únicos.';
          }
        }

        await Swal.fire({
          title: '❌ Error',
          text: mensaje,
          icon: 'error',
          confirmButtonText: 'Entendido'
        });
      } finally {
        this.isLoading = false;
      }
    } else {
      console.log('❌ Formulario inválido');
      this.marcarCamposComoTocados();
    }
  }

  // ==================== MÉTODOS PARA MANEJO DE IMÁGENES ====================

  onImagenSeleccionada(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.procesarImagen(input.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files[0]) {
      this.procesarImagen(files[0]);
    }
  }

  private procesarImagen(file: File) {
    // Validar imagen
    const validacion = this.storageService.validarImagen(file);
    if (!validacion.valido) {
      Swal.fire({
        title: '⚠️ Imagen Inválida',
        text: validacion.error,
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Guardar archivo y crear preview
    this.imagenSeleccionada = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagenPreview = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  eliminarImagen() {
    this.imagenSeleccionada = null;
    this.imagenPreview = null;

    // Si estamos editando y había una imagen, marcar para eliminar
    if (this.modoEdicion && this.productoEditar?.imagen_url) {
      this.productoEditar.imagen_url = undefined;
      this.productoEditar.imagen_nombre = undefined;
    }
  }

  private limpiarImagen() {
    this.imagenSeleccionada = null;
    this.imagenPreview = null;
    this.isDragOver = false;
  }

  // Getter para acceder al producto en el template
  get producto() {
    return this.productoEditar;
  }

  private marcarCamposComoTocados() {
    Object.keys(this.productoForm.controls).forEach(key => {
      this.productoForm.get(key)?.markAsTouched();
    });
  }

  // Getter para facilitar el acceso a los controles del formulario
  get f() {
    return this.productoForm.controls;
  }

  setTab(tab: 'details' | 'kardex') {
    this.activeTab = tab;
  }
}
