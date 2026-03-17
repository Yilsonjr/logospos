import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UsuariosService } from '../../../services/usuarios.service';
import { AuthService } from '../../../services/auth.service';
import { Rol, CrearRol, PERMISOS_SISTEMA } from '../../../models/usuario.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.css']
})
export class RolesComponent implements OnInit, OnDestroy {
  roles: Rol[] = [];
  rolesFiltrados: Rol[] = [];

  // Exponer Object para el template
  Object = Object;

  // Filtros
  filtroTexto = '';
  filtroEstado = 'todos';

  // Modal editar/crear
  mostrarModal = false;
  modoModal: 'crear' | 'editar' = 'crear';
  rolSeleccionado: Rol | null = null;

  // Modal detalles
  mostrarDetalle = false;
  rolDetalle: Rol | null = null;

  // Formulario
  formularioRol: CrearRol = {
    nombre: '',
    descripcion: '',
    permisos: [],
    color: '#3b82f6',
    activo: true
  };

  // Permisos
  permisosSistema = PERMISOS_SISTEMA;
  permisosAgrupados: { [categoria: string]: { [permiso: string]: string } } = {};

  // Estados
  isLoading = false;
  isSaving = false;
  subscriptions: Subscription[] = [];

  // Colores predefinidos
  coloresPredefinidos = [
    '#dc2626', // red-600
    '#ea580c', // orange-600
    '#d97706', // amber-600
    '#ca8a04', // yellow-600
    '#65a30d', // lime-600
    '#16a34a', // green-600
    '#059669', // emerald-600
    '#0d9488', // teal-600
    '#0891b2', // cyan-600
    '#0284c7', // sky-600
    '#2563eb', // blue-600
    '#4f46e5', // indigo-600
    '#7c3aed', // violet-600
    '#9333ea', // purple-600
    '#c026d3', // fuchsia-600
    '#db2777', // pink-600
    '#e11d48', // rose-600
    '#6b7280'  // gray-500
  ];

