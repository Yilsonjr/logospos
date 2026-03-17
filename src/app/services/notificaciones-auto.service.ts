import { Injectable } from '@angular/core';
import { NotificacionesService } from './notificaciones.service';
import { VentasService } from './ventas.service';
import { CajaService } from './caja.service';
import { ProductosService } from './productos.service';
import { CuentasCobrarService } from './cuentas-cobrar.service';
import { CuentasPagarService } from './cuentas-pagar.service';

/**
 * Servicio para generar notificaciones automáticas
 * basadas en eventos del sistema
 */
@Injectable({
  providedIn: 'root'
})
export class NotificacionesAutoService {

  constructor(
    private notificacionesService: NotificacionesService,
    private ventasService: VentasService,
    private cajaService: CajaService,
    private productosService: ProductosService,
    private cuentasCobrarService: CuentasCobrarService,
    private cuentasPagarService: CuentasPagarService
  ) {
    this.inicializarMonitoreo();
  }

  private inicializarMonitoreo(): void {
    // Monitorear ventas
    this.monitorearVentas();

    // Monitorear caja
    this.monitorearCaja();

    // Monitorear stock
    this.monitorearStock();

    // Monitorear cuentas por cobrar
    this.monitorearCuentasCobrar();

    // Monitorear cuentas por pagar
    this.monitorearCuentasPagar();
  }

  // ==================== VENTAS ====================

  private monitorearVentas(): void {
    // DESACTIVADO: Notificaciones de ventas individuales generan mucho ruido.
    // Solo notificar acciones importantes como stock bajo o facturas vencidas.
    /*
    this.ventasService.ventas$.subscribe(ventas => {
      // ... lógica original ...
    });
    */
  }

  // ==================== CAJA ====================

  private monitorearCaja(): void {
    this.cajaService.cajas$.subscribe(cajas => {
      // Verificar si hay caja abierta
      const cajaAbierta = cajas.find(c => c.estado === 'abierta');

      if (cajaAbierta) {
        // Verificar si la caja lleva mucho tiempo abierta (más de 12 horas)
        const fechaApertura = new Date(cajaAbierta.fecha_apertura);
        const ahora = new Date();
        const horas = (ahora.getTime() - fechaApertura.getTime()) / (1000 * 60 * 60);

        if (horas > 12) {
          this.notificacionesService.agregarNotificacion({
            tipo: 'alerta',
            titulo: 'Caja abierta por mucho tiempo',
            mensaje: `La caja lleva ${Math.floor(horas)} horas abierta. Considera hacer un cierre.`,
            leida: false,
            icono: 'fa-solid fa-exclamation-triangle',
            color: '#f59e0b',
            link: '/caja/cierre'
          });
        }
      }
    });
  }

  // ==================== STOCK ====================

  private monitorearStock(): void {
    this.productosService.productos$.subscribe(productos => {
      // Verificar productos con stock bajo
      const productosStockBajo = productos.filter(p =>
        p.stock <= (p.stock_minimo || 0)
      );

      if (productosStockBajo.length > 0) {
        this.notificacionesService.agregarNotificacion({
          tipo: 'stock',
          titulo: 'Stock bajo',
          mensaje: `${productosStockBajo.length} producto(s) están por debajo del stock mínimo`,
          leida: false,
          icono: 'fa-solid fa-box-open',
          color: '#ef4444',
          link: '/inventario'
        });
      }

      // Verificar productos sin stock
      const productosSinStock = productos.filter(p =>
        p.stock === 0
      );

      if (productosSinStock.length > 0) {
        this.notificacionesService.agregarNotificacion({
          tipo: 'alerta',
          titulo: 'Productos sin stock',
          mensaje: `${productosSinStock.length} producto(s) no tienen stock disponible`,
          leida: false,
          icono: 'fa-solid fa-triangle-exclamation',
          color: '#dc2626',
          link: '/inventario'
        });
      }
    });
  }

  // ==================== CUENTAS POR COBRAR ====================

