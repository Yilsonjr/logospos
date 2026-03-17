import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CuentasPagarService } from '../../../services/cuentas-pagar.service';
import { ProveedoresService } from '../../../services/proveedores.service';
import { AuthService } from '../../../services/auth.service';
import {
  CrearCuentaPorPagar,
  CuentaPorPagar,
  CATEGORIAS_CUENTA_PAGAR,
  PRIORIDADES_PAGO
} from '../../../models/cuentas-pagar.model';
import { Proveedor } from '../../../models/proveedores.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-nueva-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nueva-cuenta.component.html',
  styleUrls: ['./nueva-cuenta.component.css']
})
export class NuevaCuentaComponent implements OnInit {
  formulario: CrearCuentaPorPagar = {
    proveedor_id: 0,
    concepto: '',
    monto_total: 0,
    fecha_factura: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    prioridad: 'media',
    categoria: 'Mercancía',
    numero_factura: '',
    notas: ''
  };

  proveedores: Proveedor[] = [];
  categorias = CATEGORIAS_CUENTA_PAGAR;
  prioridades = PRIORIDADES_PAGO;

  // Estados
  isLoading = false;
  isEditing = false;
  cuentaId: number | null = null;

  constructor(
    private cuentasPagarService: CuentasPagarService,
    private proveedoresService: ProveedoresService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  async ngOnInit() {
    // Verificación de permisos eliminada para confiar en el Guard de la ruta
    // y la lógica de 'admin' en AuthService.


    // Verificar si es edición
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditing = true;
      this.cuentaId = parseInt(id);
    }

    // Cargar datos
    await this.cargarProveedores();

    if (this.isEditing && this.cuentaId) {
      await this.cargarCuenta();
    } else {
      this.calcularFechaVencimiento();
    }
  }

  async cargarProveedores() {
    try {
      await this.proveedoresService.cargarProveedores();
      this.proveedoresService.proveedores$.subscribe(proveedores => {
        this.proveedores = proveedores.filter(p => p.activo);
      });
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
    }
  }

  async cargarCuenta() {
    if (!this.cuentaId) return;

    this.isLoading = true;
    try {
      const cuenta = await this.cuentasPagarService.obtenerCuentaConPagos(this.cuentaId);
      if (cuenta) {
        this.formulario = {
          proveedor_id: cuenta.proveedor_id,
          concepto: cuenta.concepto,
          monto_total: cuenta.monto_total,
          fecha_factura: cuenta.fecha_factura,
          fecha_vencimiento: cuenta.fecha_vencimiento,
          prioridad: cuenta.prioridad,
          categoria: cuenta.categoria,
          numero_factura: cuenta.numero_factura || '',
          notas: cuenta.notas || ''
        };
      }
    } catch (error) {
      console.error('Error al cargar cuenta:', error);
      Swal.fire({
        title: '❌ Error',
        text: 'Error al cargar los datos de la cuenta',
        icon: 'error'
      });
      this.router.navigate(['/cuentas-pagar']);
    } finally {
      this.isLoading = false;
    }
  }

  calcularFechaVencimiento() {
    if (this.formulario.fecha_factura) {
      const fechaFactura = new Date(this.formulario.fecha_factura);
      fechaFactura.setDate(fechaFactura.getDate() + 30); // 30 días por defecto
      this.formulario.fecha_vencimiento = fechaFactura.toISOString().split('T')[0];
    }
  }

