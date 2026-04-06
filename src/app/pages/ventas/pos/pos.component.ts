import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { VentasService } from '../../../services/ventas.service';
import { ProductosService } from '../../../services/productos.service';
import { ClientesService } from '../../../services/clientes.service';
import { CuentasCobrarService } from '../../../services/cuentas-cobrar.service';
import { CategoriasService } from '../../../services/categorias.service';
import { ItemCarrito, CrearVenta, METODOS_PAGO, VentaCompleta } from '../../../models/ventas.model';
import { Productos } from '../../../models/productos.model';
import { Cliente } from '../../../models/clientes.model';
import { CrearCuentaPorCobrar } from '../../../models/cuentas-cobrar.model';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { SidebarService } from '../../../services/sidebar.service';
import { FiscalService } from '../../../services/fiscal.service';
import { ConfiguracionFiscal, TIPOS_COMPROBANTE } from '../../../models/fiscal.model';
import { ModalPagoComponent } from '../modal.pago/modal.pago';
import { CajaService } from '../../../services/caja.service';
import { Caja } from '../../../models/caja.model';
import { PrintService } from '../../../services/print.service';
import { SyncService } from '../../../services/offline/sync.service';

@Component({
  selector: 'app-pos',
  imports: [CommonModule, FormsModule, ModalPagoComponent],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})
