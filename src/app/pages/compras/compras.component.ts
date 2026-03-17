import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Compra } from '../../models/compras.model';
import { ComprasService } from '../../services/compras.service';
import { FiscalService } from '../../services/fiscal.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-compras',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './compras.component.html',
  styleUrl: './compras.component.css'
})
export class ComprasComponent implements OnInit, OnDestroy {
  compras: Compra[] = [];
  comprasFiltradas: Compra[] = [];
  mostrarAnuladas = true;
  isLoading = true;
  modoFiscalActivo = false;
  busqueda = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private comprasService: ComprasService,
    private fiscalService: FiscalService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    console.log('🔄 ComprasComponent: ngOnInit reactivo');

    // 1. Suscribirse al estado fiscal
    const fiscalSub = this.fiscalService.config$.subscribe(cfg => {
      this.modoFiscalActivo = cfg?.modo_fiscal ?? false;
      this.cdr.detectChanges();
    });
    this.subscriptions.push(fiscalSub);

    // 2. Suscribirse a cambios en los datos (Reactivo)
    const dataSub = this.comprasService.compras$.subscribe(
      compras => {
        console.log('📦 Recibiendo datos de compras en suscripción', compras.length);
        this.compras = compras;
        this.aplicarFiltros();
        // Si ya tenemos datos, quitamos el loading para verlos de inmediato
        if (compras.length > 0) {
          this.isLoading = false;
        }
        this.cdr.detectChanges();
      }
    );
    this.subscriptions.push(dataSub);

    // 3. Refrescar datos en segundo plano
    this.cargarCompras();

    // 4. Recargar al navegar de vuelta a esta vista
    const navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        if (event.url.includes('/compras') && !event.url.includes('/nueva') && !event.url.match(/\/\d+/)) {
          console.log('🔄 Navegación detectada, refrescando compras...');
          this.cargarCompras();
        }
      });
    this.subscriptions.push(navSub);
  }

  aplicarFiltros() {
    let filtradas = [...this.compras];

    if (!this.mostrarAnuladas) {
      filtradas = filtradas.filter(c => c.estado !== 'cancelada');
    }

    if (this.busqueda.trim()) {
      const q = this.busqueda.toLowerCase();
      filtradas = filtradas.filter(c =>
        (c.proveedor_nombre || '').toLowerCase().includes(q) ||
        (c.numero_factura || '').toLowerCase().includes(q) ||
        (c.ncf || '').toLowerCase().includes(q) ||
        String(c.id).includes(q)
      );
    }

    this.comprasFiltradas = filtradas;
    this.cdr.detectChanges();
  }

  async cargarCompras() {
    try {
      // Solo mostramos spinner si no hay nada en memoria
      if (this.compras.length === 0) {
        this.isLoading = true;
      }

      console.log('🔄 Solicitando carga de compras...');
      await this.comprasService.cargarCompras();
      console.log('✅ Carga de compras finalizada');
    } catch (error) {
      console.error('Error al cargar compras:', error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  toggleMostrarAnuladas() {
    this.mostrarAnuladas = !this.mostrarAnuladas;
    this.aplicarFiltros();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }



  async anularCompra(compra: Compra) {
    const { value: motivo } = await Swal.fire({
      title: '¿Anular Compra?',
      text: `Por favor ingresa el motivo de la anulación de la compra #${compra.numero_factura || compra.id}`,
      input: 'text',
      inputLabel: 'Motivo',
      inputPlaceholder: 'Ej: Error en facturación',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, Anular',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return 'Debes ingresar un motivo';
        }
        return null;
      }
    });

    if (motivo) {
      try {
        await this.comprasService.anularCompra(compra.id!, motivo);
        Swal.fire('¡Anulada!', 'La compra ha sido anulada.', 'success');
      } catch (error) {
        console.error('Error al anular compra:', error);
        Swal.fire('Error', 'No se pudo anular la compra.', 'error');
      }
    }
  }

  async eliminarCompra(compra: Compra) {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `Estás a punto de ELIMINAR permanentemente la compra #${compra.numero_factura || compra.id}. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await this.comprasService.eliminarCompra(compra.id!);
        Swal.fire('¡Eliminada!', 'La compra ha sido eliminada.', 'success');
      } catch (error) {
        console.error('Error al eliminar compra:', error);
        Swal.fire('Error', 'No se pudo eliminar la compra.', 'error');
      }
    }
  }

  get totalCompras(): number {
    return this.compras.length;
  }

  get totalMonto(): number {
    return this.compras.reduce((sum, compra) => sum + compra.total, 0);
  }

  get comprasPendientes(): number {
    return this.compras.filter(c => c.estado === 'pendiente').length;
  }

  get montoComprasPendientes(): number {
    return this.compras
      .filter(c => c.estado === 'pendiente')
      .reduce((sum, compra) => sum + compra.total, 0);
  }

  getEstadoBadgeClass(estado: string): string {
    const base = 'badge rounded-pill ';
    switch (estado.toLowerCase()) {
      case 'pagada': return base + 'bg-success-subtle text-success border border-success-subtle';
      case 'completada': return base + 'bg-success-subtle text-success border border-success-subtle';
      case 'pendiente': return base + 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      case 'parcial': return base + 'bg-info-subtle text-info-emphasis border border-info-subtle';
      case 'cancelada': return base + 'bg-danger-subtle text-danger border border-danger-subtle';
      default: return base + 'bg-light text-secondary border';
    }
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  exportarDatos() {
    if (this.compras.length === 0) {
      alert('No hay compras para exportar');
      return;
    }

    const datosExportar = this.compras.map(compra => ({
      ID: compra.id,
      'Número Factura': compra.numero_factura || '',
      Proveedor: compra.proveedor_nombre || '',
      'Fecha Compra': compra.fecha_compra,
      Subtotal: compra.subtotal,
      Impuesto: compra.impuesto,
      Descuento: compra.descuento,
      Total: compra.total,
      Estado: compra.estado,
      'Método Pago': compra.metodo_pago || ''
    }));

    const headers = Object.keys(datosExportar[0]).join(',');
    const csvContent = datosExportar.map(row =>
      Object.values(row).map(val => `"${val}"`).join(',')
    ).join('\n');

    const csv = headers + '\n' + csvContent;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `compras_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
