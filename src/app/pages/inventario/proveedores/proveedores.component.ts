import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Proveedor } from '../../../models/proveedores.model';
import { ProveedoresService } from '../../../services/proveedores.service';
import { ModalProveedoresComponent } from '../modal.proveedores/modal.proveedores';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-proveedores',
  imports: [CommonModule, ModalProveedoresComponent],
  templateUrl: './proveedores.component.html',
  styleUrl: './proveedores.component.css'
})
export class ProveedoresComponent implements OnInit, OnDestroy {
  todosProveedores: Proveedor[] = [];
  proveedoresFiltrados: Proveedor[] = [];
  isModalOpen = false;
  proveedorEditar?: Proveedor;
  isLoading = true;
  filtroActivo: 'todos' | 'activos' | 'inactivos' = 'activos';
  busqueda: string = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private proveedoresService: ProveedoresService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  ngOnInit() {
    console.log('🔄 Proveedores: Iniciando carga...');
    this.cargarProveedores();

    // Recargar cuando se navega a proveedores
    const navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(async (event: any) => {
        if (event.url.includes('/proveedores')) {
          console.log('🔄 Recargando proveedores por navegación...');
          await this.cargarProveedores();
        }
      });

    this.subscriptions.push(navSub);
    console.log('✅ Proveedores: Carga completada');
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarProveedores() {
    try {
      this.isLoading = true;
      // Cargar TODOS los proveedores (activos e inactivos)
      this.todosProveedores = await this.proveedoresService.cargarTodosProveedores();
      this.aplicarFiltros();
      this.isLoading = false;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      this.isLoading = false;
    }
  }

  aplicarFiltros() {
    let resultado = [...this.todosProveedores];

    // Filtro por estado
    if (this.filtroActivo === 'activos') {
      resultado = resultado.filter(p => p.activo);
    } else if (this.filtroActivo === 'inactivos') {
      resultado = resultado.filter(p => !p.activo);
    }

    // Filtro por búsqueda
    if (this.busqueda.trim()) {
      const busquedaLower = this.busqueda.toLowerCase();
      resultado = resultado.filter(p =>
        p.nombre.toLowerCase().includes(busquedaLower) ||
        p.documento?.toLowerCase().includes(busquedaLower) ||
        p.telefono?.toLowerCase().includes(busquedaLower) ||
        p.email?.toLowerCase().includes(busquedaLower) ||
        p.contacto?.toLowerCase().includes(busquedaLower) ||
        p.ciudad?.toLowerCase().includes(busquedaLower) ||
        p.pais?.toLowerCase().includes(busquedaLower)
      );
    }

    this.proveedoresFiltrados = resultado;
    this.cdr.detectChanges();
  }

  cambiarFiltroEstado(filtro: 'todos' | 'activos' | 'inactivos') {
    this.filtroActivo = filtro;
    this.aplicarFiltros();
  }

  onBusquedaChange(event: Event) {
    this.busqueda = (event.target as HTMLInputElement).value;
    this.aplicarFiltros();
  }

  abrirModal() {
    this.proveedorEditar = undefined;
    this.isModalOpen = true;
  }

  abrirModalEditar(proveedor: Proveedor) {
    this.proveedorEditar = proveedor;
    this.isModalOpen = true;
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.proveedorEditar = undefined;
  }

  onProveedorGuardado() {
    console.log('✅ Proveedor guardado, recargando lista...');
    this.cerrarModal();
    this.cargarProveedores(); // Recargar todos los proveedores
  }

  async eliminarProveedor(proveedor: Proveedor) {
    const result = await Swal.fire({
      title: `¿${proveedor.activo ? 'Desactivar' : 'Activar'} proveedor?`,
      text: `${proveedor.activo ? 'El proveedor no aparecerá en las listas activas' : 'El proveedor volverá a estar disponible'}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: proveedor.activo ? '#d33' : '#3085d6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: proveedor.activo ? 'Sí, desactivar' : 'Sí, activar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        if (proveedor.activo) {
          await this.proveedoresService.desactivarProveedor(proveedor.id!);
          Swal.fire('¡Desactivado!', 'El proveedor ha sido desactivado.', 'success');
        } else {
          await this.proveedoresService.actualizarProveedor(proveedor.id!, { activo: true });
          Swal.fire('¡Activado!', 'El proveedor ha sido activado.', 'success');
        }
        // Recargar todos los proveedores después del cambio
        await this.cargarProveedores();
      } catch (error) {
        console.error('Error al cambiar estado del proveedor:', error);
        Swal.fire('Error', 'No se pudo cambiar el estado del proveedor', 'error');
      }
    }
  }

  get totalActivos(): number {
    return this.todosProveedores.filter(p => p.activo).length;
  }

  get totalInactivos(): number {
    return this.todosProveedores.filter(p => !p.activo).length;
  }

  get totalProveedores(): number {
    return this.todosProveedores.length;
  }

  exportarDatos() {
    if (this.proveedoresFiltrados.length === 0) {
      alert('No hay proveedores para exportar');
      return;
    }

    // Definir encabezados explícitamente para mantener el orden
    const headersData = ['ID', 'Nombre', 'Tipo', 'Documento', 'Teléfono', 'Email', 'Dirección', 'Contacto Principal', 'Ciudad', 'País', 'Estado'];

    // Función para escapar valores CSV
    const escaparCSV = (valor: any): string => {
      if (valor === null || valor === undefined) return '';
      const valorStr = String(valor);
      if (valorStr.includes(',') || valorStr.includes('"') || valorStr.includes('\n') || valorStr.includes(';')) {
        return `"${valorStr.replace(/"/g, '""')}"`;
      }
      return valorStr;
    };

    // Construir contenido CSV
    const headers = headersData.join(';');

    const csvContent = this.proveedoresFiltrados.map(proveedor => {
      const row = [
        proveedor.id,
        proveedor.nombre,
        proveedor.tipo_documento || 'RNC',
        proveedor.documento || '',
        proveedor.telefono || '',
        proveedor.email || '',
        proveedor.direccion || '',
        proveedor.contacto || '',
        proveedor.ciudad || '',
        proveedor.pais || '',
        proveedor.activo ? 'Activo' : 'Inactivo'
      ];
      return row.map(escaparCSV).join(';');
    }).join('\n');

    // Agregar BOM para que Excel reconozca UTF-8
    const BOM = '\uFEFF';
    const csv = BOM + headers + '\n' + csvContent;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `proveedores_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