export class PosComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  private sidebarWasExpanded = false; // Estado previo del sidebar
  public isSidebarCollapsed = false; // Estado actual para la vista
  activeMobileTab: 'products' | 'cart' = 'products';

  // Datos
  productos: Productos[] = [];
  clientes: Cliente[] = [];
  carrito: ItemCarrito[] = [];

  // Búsqueda con autocompletado
  busquedaProducto: string = '';
  productosFiltrados: Productos[] = [];
  mostrarAutocomplete: boolean = false;
  selectedAutocompleteIndex: number = 0;

  // Categorías y filtros (dinámicas desde BD)
  categoriaSeleccionada: string = 'all';
  categorias: Array<{ id: string; nombre: string; icono: string; color: string }> = [
    { id: 'all', nombre: 'Todos', icono: 'fa-solid fa-grid-2', color: '#2563eb' }
  ];

  // Cliente seleccionado
  clienteSeleccionado?: Cliente;

  // Totales
  subtotal: number = 0;
  descuentoTotal: number = 0;
  impuesto: number = 0;
  total: number = 0;

  // Caja actual
  cajaActual: Caja | null = null;

  // Pago
  metodoPago: 'efectivo' | 'tarjeta' | 'credito' | 'transferencia' | 'mixto' | 'crypto' = 'efectivo';
  montoEfectivo: number = 0;
  montoTarjeta: number = 0;
  montoTransferencia: number = 0;
  bancoDestino: string = '';
  referenciaTransferencia: string = '';
  cambio: number = 0;
  metodosPago = METODOS_PAGO.map(m => ({ valor: m.valor as 'efectivo' | 'tarjeta' | 'credito' | 'transferencia' | 'mixto', etiqueta: m.etiqueta, icono: m.icono }));

  // UI
  mostrarPago: boolean = false;
  mostrarDescuento?: number; // ID del producto para mostrar descuento
  cargando: boolean = true;

  // Fiscal
  configFiscal: ConfiguracionFiscal | null = null;
  tipoComprobante: string = 'B02';
  rncCliente: string = '';
  tiposComprobante = TIPOS_COMPROBANTE;
  isOffline: boolean = false;

  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private ventasService: VentasService,
    private productosService: ProductosService,
    private clientesService: ClientesService,
    private cuentasCobrarService: CuentasCobrarService,
    private sidebarService: SidebarService,
    private fiscalService: FiscalService,
    private cajaService: CajaService,
    private printService: PrintService,
    private categoriasService: CategoriasService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private syncService: SyncService
  ) { }

  async ngOnInit() {
    // 0. Suscribirse al estado del sidebar
    this.subscriptions.push(
      this.sidebarService.isCollapsed$.subscribe(
        collapsed => this.isSidebarCollapsed = collapsed
      )
    );

    // Verificar estado actual del sidebar y colapsar solo si está expandido
    if (!this.sidebarService.getCollapsed()) {
      this.sidebarWasExpanded = true;
      this.sidebarService.setCollapsed(true, false); // Colapsar temporalmente sin persistir
    }

    // PRIMERO: Suscribirse a los observables
    const productosSub = this.productosService.productos$.subscribe(productos => {
      this.productos = productos;
      this.aplicarFiltroCategorias(); // Aplicar filtro activo al recargar
      this.cdr.detectChanges();
    });

    const clientesSub = this.clientesService.clientes$.subscribe(clientes => {
      this.clientes = clientes;
      this.cdr.detectChanges();
    });

    const fiscalSub = this.fiscalService.config$.subscribe(config => {
      this.configFiscal = config;
      // Resetear a B02 si cambia la config o inicia
      if (config?.modo_fiscal) {
        this.tipoComprobante = 'B02';
      }
    });

    const cajaSub = this.cajaService.cajaActual$.subscribe(caja => {
      this.cajaActual = caja;
      this.cdr.detectChanges();
    });

    const onlineSub = this.syncService.isOnline$.subscribe(isOnline => {
      this.isOffline = !isOnline;
      if (this.isOffline && this.configFiscal?.modo_fiscal) {
        // En modo offline fiscal, solo permitimos B02 (Consumidor Final)
        if (this.tipoComprobante !== 'B02') {
          this.tipoComprobante = 'B02';
          this.cdr.detectChanges();
        }
      }
    });

    // Suscribirse a categorías para filtros del POS
    const categoriasSub = this.categoriasService.categorias$.subscribe(cats => {
      this.categorias = [
        { id: 'all', nombre: 'Todos', icono: 'fa-solid fa-grid-2', color: '#2563eb' },
        ...cats.map(c => ({
          id: c.nombre.toLowerCase().replace(/\s+/g, '-'),
          nombre: c.nombre,
          icono: 'fa-solid fa-tag',
          color: c.color || '#6b7280'
        }))
      ];
      this.cdr.detectChanges();
    });

    this.subscriptions.push(productosSub, clientesSub, fiscalSub, cajaSub, onlineSub, categoriasSub);

    // DESPUÉS: Cargar datos
    await this.cargarDatos();
    await this.verificarCaja();

    // Recargar cuando se navega al POS
    const navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(async (event: any) => {
        if (event.url.includes('/ventas/nueva')) {
          await this.cargarDatos();
        }
      });

    this.subscriptions.push(navSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Restaurar sidebar solo si lo colapsamos nosotros
    if (this.sidebarWasExpanded) {
      this.sidebarService.setCollapsed(false, false);
    }
  }

  ngAfterViewInit() {
    // Autofocus en el buscador al cargar el POS
    setTimeout(() => this.focusBusqueda(), 300);
  }

  toggleSidebar() {
    this.sidebarService.toggleSidebar();
  }

  setMobileTab(tab: 'products' | 'cart') {
    this.activeMobileTab = tab;
  }

  // Listener global para cerrar autocomplete al hacer click fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-box')) {
      this.mostrarAutocomplete = false;
    }
  }

  // Listener global para atajos de teclado
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // F5 = Focus en búsqueda
    if (event.key === 'F5') {
      event.preventDefault();
      this.focusBusqueda();
    }

    // F12 = Procesar pago
    if (event.key === 'F12' && this.carrito.length > 0) {
      event.preventDefault();
      this.mostrarPago = true;
    }

    // F9 = Limpiar carrito
    if (event.key === 'F9' && this.carrito.length > 0) {
      event.preventDefault();
      this.limpiarCarrito();
    }

    // ESC = Cerrar modal de pago
    if (event.key === 'Escape' && this.mostrarPago) {
      event.preventDefault();
      this.cerrarModalPago();
    }
  }

  async cargarDatos() {
    this.cargando = true;
    try {
      // Cargar productos y clientes en paralelo
      await Promise.all([
        this.productosService.cargarProductos(),
        this.clientesService.cargarClientes()
      ]);

    } catch (error) {
      console.error('❌ Error al cargar datos del POS:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async verificarCaja() {
    const caja = await this.cajaService.verificarCajaAbierta();
    if (!caja) {
      await Swal.fire({
        title: '¡Caja Requerida!',
        text: 'No tienes una caja abierta. Para realizar ventas, primero debes realizar la apertura de tu caja.',
        icon: 'warning',
        confirmButtonText: 'Ir a Apertura de Caja',
        confirmButtonColor: '#2563eb',
        allowOutsideClick: false,
        allowEscapeKey: false
      });
      this.router.navigate(['/caja/apertura']);
    }
  }

  // Búsqueda de productos con autocompletado
  buscarProducto() {
    if (!this.busquedaProducto.trim()) {
      this.productosFiltrados = [];
      this.selectedAutocompleteIndex = 0;
      return;
    }

    const busqueda = this.busquedaProducto.toLowerCase();
    const base = this.categoriaSeleccionada === 'all'
      ? this.productos
      : this.productos.filter(p => p.categoria?.toLowerCase().replace(/\s+/g, '-') === this.categoriaSeleccionada);

    this.productosFiltrados = base.filter(p =>
      p.nombre.toLowerCase().includes(busqueda) ||
      p.sku?.toLowerCase().includes(busqueda) ||
      p.codigo_barras?.toLowerCase().includes(busqueda)
    );

    this.selectedAutocompleteIndex = 0;
    this.mostrarAutocomplete = true;
  }

  // Aplicar filtro de categoría al grid de productos
  seleccionarCategoria(id: string) {
    this.categoriaSeleccionada = id;
    this.limpiarBusqueda();
    this.aplicarFiltroCategorias();
  }

  aplicarFiltroCategorias() {
    if (this.categoriaSeleccionada === 'all') {
      this.productosFiltrados = this.productos;
    } else {
      this.productosFiltrados = this.productos.filter(p =>
        p.categoria?.toLowerCase().replace(/\s+/g, '-') === this.categoriaSeleccionada
      );
    }
    this.cdr.detectChanges();
  }

  // Manejar teclas en búsqueda
  handleSearchKeydown(event: KeyboardEvent) {
    if (!this.mostrarAutocomplete || this.productosFiltrados.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedAutocompleteIndex = Math.min(
          this.selectedAutocompleteIndex + 1,
          Math.min(this.productosFiltrados.length - 1, 7)
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedAutocompleteIndex = Math.max(this.selectedAutocompleteIndex - 1, 0);
        break;

      case 'Enter':
        event.preventDefault();
        if (this.productosFiltrados[this.selectedAutocompleteIndex]) {
          this.agregarAlCarrito(this.productosFiltrados[this.selectedAutocompleteIndex]);
          this.limpiarBusqueda();
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.limpiarBusqueda();
        break;
    }
  }

  // Limpiar búsqueda
  limpiarBusqueda() {
    this.busquedaProducto = '';
    this.productosFiltrados = [];
    this.mostrarAutocomplete = false;
    this.selectedAutocompleteIndex = 0;
  }

  // Focus en búsqueda
  focusBusqueda() {
    if (this.searchInput) {
      this.searchInput.nativeElement.focus();
      this.searchInput.nativeElement.select();
    }
  }

  // Agregar producto al carrito
  async agregarAlCarrito(producto: Productos) {
    // Verificar si ya está en el carrito
    const itemExistente = this.carrito.find(item => item.producto_id === producto.id);

    if (itemExistente) {
      // Verificar stock disponible
      if (itemExistente.cantidad < producto.stock) {
        itemExistente.cantidad++;
        this.calcularSubtotalItem(itemExistente);
      } else {
        await Swal.fire({
          title: 'Stock Insuficiente',
          text: 'No hay suficiente stock disponible',
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
      }
    } else {
      // Agregar nuevo item
      if (producto.stock > 0) {
        const nuevoItem: ItemCarrito = {
          producto_id: producto.id!,
          producto_nombre: producto.nombre,
          precio_unitario: producto.precio_venta,
          cantidad: 1,
          descuento: 0,
          subtotal: producto.precio_venta,
          stock_disponible: producto.stock,
          categoria: producto.categoria,
          imagen_url: producto.imagen_url
        };
        this.carrito.push(nuevoItem);
      } else {
        await Swal.fire({
          title: 'Sin Stock',
          text: 'Producto sin stock',
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
      }
    }

    this.calcularTotales();
    this.limpiarBusqueda(); // Limpiar búsqueda después de agregar
  }

  // Calcular subtotal de un item
  calcularSubtotalItem(item: ItemCarrito) {
    item.subtotal = (item.precio_unitario * item.cantidad) - item.descuento;
  }

  // Actualizar cantidad de un item
  async actualizarCantidad(item: ItemCarrito, cantidad: number) {
    if (cantidad <= 0) {
      this.eliminarDelCarrito(item);
      return;
    }

    if (cantidad > item.stock_disponible) {
      await Swal.fire({
        title: 'Stock Insuficiente',
        text: 'No hay suficiente stock disponible',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    item.cantidad = cantidad;
    this.calcularSubtotalItem(item);
    this.calcularTotales();
  }

  // Aplicar descuento a un item
  aplicarDescuentoItem(item: ItemCarrito, descuento: number) {
    if (descuento < 0) descuento = 0;
    if (descuento > item.precio_unitario * item.cantidad) {
      descuento = item.precio_unitario * item.cantidad;
    }

    item.descuento = descuento;
    this.calcularSubtotalItem(item);
    this.calcularTotales();
  }

  // Eliminar item del carrito
  eliminarDelCarrito(item: ItemCarrito) {
    const index = this.carrito.indexOf(item);
    if (index > -1) {
      this.carrito.splice(index, 1);
      this.calcularTotales();
    }
  }

  // Limpiar carrito
  async limpiarCarrito() {
    if (this.carrito.length > 0) {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Deseas limpiar el carrito?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, limpiar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        this.carrito = [];
        this.calcularTotales();
        this.clienteSeleccionado = undefined;
        this.metodoPago = 'efectivo';
        this.montoEfectivo = 0;
        this.montoTarjeta = 0;
        this.mostrarPago = false;
      }
    }
  }

  // Seleccionar cliente
  seleccionarCliente(cliente: Cliente) {
    this.clienteSeleccionado = cliente;

    // Auto-detect NCF type if fiscal mode is active
    if (this.configFiscal?.modo_fiscal && !this.isOffline) {
      if (cliente.rnc) {
        this.tipoComprobante = 'B01'; // Crédito Fiscal (tiene RNC)
        this.rncCliente = cliente.rnc;
      } else {
        this.tipoComprobante = 'B02'; // Consumidor Final
      }
    } else if (this.isOffline) {
      this.tipoComprobante = 'B02'; // Forzado por offline
    }

    // Aplicar descuento del cliente si tiene
    if (cliente.descuento_porcentaje > 0) {
      this.carrito.forEach(item => {
        const descuentoPorcentaje = (item.precio_unitario * item.cantidad * cliente.descuento_porcentaje) / 100;
        item.descuento = descuentoPorcentaje;
        this.calcularSubtotalItem(item);
      });
      this.calcularTotales();
    }
  }

  // Calcular totales
  calcularTotales() {
    this.subtotal = this.carrito.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
    this.descuentoTotal = this.carrito.reduce((sum, item) => sum + item.descuento, 0);

    const baseImponible = this.subtotal - this.descuentoTotal;

    // ITBIS (18%) solo aplica si el negocio tiene modo fiscal activado.
    // Un negocio no registrado/informal factura sin impuesto desglosado.
    if (this.configFiscal?.modo_fiscal) {
      this.impuesto = baseImponible * 0.18;
    } else {
      this.impuesto = 0;
    }

    this.total = baseImponible + this.impuesto;

    // Si es pago en efectivo, calcular cambio
    if (this.metodoPago === 'efectivo') {
      this.cambio = this.montoEfectivo - this.total;
    }
  }


  // Evento desde Modal de Pago
  onPagoConfirmado(datos: any) {
    this.metodoPago = datos.metodoPago;
    this.montoEfectivo = datos.montoEfectivo;
    this.montoTarjeta = datos.montoTarjeta;
    this.montoTransferencia = datos.montoTransferencia || 0;
    this.bancoDestino = datos.bancoDestino || '';
    this.referenciaTransferencia = datos.referenciaTransferencia || '';
    this.cambio = datos.cambio;
    // Almacenar datos cripto para pasarlos a procesarVenta
    this._cryptoDatosPago = {
      crypto_moneda: datos.crypto_moneda || null,
      crypto_monto: datos.crypto_monto || null,
      crypto_tasa_dop: datos.crypto_tasa_dop || null,
      crypto_hash: datos.crypto_hash || null,
    };

    // Aplicar descuento global al total si se ingresó en el modal
    if (datos.descuento && datos.descuento > 0) {
      this.descuentoTotal = (this.descuentoTotal || 0) + datos.descuento;
      this.total = Math.max(this.total - datos.descuento, 0);
    }

    this.procesarVenta();
  }

  // Almacen temporal de datos cripto entre el modal y procesarVenta
  private _cryptoDatosPago: any = {};

  // Validar pago
  async validarPago(): Promise<boolean> {
    if (!this.cajaActual) {
      await Swal.fire({
        title: 'Caja Cerrada',
        text: 'Debes tener una caja abierta para procesar ventas.',
        icon: 'error',
        confirmButtonText: 'Ir a Caja'
      });
      this.router.navigate(['/caja/apertura']);
      return false;
    }

    if (this.carrito.length === 0) {
      await Swal.fire({
        title: 'Carrito Vacío',
        text: 'El carrito está vacío',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return false;
    }

    if (this.metodoPago === 'credito') {
      if (!this.clienteSeleccionado) {
        await Swal.fire({
          title: 'Cliente Requerido',
          text: 'Debe seleccionar un cliente para venta a crédito',
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
        return false;
      }

      // Verificar límite de crédito
      const creditoDisponible = this.clienteSeleccionado.limite_credito - this.clienteSeleccionado.balance_pendiente;
      if (this.total > creditoDisponible) {
        await Swal.fire({
          title: 'Crédito Insuficiente',
          text: `El cliente no tiene suficiente crédito disponible. Disponible: RD${creditoDisponible.toFixed(2)}`,
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
        return false;
      }
    }

    return true;
  }

  // Procesar venta
  async procesarVenta() {
    if (!(await this.validarPago())) return;

    // Validación Fiscal
    if (this.configFiscal?.modo_fiscal) {
      if (this.tipoComprobante === 'B01' && !this.rncCliente) {
        // Si es Crédito Fiscal, el RNC es obligatorio
        // Intentar obtener del cliente si no se escribió manualmente
        if (this.clienteSeleccionado?.rnc) {
          this.rncCliente = this.clienteSeleccionado.rnc;
        } else {
          await Swal.fire({
            title: 'RNC Requerido',
            text: 'Para facturas con Crédito Fiscal (B01) debe ingresar el RNC del cliente.',
            icon: 'warning',
            confirmButtonText: 'Aceptar'
          });
          return;
        }
      }
    }

    try {
      // Generar NCF si está activo
      let ncfGenerado = '';
      if (this.configFiscal?.modo_fiscal) {
        try {
          ncfGenerado = await this.fiscalService.generarNCF(this.tipoComprobante);
        } catch (error: any) {
          await Swal.fire({
            title: 'Error Fiscal',
            text: error.message || 'Error al generar NCF. Verifique las secuencias.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          return;
        }
      }

      const venta: CrearVenta = {
        cliente_id: this.clienteSeleccionado?.id,
        caja_id: this.cajaActual?.id, // Pasar ID de la caja abierta
        subtotal: this.subtotal,
        descuento: this.descuentoTotal,
        impuesto: this.impuesto,
        total: this.total,
        metodo_pago: this.metodoPago,
        monto_efectivo: this.montoEfectivo,
        monto_tarjeta: this.montoTarjeta,
        monto_transferencia: this.montoTransferencia,
        banco_destino: this.bancoDestino || undefined,
        referencia_transferencia: this.referenciaTransferencia || undefined,
        cambio: this.cambio,
        // Datos Fiscales
        ncf: ncfGenerado,
        tipo_ncf: this.configFiscal?.modo_fiscal ? this.tipoComprobante : undefined,
        rnc_cliente: this.rncCliente || this.clienteSeleccionado?.rnc,
        nombre_cliente_fiscal: this.clienteSeleccionado?.nombre, // O razón social si tuviéramos campo separado

        detalles: this.carrito.map(item => ({
          producto_id: item.producto_id,
          producto_nombre: item.producto_nombre,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          descuento: item.descuento,
          subtotal: item.subtotal
        })),
        // Datos cripto (solo si el pago fue en crypto)
        ...(this.metodoPago === 'crypto' ? this._cryptoDatosPago : {})
      };

      const ventaCreada = await this.ventasService.crearVenta(venta);

      // Si es venta a crédito, crear cuenta por cobrar automáticamente
      if (this.metodoPago === 'credito' && this.clienteSeleccionado) {
        await this.crearCuentaPorCobrar(ventaCreada);
      }

      // Mostrar mensaje de éxito con SweetAlert2
      let mensaje = `Factura: ${ventaCreada.numero_venta}<br>Total: RD$${this.total.toFixed(2)}`;

      if (this.configFiscal?.modo_fiscal && ncfGenerado) {
        mensaje += `<br><strong>NCF: ${ncfGenerado}</strong>`;
      }

      if (this.metodoPago === 'credito') {
        mensaje += `<br><br>💳 Cuenta por cobrar creada<br>Cliente: ${this.clienteSeleccionado?.nombre}`;
      } else if ((this.metodoPago === 'efectivo' || this.metodoPago === 'mixto') && this.cambio > 0) {
        mensaje += `<br><br>💵 Cambio: RD$${this.cambio.toFixed(2)}`;
      }

      const result = await Swal.fire({
        title: '✅ Venta Completada',
        html: mensaje,
        icon: 'success',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fa-solid fa-receipt"></i> Imprimir 80mm',
        denyButtonText: '<i class="fa-solid fa-file-invoice"></i> Imprimir A4',
        cancelButtonText: 'Nueva Venta',
        confirmButtonColor: '#3b82f6',
        denyButtonColor: '#6366f1',
        cancelButtonColor: '#16a34a',
        customClass: {
          actions: 'flex-wrap gap-2'
        }
      });

      if (result.isConfirmed || result.isDenied) {
        const ticketVenta: VentaCompleta = {
          ...ventaCreada,
          detalles: venta.detalles as any,
          cliente_nombre: this.clienteSeleccionado?.nombre
        } as VentaCompleta;
        
        const formatoElegido = result.isConfirmed ? '80mm' : 'A4';
        this.printService.imprimirTicket(ticketVenta, this.cambio, formatoElegido);
      }

      // Limpiar todo
      this.carrito = [];
      this.clienteSeleccionado = undefined;
      this.metodoPago = 'efectivo';
      this.montoEfectivo = 0;
      this.montoTarjeta = 0;
      this.cambio = 0;
      this.mostrarPago = false;
      this.rncCliente = ''; // Limpiar RNC
      this.tipoComprobante = 'B02'; // Resetear a consumidor final
      this.calcularTotales();

    } catch (error) {
      console.error('Error al procesar venta:', error);
      await Swal.fire({
        title: '❌ Error',
        text: 'Error al procesar la venta. Intenta nuevamente.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  // Crear cuenta por cobrar para venta a crédito
  private async crearCuentaPorCobrar(venta: any): Promise<void> {
    try {
      if (!this.clienteSeleccionado) return;

      // Calcular fecha de vencimiento (30 días por defecto)
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

      const cuenta: CrearCuentaPorCobrar = {
        cliente_id: this.clienteSeleccionado.id!,
        venta_id: venta.id,
        monto_total: this.total,
        monto_pagado: 0,
        monto_pendiente: this.total,
        fecha_venta: new Date().toISOString().split('T')[0],
        fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
        estado: 'pendiente',
        notas: `Venta a crédito - Factura ${venta.numero_venta}`
      };

      await this.cuentasCobrarService.crearCuenta(cuenta);

    } catch (error) {
      console.error('💥 Error al crear cuenta por cobrar:', error);
      // No lanzar error para no bloquear la venta
      await Swal.fire({
        title: '⚠️ Advertencia',
        text: 'Venta completada pero hubo un error al crear la cuenta por cobrar. Créala manualmente.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  // Formatear moneda
  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }

  // Obtener icono según categoría
  getProductoIcon(categoria: string): string {
    const categoriaLower = categoria?.toLowerCase() || '';

    if (categoriaLower.includes('bebida') || categoriaLower.includes('refresco') || categoriaLower.includes('jugo')) {
      return '🥤';
    }
    if (categoriaLower.includes('snack') || categoriaLower.includes('galleta') || categoriaLower.includes('dulce')) {
      return '🍪';
    }
    if (categoriaLower.includes('lácteo') || categoriaLower.includes('lacteo') || categoriaLower.includes('leche') || categoriaLower.includes('yogurt')) {
      return '🥛';
    }
    if (categoriaLower.includes('pan') || categoriaLower.includes('panadería')) {
      return '🍞';
    }
    if (categoriaLower.includes('carne') || categoriaLower.includes('pollo') || categoriaLower.includes('res')) {
      return '🍖';
    }
    if (categoriaLower.includes('fruta') || categoriaLower.includes('verdura') || categoriaLower.includes('vegetal')) {
      return '🍎';
    }
    if (categoriaLower.includes('limpieza') || categoriaLower.includes('aseo')) {
      return '🧹';
    }
    if (categoriaLower.includes('higiene') || categoriaLower.includes('personal')) {
      return '🧴';
    }

    return '📦'; // Icono por defecto
  }

  // Cerrar modal de pago
  cerrarModalPago() {
    this.mostrarPago = false;
  }
}
