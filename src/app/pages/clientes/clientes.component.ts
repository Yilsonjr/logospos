import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { ModalClientesComponent } from './modal.clientes/modal.clientes';
import { ClientesService } from '../../services/clientes.service';
import { Cliente } from '../../models/clientes.model';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-clientes',
  imports: [CommonModule, ModalClientesComponent],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.css'
})
export class ClientesComponent implements OnInit, OnDestroy {
  todosClientes: Cliente[] = [];
  clientesFiltrados: Cliente[] = [];
  isModalClienteOpen = false;
  clienteEditando?: Cliente;
  filtroActivo: 'todos' | 'activos' | 'inactivos' = 'activos';
  filtroTipo: 'todos' | 'regular' | 'mayorista' | 'vip' = 'todos';
  busqueda: string = '';
  private clientesSubscription?: Subscription;
  private subscriptions: Subscription[] = [];

  constructor(
    private clientesService: ClientesService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  async ngOnInit() {
    console.log('🔄 Clientes: Iniciando carga...');
    await this.cargarTodosClientes();

    // Recargar cuando se navega a clientes
    const navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(async (event: any) => {
        if (event.url.includes('/clientes')) {
          console.log('🔄 Recargando clientes por navegación...');
          await this.cargarTodosClientes();
        }
      });

    this.subscriptions.push(navSub);
    console.log('✅ Clientes: Carga completada');
  }

  ngOnDestroy() {
    if (this.clientesSubscription) {
      this.clientesSubscription.unsubscribe();
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarTodosClientes() {
    try {
      this.todosClientes = await this.clientesService.cargarTodosClientes();
      console.log('📊 Clientes cargados en componente:', this.todosClientes.length);
      this.aplicarFiltros();
      console.log('📊 Clientes filtrados:', this.clientesFiltrados.length);
      this.cdr.detectChanges(); // Forzar detección de cambios
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    }
  }

  aplicarFiltros() {
    let resultado = [...this.todosClientes];

    // Filtro por estado
    if (this.filtroActivo === 'activos') {
      resultado = resultado.filter(c => c.activo);
    } else if (this.filtroActivo === 'inactivos') {
      resultado = resultado.filter(c => !c.activo);
    }

    // Filtro por tipo
    if (this.filtroTipo !== 'todos') {
      resultado = resultado.filter(c => c.tipo_cliente === this.filtroTipo);
    }

    // Filtro por búsqueda
    if (this.busqueda.trim()) {
      const busquedaLower = this.busqueda.toLowerCase();
      resultado = resultado.filter(c =>
        c.nombre.toLowerCase().includes(busquedaLower) ||
        c.cedula?.toLowerCase().includes(busquedaLower) ||
        c.rnc?.toLowerCase().includes(busquedaLower) ||
        c.telefono?.toLowerCase().includes(busquedaLower) ||
        c.email?.toLowerCase().includes(busquedaLower)
      );
    }

    this.clientesFiltrados = resultado;
    this.cdr.detectChanges(); // Forzar detección después de filtrar
  }

  cambiarFiltroEstado(filtro: 'todos' | 'activos' | 'inactivos') {
    this.filtroActivo = filtro;
    this.aplicarFiltros();
  }

  cambiarFiltroTipo(filtro: 'todos' | 'regular' | 'mayorista' | 'vip') {
    this.filtroTipo = filtro;
    this.aplicarFiltros();
  }

  onBusquedaChange(event: Event) {
    this.busqueda = (event.target as HTMLInputElement).value;
    this.aplicarFiltros();
  }

  abrirModalCliente() {
    this.clienteEditando = undefined;
    this.isModalClienteOpen = true;
  }

  editarCliente(cliente: Cliente) {
    this.clienteEditando = cliente;
    this.isModalClienteOpen = true;
  }

  cerrarModalCliente() {
    this.isModalClienteOpen = false;
    this.clienteEditando = undefined;
  }

  async eliminarCliente(cliente: Cliente) {
    const confirmar = confirm(`¿Estás seguro de que deseas ${cliente.activo ? 'desactivar' : 'activar'} al cliente "${cliente.nombre}"?`);

    if (confirmar) {
      try {
        if (cliente.activo) {
          await this.clientesService.desactivarCliente(cliente.id!);
        } else {
          await this.clientesService.actualizarCliente(cliente.id!, { activo: true });
        }
        await this.cargarTodosClientes();
      } catch (error) {
        console.error('❌ Error al cambiar estado del cliente:', error);
        alert('Error al cambiar el estado del cliente. Intenta nuevamente.');
      }
    }
  }

  async onClienteGuardado(cliente: Cliente) {
    console.log('✅ Cliente guardado:', cliente.nombre);
    await this.cargarTodosClientes();
  }

  get totalActivos(): number {
    return this.todosClientes.filter(c => c.activo).length;
  }

  get totalInactivos(): number {
    return this.todosClientes.filter(c => !c.activo).length;
  }

  get totalRegulares(): number {
    return this.todosClientes.filter(c => c.tipo_cliente === 'regular' && c.activo).length;
  }

  get totalMayoristas(): number {
    return this.todosClientes.filter(c => c.tipo_cliente === 'mayorista' && c.activo).length;
  }

  get totalVIP(): number {
    return this.todosClientes.filter(c => c.tipo_cliente === 'vip' && c.activo).length;
  }

  getTipoBadgeClass(tipo: string): string {
    const base = 'badge rounded-pill ';
    switch (tipo.toLowerCase()) {
      case 'regular': return base + 'bg-secondary-subtle text-secondary border border-secondary-subtle';
      case 'mayorista': return base + 'bg-primary-subtle text-primary border border-primary-subtle';
      case 'vip': return base + 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      default: return base + 'bg-light text-dark border';
    }
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }

  getCreditoDisponible(cliente: Cliente): number {
    return cliente.limite_credito - cliente.balance_pendiente;
  }

  exportarDatos() {
    if (this.clientesFiltrados.length === 0) {
      alert('No hay clientes para exportar');
      return;
    }

    // Crear datos para exportar
    const datosExportar = this.clientesFiltrados.map(cliente => ({
      ID: cliente.id,
      Nombre: cliente.nombre,
      Cédula: cliente.cedula || '',
      RNC: cliente.rnc || '',
      Teléfono: cliente.telefono || '',
      Email: cliente.email || '',
      Dirección: cliente.direccion || '',
      Tipo: cliente.tipo_cliente,
      'Límite Crédito': cliente.limite_credito,
      'Balance Pendiente': cliente.balance_pendiente,
      'Crédito Disponible': this.getCreditoDisponible(cliente),
      Estado: cliente.activo ? 'Activo' : 'Inactivo'
    }));

    // Función para escapar valores CSV
    const escaparCSV = (valor: any): string => {
      if (valor === null || valor === undefined) return '';
      const valorStr = String(valor);
      if (valorStr.includes(',') || valorStr.includes('"') || valorStr.includes('\n') || valorStr.includes(';')) {
        return `"${valorStr.replace(/"/g, '""')}"`;
      }
      return valorStr;
    };

    // Convertir a CSV con delimitador de punto y coma
    const headers = Object.keys(datosExportar[0]).map(escaparCSV).join(';');
    const csvContent = datosExportar.map(row =>
      Object.values(row).map(escaparCSV).join(';')
    ).join('\n');

    // Agregar BOM para que Excel reconozca UTF-8
    const BOM = '\uFEFF';
    const csv = BOM + headers + '\n' + csvContent;

    // Crear y descargar archivo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