  private monitorearCuentasCobrar(): void {
    this.cuentasCobrarService.cuentas$.subscribe(cuentas => {
      // Verificar cuentas próximas a vencer (7 días)
      const cuentasProximasVencer = cuentas.filter(c => {
        if (c.estado === 'pagada') return false;

        const fechaVencimiento = new Date(c.fecha_vencimiento);
        const ahora = new Date();
        const diferencia = fechaVencimiento.getTime() - ahora.getTime();
        const dias = diferencia / (1000 * 60 * 60 * 24);

        return dias > 0 && dias <= 7;
      });

      if (cuentasProximasVencer.length > 0) {
        cuentasProximasVencer.forEach(cuenta => {
          const fechaVencimiento = new Date(cuenta.fecha_vencimiento);
          const ahora = new Date();
          const dias = Math.ceil((fechaVencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

          this.notificacionesService.agregarNotificacion({
            tipo: 'vencimiento',
            titulo: 'Cuenta por cobrar próxima a vencer',
            mensaje: `Cuenta de ${cuenta.cliente_nombre} vence en ${dias} día(s) - $${cuenta.monto_pendiente.toLocaleString()}`,
            leida: false,
            icono: 'fa-solid fa-exclamation-triangle',
            color: '#f59e0b',
            link: '/cuentas-cobrar'
          });
        });
      }

      // Verificar cuentas vencidas
      const cuentasVencidas = cuentas.filter(c => c.estado === 'vencida');

      if (cuentasVencidas.length > 0) {
        const totalVencido = cuentasVencidas.reduce((sum, c) => sum + c.monto_pendiente, 0);

        this.notificacionesService.agregarNotificacion({
          tipo: 'alerta',
          titulo: 'Cuentas vencidas',
          mensaje: `${cuentasVencidas.length} cuenta(s) vencida(s) - Total: $${totalVencido.toLocaleString()}`,
          leida: false,
          icono: 'fa-solid fa-circle-exclamation',
          color: '#ef4444',
          link: '/cuentas-cobrar'
        });
      }
    });
  }

  // ==================== CUENTAS POR PAGAR ====================

  private monitorearCuentasPagar(): void {
    this.cuentasPagarService.cuentas$.subscribe(cuentas => {
      // Verificar cuentas próximas a vencer (7 días)
      const cuentasProximasVencer = cuentas.filter(c => {
        if (c.estado === 'pagada') return false;

        const fechaVencimiento = new Date(c.fecha_vencimiento);
        const ahora = new Date();
        const diferencia = fechaVencimiento.getTime() - ahora.getTime();
        const dias = diferencia / (1000 * 60 * 60 * 24);

        return dias > 0 && dias <= 7;
      });

      if (cuentasProximasVencer.length > 0) {
        // Agrupar por prioridad
        const urgentes = cuentasProximasVencer.filter(c => c.prioridad === 'urgente');
        const altas = cuentasProximasVencer.filter(c => c.prioridad === 'alta');

        if (urgentes.length > 0) {
          urgentes.forEach(cuenta => {
            const fechaVencimiento = new Date(cuenta.fecha_vencimiento);
            const ahora = new Date();
            const dias = Math.ceil((fechaVencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

            this.notificacionesService.agregarNotificacion({
              tipo: 'alerta',
              titulo: 'Cuenta urgente por pagar',
              mensaje: `${cuenta.concepto} vence en ${dias} día(s) - $${cuenta.monto_pendiente.toLocaleString()}`,
              leida: false,
              icono: 'fa-solid fa-circle-exclamation',
              color: '#dc2626',
              link: '/cuentas-pagar'
            });
          });
        }

        if (altas.length > 0) {
          const totalAltas = altas.reduce((sum, c) => sum + c.monto_pendiente, 0);

          this.notificacionesService.agregarNotificacion({
            tipo: 'vencimiento',
            titulo: 'Cuentas prioritarias por pagar',
            mensaje: `${altas.length} cuenta(s) de alta prioridad próximas a vencer - $${totalAltas.toLocaleString()}`,
            leida: false,
            icono: 'fa-solid fa-exclamation-triangle',
            color: '#f59e0b',
            link: '/cuentas-pagar'
          });
        }
      }

      // Verificar cuentas vencidas
      const cuentasVencidas = cuentas.filter(c => c.estado === 'vencida');

      if (cuentasVencidas.length > 0) {
        const totalVencido = cuentasVencidas.reduce((sum, c) => sum + c.monto_pendiente, 0);

        this.notificacionesService.agregarNotificacion({
          tipo: 'alerta',
          titulo: 'Cuentas por pagar vencidas',
          mensaje: `${cuentasVencidas.length} cuenta(s) vencida(s) - Total: $${totalVencido.toLocaleString()}`,
          leida: false,
          icono: 'fa-solid fa-file-invoice-dollar',
          color: '#ef4444',
          link: '/cuentas-pagar'
        });
      }
    });
  }

  // ==================== MÉTODOS PÚBLICOS ====================

  /**
   * Notificar manualmente sobre una venta
   */
  notificarVenta(numeroVenta: string, total: number): void {
    this.notificacionesService.agregarNotificacion({
      tipo: 'venta',
      titulo: 'Nueva venta registrada',
      mensaje: `Venta ${numeroVenta} por $${total.toLocaleString()} completada`,
      leida: false,
      icono: 'fa-solid fa-shopping-cart',
      color: '#10b981',
      link: '/ventas/historial'
    });
  }

  /**
   * Notificar manualmente sobre apertura de caja
   */
  notificarAperturaCaja(montoInicial: number): void {
    this.notificacionesService.agregarNotificacion({
      tipo: 'caja',
      titulo: 'Caja abierta',
      mensaje: `Caja abierta con monto inicial de $${montoInicial.toLocaleString()}`,
      leida: false,
      icono: 'fa-solid fa-cash-register',
      color: '#3b82f6',
      link: '/caja'
    });
  }

  /**
   * Notificar manualmente sobre cierre de caja
   */
  notificarCierreCaja(montoFinal: number, totalVentas: number): void {
    this.notificacionesService.agregarNotificacion({
      tipo: 'caja',
      titulo: 'Caja cerrada',
      mensaje: `Caja cerrada - Monto final: $${montoFinal.toLocaleString()} - Ventas: $${totalVentas.toLocaleString()}`,
      leida: false,
      icono: 'fa-solid fa-cash-register',
      color: '#10b981',
      link: '/caja/historial'
    });
  }

  /**
   * Notificar manualmente sobre pago recibido
   */
  notificarPagoRecibido(cliente: string, monto: number): void {
    this.notificacionesService.agregarNotificacion({
      tipo: 'pago',
      titulo: 'Pago recibido',
      mensaje: `Pago de ${cliente} por $${monto.toLocaleString()} registrado`,
      leida: false,
      icono: 'fa-solid fa-money-bill-wave',
      color: '#10b981',
      link: '/cuentas-cobrar'
    });
  }

  /**
   * Notificar manualmente sobre pago realizado
   */
  notificarPagoRealizado(proveedor: string, monto: number): void {
    this.notificacionesService.agregarNotificacion({
      tipo: 'pago',
      titulo: 'Pago realizado',
      mensaje: `Pago a ${proveedor} por $${monto.toLocaleString()} registrado`,
      leida: false,
      icono: 'fa-solid fa-money-bill-transfer',
      color: '#3b82f6',
      link: '/cuentas-pagar'
    });
  }
}
