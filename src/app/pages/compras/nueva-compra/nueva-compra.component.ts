import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormsModule, FormControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ComprasService } from '../../../services/compras.service';
import { ProveedoresService } from '../../../services/proveedores.service';
import { ProductosService } from '../../../services/productos.service';
import { FiscalService } from '../../../services/fiscal.service';
import { Proveedor } from '../../../models/proveedores.model';
import { Productos } from '../../../models/productos.model';
import { CrearCompra, CrearDetalleCompra, METODOS_PAGO } from '../../../models/compras.model';
import { TIPOS_COMPROBANTE, ConfiguracionFiscal } from '../../../models/fiscal.model';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-nueva-compra',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './nueva-compra.component.html',
  styleUrl: './nueva-compra.component.css'
})
export class NuevaCompraComponent implements OnInit, OnDestroy {
  compraForm: FormGroup;
  proveedores: Proveedor[] = [];
  productos: Productos[] = [];
  productosFiltrados: Productos[] = [];

  // Buscador Global
  busquedaControl = new FormControl('');
  resultadosBusqueda: Productos[] = [];
  mostrarResultados = false;
  scanBuffer = '';
  scanTimeout: any;

  metodosPago = METODOS_PAGO;
  isLoading = false;
  isSaving = false;
  incluirImpuesto = true;
  tasaImpuesto = 18; // 18% ITBIS por defecto
  configFiscal: ConfiguracionFiscal | null = null;
  tiposComprobante = TIPOS_COMPROBANTE;
  private proveedoresSubscription?: Subscription;
  private productosSubscription?: Subscription;
  private fiscalSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private comprasService: ComprasService,
    private proveedoresService: ProveedoresService,
    private productosService: ProductosService,
    private fiscalService: FiscalService,
    private router: Router
  ) {
    this.compraForm = this.fb.group({
      proveedor_id: ['', Validators.required],
      numero_factura: [''],
      fecha_compra: [new Date().toISOString().split('T')[0], Validators.required],
      fecha_vencimiento: [''],
      metodo_pago: ['Efectivo'],
      notas: [''],
      ncf: [''],
      tipo_ncf: [''],
      descuento_monto: [0, [Validators.min(0)]],
      detalles: this.fb.array([])
    });
  }

  ngOnInit() {
    // Suscribirse a los observables
    this.proveedoresSubscription = this.proveedoresService.proveedores$.subscribe(proveedores => {
      this.proveedores = proveedores;
    });

    this.productosSubscription = this.productosService.productos$.subscribe(productos => {
      this.productos = productos;
      this.productosFiltrados = productos; // Inicializar filtrados
    });

    this.fiscalSubscription = this.fiscalService.config$.subscribe(config => {
      this.configFiscal = config;
      if (config?.modo_fiscal) {
        this.compraForm.patchValue({ tipo_ncf: 'B11' });
      }
    });

    // Cargar datos en segundo plano
    this.proveedoresService.cargarProveedores().catch(err => console.error(err));
    this.productosService.cargarProductos().catch(err => console.error(err));
  }

  ngOnDestroy() {
    if (this.proveedoresSubscription) {
      this.proveedoresSubscription.unsubscribe();
    }
    if (this.productosSubscription) {
      this.productosSubscription.unsubscribe();
    }
    if (this.fiscalSubscription) {
      this.fiscalSubscription.unsubscribe();
    }
  }

  get detalles(): FormArray {
    return this.compraForm.get('detalles') as FormArray;
  }

  crearDetalle(): FormGroup {
    return this.fb.group({
      producto_id: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      precio_unitario: [0, [Validators.required, Validators.min(0)]]
    });
  }

  agregarDetalle(producto?: Productos) {
    const detalleGroup = this.crearDetalle();

    if (producto) {
      detalleGroup.patchValue({
        producto_id: producto.id,
        precio_unitario: producto.precio_compra || 0,
        cantidad: 1
      });
    }

    this.detalles.insert(0, detalleGroup); // Agregar al principio para visibilidad
  }

  eliminarDetalle(index: number) {
    if (this.detalles.length > 1) {
      this.detalles.removeAt(index);
    }
  }

  onProductoChange(index: number) {
    const detalle = this.detalles.at(index);
    const productoId = detalle.get('producto_id')?.value;

    if (productoId) {
      const producto = this.productos.find(p => p.id === Number(productoId));
      if (producto) {
        detalle.patchValue({
          precio_unitario: producto.precio_compra || 0
        });
      }
    }
  }

  calcularSubtotalDetalle(index: number): number {
    const detalle = this.detalles.at(index);
    const cantidad = detalle.get('cantidad')?.value || 0;
    const precio = detalle.get('precio_unitario')?.value || 0;
    return cantidad * precio;
  }

  // --- Lógica del Buscador Global ---

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const termino = input.value.toLowerCase().trim();

    if (termino.length === 0) {
      this.resultadosBusqueda = [];
      this.mostrarResultados = false;
      return;
    }

    this.mostrarResultados = true;
    this.resultadosBusqueda = this.productos.filter(p =>
      p.nombre.toLowerCase().includes(termino) ||
      p.sku?.toLowerCase().includes(termino) ||
      p.codigo_barras?.toLowerCase().includes(termino)
    ).slice(0, 7); // Limitar a 7 resultados
  }

  onScanGlobal(event: KeyboardEvent) {
    // Detectar Enter de escáner
    if (event.key === 'Enter') {
      if (this.scanBuffer.length > 0) {
        this.procesarScan(this.scanBuffer);
        this.scanBuffer = '';
      }
      return;
    }

    // Acumular caracteres rápidas (scanner simulation logic simple)
    // O simplemente usar el input value si es un scan directo al input
    // Aquí asumimos que el usuario está escribiendo en el input global.
    // Si el evento viene del input (keyup.enter), ya lo manejamos.
  }

  buscarPorCodigoBarrasGlobal(event: Event) {
    const input = event.target as HTMLInputElement;
    const codigo = input.value.trim();
    if (!codigo) return;

    this.procesarScan(codigo);
    input.value = ''; // Limpiar input
    this.mostrarResultados = false;
  }

  procesarScan(codigo: string) {
    const producto = this.productos.find(p =>
      p.codigo_barras === codigo || p.sku === codigo
    );

    if (producto) {
      // Verificar si ya existe en la lista para sumar cantidad (opcional), 
      // por ahora agregamos nueva línea o buscamos existente.

      const indexExistente = this.detalles.controls.findIndex(c =>
        c.get('producto_id')?.value === producto.id
      );

      if (indexExistente >= 0) {
        // Incrementar cantidad
        const control = this.detalles.at(indexExistente).get('cantidad');
        control?.setValue(control.value + 1);
        // Mover al inicio visualmente? No, dejarlo ahí.
        // Resaltar fila?
      } else {
        this.agregarDetalle(producto);
      }

      // Feedback sonoro o visual
    } else {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'Producto no encontrado',
        text: codigo,
        showConfirmButton: false,
        timer: 2000
      });
    }
  }

  seleccionarProducto(producto: Productos) {
    const indexExistente = this.detalles.controls.findIndex(c =>
      c.get('producto_id')?.value === producto.id
    );

    if (indexExistente >= 0) {
      const control = this.detalles.at(indexExistente).get('cantidad');
      control?.setValue(control.value + 1);
    } else {
      this.agregarDetalle(producto);
    }

    this.busquedaControl.setValue('');
    this.resultadosBusqueda = [];
    this.mostrarResultados = false;
  }

  ocultarResultados() {
    // Delay para permitir click en item
    setTimeout(() => {
      this.mostrarResultados = false;
    }, 200);
  }

  getProductoNombre(id: number | string): string {
    if (!id) return 'Seleccione un producto';
    const p = this.productos.find(x => x.id == Number(id));
    return p ? (p.nombre + (p.sku ? ` (${p.sku})` : '')) : 'Desconocido';
  }

  get subtotal(): number {
    let total = 0;
    for (let i = 0; i < this.detalles.length; i++) {
      total += this.calcularSubtotalDetalle(i);
    }
    return total;
  }

  get impuesto(): number {
    if (!this.incluirImpuesto) return 0;
    return this.subtotal * (this.tasaImpuesto / 100);
  }

  get descuento(): number {
    return this.compraForm.get('descuento_monto')?.value || 0;
  }

  get total(): number {
    return this.subtotal + this.impuesto - this.descuento;
  }

  async guardarCompra() {
    if (this.compraForm.valid && this.detalles.length > 0 && !this.isSaving) {
      this.isSaving = true;

      try {
        const formValue = this.compraForm.value;

        const compra: CrearCompra = {
          proveedor_id: Number(formValue.proveedor_id),
          numero_factura: formValue.numero_factura || null,
          fecha_compra: formValue.fecha_compra,
          fecha_vencimiento: formValue.fecha_vencimiento || null,
          subtotal: this.subtotal,
          impuesto: this.impuesto,
          descuento: this.descuento,
          total: this.total,
          estado: formValue.metodo_pago === 'Crédito' ? 'pendiente' : 'pagada',
          metodo_pago: formValue.metodo_pago,
          ncf: this.configFiscal?.modo_fiscal ? formValue.ncf : null,
          tipo_ncf: this.configFiscal?.modo_fiscal ? formValue.tipo_ncf : null,
          notas: formValue.notas || null
        };

        const detalles: CrearDetalleCompra[] = formValue.detalles.map((detalle: any) => ({
          compra_id: 0, // Se asignará en el servicio
          producto_id: Number(detalle.producto_id),
          cantidad: Number(detalle.cantidad),
          precio_unitario: Number(detalle.precio_unitario),
          subtotal: Number(detalle.cantidad) * Number(detalle.precio_unitario)
        }));

        await this.comprasService.crearCompra(compra, detalles);

        await Swal.fire({
          title: '¡Compra Registrada!',
          text: 'La compra se ha guardado y el stock ha sido actualizado.',
          icon: 'success',
          confirmButtonText: 'Ir a Compras',
          timer: 2000
        });

        this.router.navigate(['/compras']);

      } catch (error: any) {
        console.error('❌ Error al guardar compra:', error);
        await Swal.fire({
          title: 'Error',
          text: 'No se pudo registrar la compra: ' + (error.message || 'Error desconocido'),
          icon: 'error'
        });
      } finally {
        this.isSaving = false;
      }
    } else {
      this.marcarCamposComoTocados();
      Swal.fire('Formulario Incompleto', 'Por favor completa todos los campos requeridos', 'warning');
    }
  }

  private marcarCamposComoTocados() {
    Object.keys(this.compraForm.controls).forEach(key => {
      this.compraForm.get(key)?.markAsTouched();
    });

    this.detalles.controls.forEach(detalle => {
      Object.keys((detalle as FormGroup).controls).forEach(key => {
        detalle.get(key)?.markAsTouched();
      });
    });
  }

  async cancelar() {
    const result = await Swal.fire({
      title: '¿Cancelar?',
      text: 'Se perderán los datos ingresados',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'Continuar'
    });

    if (result.isConfirmed) {
      this.router.navigate(['/compras']);
    }
  }
}
