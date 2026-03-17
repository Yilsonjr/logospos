import { Component, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalCategoriasComponent } from '../modal.categorias/modal.categorias';
import { CategoriasService } from '../../../services/categorias.service';
import { Categoria } from '../../../models/categorias.model';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-gestion-categorias',
  imports: [CommonModule, ModalCategoriasComponent],
  templateUrl: './modal.gestion-categorias.html',
  styleUrl: './modal.gestion-categorias.css'
})
export class ModalGestionCategoriasComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  
  todasCategorias: Categoria[] = [];
  categoriasFiltradas: Categoria[] = [];
  isModalCategoriaOpen = false;
  categoriaEditando?: Categoria;
  filtroActivo: 'todas' | 'activas' | 'inactivas' = 'todas';
  private categoriasSubscription?: Subscription;

  constructor(
    private categoriasService: CategoriasService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.cargarTodasCategorias();
    
    // Suscribirse a los cambios en categorías para recargar cuando se cree/edite/elimine
    this.categoriasSubscription = this.categoriasService.categorias$.subscribe(
      async () => {
        await this.cargarTodasCategorias();
      }
    );
  }

  ngOnDestroy() {
    if (this.categoriasSubscription) {
      this.categoriasSubscription.unsubscribe();
    }
  }

  async cargarTodasCategorias() {
    try {
      this.todasCategorias = await this.categoriasService.cargarTodasCategorias();
      this.aplicarFiltro();
      this.cdr.detectChanges(); // Forzar detección de cambios
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  }

  aplicarFiltro() {
    switch (this.filtroActivo) {
      case 'activas':
        this.categoriasFiltradas = this.todasCategorias.filter(c => c.activo);
        break;
      case 'inactivas':
        this.categoriasFiltradas = this.todasCategorias.filter(c => !c.activo);
        break;
      default:
        this.categoriasFiltradas = [...this.todasCategorias];
    }
    this.cdr.detectChanges(); // Forzar detección de cambios
  }

  cambiarFiltro(filtro: 'todas' | 'activas' | 'inactivas') {
    this.filtroActivo = filtro;
    this.aplicarFiltro();
  }

  get totalActivas(): number {
    return this.todasCategorias.filter(c => c.activo).length;
  }

  get totalInactivas(): number {
    return this.todasCategorias.filter(c => !c.activo).length;
  }

  cerrarModal() {
    this.close.emit();
  }

  abrirModalCategoria() {
    this.categoriaEditando = undefined;
    this.isModalCategoriaOpen = true;
  }

  editarCategoria(categoria: Categoria) {
    this.categoriaEditando = categoria;
    this.isModalCategoriaOpen = true;
  }

  cerrarModalCategoria() {
    this.isModalCategoriaOpen = false;
    this.categoriaEditando = undefined;
  }

  async eliminarCategoria(categoria: Categoria) {
    try {
      // Verificar si hay productos usando esta categoría
      const cantidadProductos = await this.categoriasService.verificarProductosEnCategoria(categoria.id!);
      
      if (cantidadProductos > 0) {
        // HAY PRODUCTOS: Solo desactivar
        const result = await Swal.fire({
          title: '⚠️ Categoría en uso',
          html: `
            <p>La categoría <strong>"${categoria.nombre}"</strong> tiene <strong>${cantidadProductos} producto(s)</strong> asociado(s).</p>
            <p>No se puede eliminar permanentemente, pero se puede <strong>desactivar</strong>.</p>
            <p class="text-sm text-gray-600 mt-2">Los productos mantendrán su categoría, pero esta no aparecerá en nuevos registros.</p>
          `,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#f59e0b',
          cancelButtonColor: '#6b7280',
          confirmButtonText: 'Sí, desactivar',
          cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
          await this.categoriasService.eliminarCategoria(categoria.id!);
          await this.cargarTodasCategorias();
          
          Swal.fire({
            title: '✅ Desactivada',
            text: `La categoría "${categoria.nombre}" ha sido desactivada.`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        }
      } else {
        // NO HAY PRODUCTOS: Permitir eliminación física
        const result = await Swal.fire({
          title: '🗑️ ¿Eliminar categoría?',
          html: `
            <p>La categoría <strong>"${categoria.nombre}"</strong> no tiene productos asociados.</p>
            <p class="text-sm text-gray-600 mt-2">¿Deseas eliminarla permanentemente o solo desactivarla?</p>
          `,
          icon: 'question',
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonColor: '#ef4444',
          denyButtonColor: '#f59e0b',
          cancelButtonColor: '#6b7280',
          confirmButtonText: 'Eliminar permanentemente',
          denyButtonText: 'Solo desactivar',
          cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
          // Eliminar físicamente
          await this.categoriasService.eliminarCategoriaFisicamente(categoria.id!);
          await this.cargarTodasCategorias();
          
          Swal.fire({
            title: '✅ Eliminada',
            text: `La categoría "${categoria.nombre}" ha sido eliminada permanentemente.`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        } else if (result.isDenied) {
          // Solo desactivar
          await this.categoriasService.eliminarCategoria(categoria.id!);
          await this.cargarTodasCategorias();
          
          Swal.fire({
            title: '✅ Desactivada',
            text: `La categoría "${categoria.nombre}" ha sido desactivada.`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        }
      }
    } catch (error) {
      console.error('❌ Error al eliminar categoría:', error);
      Swal.fire({
        title: '❌ Error',
        text: 'Ocurrió un error al procesar la categoría. Intenta nuevamente.',
        icon: 'error',
        confirmButtonColor: '#3b82f6'
      });
    }
  }

  async onCategoriaGuardada(categoria: Categoria) {
    console.log('✅ Categoría guardada:', categoria.nombre);
    await this.cargarTodasCategorias();
  }
}