  async guardar() {
    if (!this.validarFormulario()) return;

    this.isLoading = true;
    try {
      if (this.isEditing && this.cuentaId) {
        await this.cuentasPagarService.actualizarCuenta(this.cuentaId, this.formulario);

        Swal.fire({
          title: '✅ Cuenta Actualizada',
          text: 'La cuenta por pagar ha sido actualizada exitosamente',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        await this.cuentasPagarService.crearCuenta(this.formulario);

        Swal.fire({
          title: '✅ Cuenta Creada',
          text: 'La cuenta por pagar ha sido creada exitosamente',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      }

      this.router.navigate(['/cuentas-pagar']);

    } catch (error: any) {
      console.error('Error al guardar cuenta:', error);
      Swal.fire({
        title: '❌ Error',
        text: error.message || 'Error al guardar la cuenta',
        icon: 'error'
      });
    } finally {
      this.isLoading = false;
    }
  }

  validarFormulario(): boolean {
    if (!this.formulario.proveedor_id) {
      Swal.fire('⚠️ Campo Requerido', 'Debes seleccionar un proveedor', 'warning');
      return false;
    }
    if (!this.formulario.concepto.trim()) {
      Swal.fire('⚠️ Campo Requerido', 'El concepto es obligatorio', 'warning');
      return false;
    }
    if (this.formulario.monto_total <= 0) {
      Swal.fire('⚠️ Monto Inválido', 'El monto debe ser mayor a cero', 'warning');
      return false;
    }
    if (!this.formulario.fecha_factura) {
      Swal.fire('⚠️ Campo Requerido', 'La fecha de factura es obligatoria', 'warning');
      return false;
    }
    if (!this.formulario.fecha_vencimiento) {
      Swal.fire('⚠️ Campo Requerido', 'La fecha de vencimiento es obligatoria', 'warning');
      return false;
    }

    // Validar que la fecha de vencimiento sea posterior a la fecha de factura
    const fechaFactura = new Date(this.formulario.fecha_factura);
    const fechaVencimiento = new Date(this.formulario.fecha_vencimiento);

    if (fechaVencimiento <= fechaFactura) {
      Swal.fire('⚠️ Fechas Inválidas', 'La fecha de vencimiento debe ser posterior a la fecha de factura', 'warning');
      return false;
    }

    return true;
  }

  cancelar() {
    this.router.navigate(['/cuentas-pagar']);
  }

  // Utilidades
  obtenerNombreProveedor(proveedorId: number): string {
    const proveedor = this.proveedores.find(p => p.id === proveedorId);
    return proveedor?.nombre || 'Proveedor no encontrado';
  }

  obtenerClasePrioridad(prioridad: string): string {
    const base = 'badge rounded-pill ';
    switch (prioridad) {
      case 'baja': return base + 'bg-secondary';
      case 'media': return base + 'bg-info text-dark';
      case 'alta': return base + 'bg-warning text-dark';
      case 'urgente': return base + 'bg-danger';
      default: return base + 'bg-secondary';
    }
  }

  // Métodos helper para el template
  obtenerEtiquetaPrioridad(prioridad: string): string {
    const prioridadObj = this.prioridades.find(p => p.valor === prioridad);
    return prioridadObj?.etiqueta || prioridad;
  }

  formatearFechaVencimiento(fecha: string): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Sugerencias automáticas
  sugerirFechaVencimiento() {
    if (this.formulario.fecha_factura) {
      const fechaFactura = new Date(this.formulario.fecha_factura);

      // Sugerir diferentes plazos según la categoría
      let diasVencimiento = 30; // Por defecto

      switch (this.formulario.categoria) {
        case 'Servicios Públicos':
          diasVencimiento = 15;
          break;
        case 'Alquiler':
          diasVencimiento = 5;
          break;
        case 'Mercancía':
          diasVencimiento = 30;
          break;
        case 'Servicios':
          diasVencimiento = 15;
          break;
        default:
          diasVencimiento = 30;
      }

      fechaFactura.setDate(fechaFactura.getDate() + diasVencimiento);
      this.formulario.fecha_vencimiento = fechaFactura.toISOString().split('T')[0];
    }
  }

  sugerirPrioridad() {
    // Sugerir prioridad según la categoría
    switch (this.formulario.categoria) {
      case 'Servicios Públicos':
      case 'Alquiler':
        this.formulario.prioridad = 'alta';
        break;
      case 'Seguros':
        this.formulario.prioridad = 'media';
        break;
      case 'Marketing':
      case 'Otros':
        this.formulario.prioridad = 'baja';
        break;
      default:
        this.formulario.prioridad = 'media';
    }
  }
}