  constructor(
    private usuariosService: UsuariosService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    // Verificar permisos
    if (!this.authService.tienePermiso('roles.ver')) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Agrupar permisos por categoría
    this.agruparPermisos();

    // Suscribirse a los datos
    const rolesSub = this.usuariosService.roles$.subscribe(roles => {
      this.roles = roles;
      this.aplicarFiltros();
      this.cdr.detectChanges();
    });
    this.subscriptions.push(rolesSub);

    // Cargar datos
    await this.cargarDatos();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarDatos() {
    this.isLoading = true;
    this.cdr.detectChanges();
    try {
      await this.usuariosService.cargarRoles();
    } catch (error) {
      console.error('Error al cargar roles:', error);
      Swal.fire({
        title: '❌ Error',
        text: 'Error al cargar los roles',
        icon: 'error'
      });
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
      setTimeout(() => this.cdr.detectChanges(), 100);
    }
  }

  agruparPermisos() {
    this.permisosAgrupados = {};

    Object.entries(this.permisosSistema).forEach(([clave, descripcion]) => {
      const [categoria] = clave.split('.');

      if (!this.permisosAgrupados[categoria]) {
        this.permisosAgrupados[categoria] = {};
      }

      this.permisosAgrupados[categoria][clave] = descripcion;
    });
  }

  aplicarFiltros() {
    let filtrados = [...this.roles];

    // Filtro por texto
    if (this.filtroTexto.trim()) {
      const texto = this.filtroTexto.toLowerCase();
      filtrados = filtrados.filter(rol =>
        rol.nombre.toLowerCase().includes(texto) ||
        rol.descripcion.toLowerCase().includes(texto)
      );
    }

    // Filtro por estado
    if (this.filtroEstado !== 'todos') {
      const activo = this.filtroEstado === 'activos';
      filtrados = filtrados.filter(rol => rol.activo === activo);
    }

    this.rolesFiltrados = filtrados;
  }

  // ==================== MODAL ====================

  abrirModalCrear() {
    if (!this.authService.tienePermiso('roles.crear')) {
      Swal.fire({
        title: '🚫 Sin Permisos',
        text: 'No tienes permisos para crear roles',
        icon: 'error'
      });
      return;
    }

    this.modoModal = 'crear';
    this.isSaving = false; // Reset saving state
    this.rolSeleccionado = null;
    this.formularioRol = {
      nombre: '',
      descripcion: '',
      permisos: [],
      color: this.coloresPredefinidos[Math.floor(Math.random() * this.coloresPredefinidos.length)],
      activo: true
    };
    this.mostrarModal = true;
  }

  abrirModalEditar(rol: Rol) {
    if (!this.authService.tienePermiso('roles.editar')) {
      Swal.fire({
        title: '🚫 Sin Permisos',
        text: 'No tienes permisos para editar roles',
        icon: 'error'
      });
      return;
    }

    this.modoModal = 'editar';
    this.isSaving = false; // Reset saving state
    this.rolSeleccionado = rol;
    this.formularioRol = {
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      permisos: [...rol.permisos],
      color: rol.color,
      activo: rol.activo
    };
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.rolSeleccionado = null;
    this.isSaving = false;
  }

  async guardarRol() {
    if (!this.validarFormulario()) return;

    this.isSaving = true;
    try {
      if (this.modoModal === 'crear') {
        await this.usuariosService.crearRol(this.formularioRol);
        Swal.fire({
          title: '✅ Rol Creado',
          text: 'El rol ha sido creado exitosamente',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        await this.usuariosService.actualizarRol(
          this.rolSeleccionado!.id!,
          this.formularioRol
        );

        Swal.fire({
          title: '✅ Rol Actualizado',
          text: 'El rol ha sido actualizado exitosamente',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      }

      this.cerrarModal();
    } catch (error: any) {
      console.error('Error al guardar rol:', error);
      Swal.fire({
        title: '❌ Error',
        text: error.message || 'Error al guardar el rol',
        icon: 'error'
      });
    } finally {
      this.isSaving = false;
    }
  }

  validarFormulario(): boolean {
    if (!this.formularioRol.nombre.trim()) {
      Swal.fire('⚠️ Campo Requerido', 'El nombre del rol es obligatorio', 'warning');
      return false;
    }
    if (!this.formularioRol.descripcion.trim()) {
      Swal.fire('⚠️ Campo Requerido', 'La descripción del rol es obligatoria', 'warning');
      return false;
    }
    if (this.formularioRol.permisos.length === 0) {
      Swal.fire('⚠️ Permisos Requeridos', 'Debes seleccionar al menos un permiso', 'warning');
      return false;
    }

    return true;
  }

  // ==================== PERMISOS ====================

  togglePermiso(permiso: string) {
    const index = this.formularioRol.permisos.indexOf(permiso);
    if (index > -1) {
      this.formularioRol.permisos.splice(index, 1);
    } else {
      this.formularioRol.permisos.push(permiso);
    }
  }

  tienePermiso(permiso: string): boolean {
    return this.formularioRol.permisos.includes(permiso);
  }

  toggleCategoria(categoria: string) {
    const permisosCategoria = Object.keys(this.permisosAgrupados[categoria]);
    const tieneAlgunPermiso = permisosCategoria.some(p => this.tienePermiso(p));

    if (tieneAlgunPermiso) {
      // Quitar todos los permisos de la categoría
      permisosCategoria.forEach(permiso => {
        const index = this.formularioRol.permisos.indexOf(permiso);
        if (index > -1) {
          this.formularioRol.permisos.splice(index, 1);
        }
      });
    } else {
      // Agregar todos los permisos de la categoría
      permisosCategoria.forEach(permiso => {
        if (!this.tienePermiso(permiso)) {
          this.formularioRol.permisos.push(permiso);
        }
      });
    }
  }

  categoriaTienePermisos(categoria: string): boolean {
    const permisosCategoria = Object.keys(this.permisosAgrupados[categoria]);
    return permisosCategoria.some(p => this.tienePermiso(p));
  }

  categoriaEsCompleta(categoria: string): boolean {
    const permisosCategoria = Object.keys(this.permisosAgrupados[categoria]);
    return permisosCategoria.every(p => this.tienePermiso(p));
  }

  contarPermisosCategoria(categoria: string): number {
    const permisosCategoria = Object.keys(this.permisosAgrupados[categoria]);
    return permisosCategoria.filter(p => this.tienePermiso(p)).length;
  }

  // ==================== ACCIONES ====================

  async cambiarEstadoRol(rol: Rol) {
    const accion = rol.activo ? 'desactivar' : 'activar';
    const permiso = rol.activo ? 'roles.eliminar' : 'roles.editar';

    if (!this.authService.tienePermiso(permiso)) {
      Swal.fire({
        title: '🚫 Sin Permisos',
        text: `No tienes permisos para ${accion} roles`,
        icon: 'error'
      });
      return;
    }

    const result = await Swal.fire({
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} Rol?`,
      text: `¿Estás seguro de ${accion} el rol "${rol.nombre}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: accion.charAt(0).toUpperCase() + accion.slice(1),
      cancelButtonText: 'Cancelar',
      confirmButtonColor: rol.activo ? '#ef4444' : '#10b981'
    });

    if (result.isConfirmed) {
      try {
        if (rol.activo) {
          await this.usuariosService.desactivarRol(rol.id!);
        } else {
          await this.usuariosService.activarRol(rol.id!);
        }

        Swal.fire({
          title: `✅ Rol ${accion.charAt(0).toUpperCase() + accion.slice(1)}do`,
          text: `El rol ha sido ${accion}do exitosamente`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error: any) {
        console.error(`Error al ${accion} rol:`, error);
        Swal.fire({
          title: '❌ Error',
          text: error.message || `Error al ${accion} el rol`,
          icon: 'error'
        });
      }
    }
  }

  verDetallesRol(rol: Rol) {
    this.rolDetalle = rol;
    this.mostrarDetalle = true;
  }

  cerrarDetalle() {
    this.mostrarDetalle = false;
    this.rolDetalle = null;
  }

  // Obtener permisos del rol agrupados por categoría
  permisosDetalleAgrupados(rol: Rol): { categoria: string; permisos: string[] }[] {
    const grupos: { [key: string]: string[] } = {};
    rol.permisos.forEach(permiso => {
      const [cat] = permiso.split('.');
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(permiso);
    });
    return Object.entries(grupos).map(([categoria, permisos]) => ({ categoria, permisos }));
  }

  obtenerDescripcionPermiso(permiso: string): string {
    return this.permisosSistema[permiso as keyof typeof this.permisosSistema] || permiso;
  }

  // ==================== UTILIDADES ====================

  obtenerNombreCategoria(categoria: string): string {
    const nombres: { [key: string]: string } = {
      'dashboard': 'Dashboard',
      'inventario': 'Inventario',
      'proveedores': 'Proveedores',
      'clientes': 'Clientes',
      'ventas': 'Ventas',
      'caja': 'Caja',
      'cuentas': 'Cuentas por Cobrar',
      'usuarios': 'Usuarios',
      'roles': 'Roles',
      'reportes': 'Reportes',
      'config': 'Configuración'
    };
    return nombres[categoria] || categoria.charAt(0).toUpperCase() + categoria.slice(1);
  }

  contarUsuariosConRol(rolId: number): number {
    // Esta función se implementaría con datos reales de usuarios
    return 0; // Placeholder
  }
}