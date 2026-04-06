import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { VentaCompleta } from '../models/ventas.model';

export interface DatosNegocio {
    nombre: string;
    direccion?: string;
    telefono?: string;
    rnc?: string;
    mensaje_pie?: string;
}

@Injectable({ providedIn: 'root' })
export class PrintService {

    private datosNegocio: DatosNegocio | null = null;

    constructor(
        private supabase: SupabaseService,
        private tenantService: TenantService
    ) { }

    /**
     *  Carga los datos fiscales/negocio para el encabezado del ticket.
     *  Intenta primero configuracion_fiscal (tiene RNC, razón social),
     *  luego tenants como fallback.
     */
    async cargarDatosNegocio(): Promise<DatosNegocio> {
        if (this.datosNegocio) return this.datosNegocio;

        const tenantId = this.tenantService.tenantId;
        if (!tenantId) {
            return { nombre: 'Mi Negocio' };
        }

        // Intentar configuracion_fiscal
        const { data: fiscal } = await this.supabase.client
            .from('configuracion_fiscal')
            .select('razon_social, rnc, direccion_fiscal, telefono')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (fiscal?.razon_social) {
            this.datosNegocio = {
                nombre: fiscal.razon_social,
                rnc: fiscal.rnc || undefined,
                direccion: fiscal.direccion_fiscal || undefined,
                telefono: fiscal.telefono || undefined,
                mensaje_pie: '¡Gracias por su compra!'
            };
            return this.datosNegocio;
        }

        // Fallback: tenants table
        const { data: tenant } = await this.supabase.client
            .from('tenants')
            .select('nombre, dominio')
            .eq('id', tenantId)
            .maybeSingle();

        this.datosNegocio = {
            nombre: tenant?.nombre || 'Mi Negocio',
            mensaje_pie: '¡Gracias por su compra!'
        };
        return this.datosNegocio;
    }

    /**
     *  Abre una ventana de impresión con el ticket formateado.
     */
    async imprimirTicket(venta: VentaCompleta, cambio?: number, formato: '80mm' | '58mm' | 'A4' = '80mm') {
        const negocio = await this.cargarDatosNegocio();
        let html = '';
        let windowFeatures = '';

        if (formato === '80mm') {
            html = this.generarHTMLTicket80mm(venta, negocio, cambio);
            windowFeatures = 'width=320,height=600';
        } else if (formato === '58mm') {
            html = this.generarHTMLTicket58mm(venta, negocio, cambio);
            windowFeatures = 'width=240,height=500';
        } else if (formato === 'A4') {
            html = this.generarHTMLFacturaA4(venta, negocio, cambio);
            windowFeatures = 'width=800,height=900';
        }

        const ventana = window.open('', '_blank', windowFeatures);
        if (!ventana) {
            console.error('No se pudo abrir ventana de impresión');
            alert('El navegador bloqueó la ventana de impresión. Por favor, permite ventanas emergentes para este sitio.');
            return;
        }

        ventana.document.write(html);
        ventana.document.close();

        // Esperar a que se renderice, luego imprimir
        ventana.onload = () => {
            setTimeout(() => {
                ventana.print();
                ventana.onafterprint = () => ventana.close();
            }, 300);
        };

        // Fallback si onload no dispara (algunos navegadores con document.write)
        setTimeout(() => {
            if (ventana.document.readyState === 'complete') {
                ventana.focus();
                // ventana.print(); // Ya manejado en onload, pero preventivo
            }
        }, 500);
    }

    /**
     *  Genera el HTML completo del ticket con estilos inline para 80mm.
     */
    private generarHTMLTicket80mm(venta: VentaCompleta, negocio: DatosNegocio, cambio?: number): string {
        const fecha = new Date(venta.created_at || new Date()).toLocaleString('es-DO', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const metodoPagoLabel: Record<string, string> = {
            efectivo: 'Efectivo', tarjeta: 'Tarjeta', credito: 'Crédito',
            transferencia: 'Transferencia', crypto: 'Cripto', mixto: 'Mixto'
        };

        // Items HTML
        const itemsHtml = venta.detalles.map(d => `
      <tr>
        <td style="text-align:left;padding:2px 0;">${d.cantidad} x ${d.producto_nombre}</td>
        <td style="text-align:right;padding:2px 0;">${this.fmt(d.subtotal)}</td>
      </tr>
    `).join('');

        // Payment detail for mixto
        let pagoDetalle = '';
        if (venta.metodo_pago === 'mixto' || venta.metodo_pago === 'efectivo') {
            if (venta.monto_efectivo && venta.monto_efectivo > 0) {
                pagoDetalle += `<tr><td>Efectivo:</td><td style="text-align:right">${this.fmt(venta.monto_efectivo)}</td></tr>`;
            }
            if (venta.monto_tarjeta && venta.monto_tarjeta > 0) {
                pagoDetalle += `<tr><td>Tarjeta:</td><td style="text-align:right">${this.fmt(venta.monto_tarjeta)}</td></tr>`;
            }
            if (venta.monto_transferencia && venta.monto_transferencia > 0) {
                pagoDetalle += `<tr><td>Transferencia:</td><td style="text-align:right">${this.fmt(venta.monto_transferencia)}</td></tr>`;
            }
        }
        
        if (venta.metodo_pago === 'crypto' && venta.crypto_moneda) {
            const label = venta.crypto_moneda === 'BTC' ? 'BTC' : (venta.crypto_moneda === 'SOL' ? 'SOL' : 'USDT');
            pagoDetalle += `<tr><td>Monto Cripto:</td><td style="text-align:right">${venta.crypto_monto} ${label}</td></tr>`;
            pagoDetalle += `<tr><td>Tasa:</td><td style="text-align:right">${this.fmt(venta.crypto_tasa_dop || 0)} / ${label}</td></tr>`;
            if (venta.crypto_hash) {
                 const shortHash = venta.crypto_hash.substring(0, 8) + '...';
                 pagoDetalle += `<tr><td>Hash:</td><td style="text-align:right">${shortHash}</td></tr>`;
            }
        }

        const cambioHtml = cambio != null && cambio > 0
            ? `<tr><td><strong>Cambio:</strong></td><td style="text-align:right"><strong>${this.fmt(cambio)}</strong></td></tr>`
            : '';

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket ${venta.numero_venta}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 80mm;
      padding: 8px;
      color: #000;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .sep-double { border-top: 2px solid #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; }
    .total-line td { padding-top: 4px; }
    .big { font-size: 16px; font-weight: bold; }
    .footer { margin-top: 12px; text-align: center; font-size: 11px; color: #333; }
    @media print {
      body { width: 80mm; }
    }
  </style>
</head>
<body>
  <!-- HEADER: Business Info -->
  <div class="center">
    <div class="bold" style="font-size:16px;margin-bottom:2px;">${negocio.nombre}</div>
    ${negocio.direccion ? `<div>${negocio.direccion}</div>` : ''}
    ${negocio.telefono ? `<div>Tel: ${negocio.telefono}</div>` : ''}
    ${negocio.rnc ? `<div>RNC: ${negocio.rnc}</div>` : ''}
  </div>

  <div class="sep"></div>

  <!-- INVOICE INFO -->
  <table>
    <tr><td class="bold">Factura:</td><td style="text-align:right">${venta.numero_venta}</td></tr>
    ${venta.ncf ? `<tr><td class="bold">NCF:</td><td style="text-align:right">${venta.ncf}</td></tr>` : ''}
    <tr><td>Fecha:</td><td style="text-align:right">${fecha}</td></tr>
    ${venta.cliente_nombre ? `<tr><td>Cliente:</td><td style="text-align:right">${venta.cliente_nombre}</td></tr>` : ''}
    ${venta.rnc_cliente ? `<tr><td>RNC:</td><td style="text-align:right">${venta.rnc_cliente}</td></tr>` : ''}
  </table>

  <div class="sep"></div>

  <!-- ITEMS -->
  <table>
    <tr style="font-weight:bold;border-bottom:1px solid #000;">
      <td style="padding-bottom:3px;">Descripción</td>
      <td style="text-align:right;padding-bottom:3px;">Monto</td>
    </tr>
    ${itemsHtml}
  </table>

  <div class="sep"></div>

  <!-- TOTALS -->
  <table>
    <tr><td>Subtotal:</td><td style="text-align:right">${this.fmt(venta.subtotal)}</td></tr>
    ${venta.descuento > 0 ? `<tr><td>Descuento:</td><td style="text-align:right">-${this.fmt(venta.descuento)}</td></tr>` : ''}
    ${venta.impuestos > 0 ? `<tr><td>ITBIS (18%):</td><td style="text-align:right">${this.fmt(venta.impuestos)}</td></tr>` : ''}
    <tr class="total-line">
      <td class="big">TOTAL:</td>
      <td class="big" style="text-align:right">${this.fmt(venta.total)}</td>
    </tr>
  </table>

  <div class="sep-double"></div>

  <!-- PAYMENT -->
  <table>
    <tr><td class="bold">Pago:</td><td style="text-align:right">${metodoPagoLabel[venta.metodo_pago] || venta.metodo_pago}</td></tr>
    ${pagoDetalle}
    ${cambioHtml}
    ${venta.banco_destino ? `<tr><td>Banco:</td><td style="text-align:right">${venta.banco_destino}</td></tr>` : ''}
    ${venta.referencia_transferencia ? `<tr><td>Ref:</td><td style="text-align:right">${venta.referencia_transferencia}</td></tr>` : ''}
  </table>

  <div class="sep"></div>

  <!-- FOOTER -->
  <div class="footer">
    <div>${negocio.mensaje_pie || '¡Gracias por su compra!'}</div>
    <div style="margin-top:4px;">Vuelva pronto</div>
  </div>

</body>
</html>`;
    }

    private fmt(v: number): string {
        return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(v);
    }

    /**
     *  Genera el HTML completo del ticket con estilos inline para 58mm.
     */
    private generarHTMLTicket58mm(venta: VentaCompleta, negocio: DatosNegocio, cambio?: number): string {
        const fecha = new Date(venta.created_at || new Date()).toLocaleString('es-DO', {
            day: '2-digit', month: 'short', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });

        const metodoPagoLabel: Record<string, string> = {
            efectivo: 'Efectivo', tarjeta: 'Tarjeta', credito: 'Crédito',
            transferencia: 'Transf', crypto: 'Cripto', mixto: 'Mixto'
        };

        const itemsHtml = venta.detalles.map(d => `
      <tr>
        <td style="text-align:left;padding:1px 0;">${d.cantidad}x ${d.producto_nombre.substring(0, 15)}</td>
        <td style="text-align:right;padding:1px 0;">${this.fmt(d.subtotal)}</td>
      </tr>
    `).join('');

        let pagoDetalle = '';
        if (venta.metodo_pago === 'mixto' || venta.metodo_pago === 'efectivo') {
            if (venta.monto_efectivo && venta.monto_efectivo > 0) pagoDetalle += `<tr><td>EFE:</td><td style="text-align:right">${this.fmt(venta.monto_efectivo)}</td></tr>`;
            if (venta.monto_tarjeta && venta.monto_tarjeta > 0) pagoDetalle += `<tr><td>TAR:</td><td style="text-align:right">${this.fmt(venta.monto_tarjeta)}</td></tr>`;
            if (venta.monto_transferencia && venta.monto_transferencia > 0) pagoDetalle += `<tr><td>TRA:</td><td style="text-align:right">${this.fmt(venta.monto_transferencia)}</td></tr>`;
        }
        
        if (venta.metodo_pago === 'crypto' && venta.crypto_moneda) {
            const label = venta.crypto_moneda === 'BTC' ? 'BTC' : (venta.crypto_moneda === 'SOL' ? 'SOL' : 'USDT');
            pagoDetalle += `<tr><td>Cripto:</td><td style="text-align:right">${venta.crypto_monto} ${label}</td></tr>`;
            pagoDetalle += `<tr><td>Tasa:</td><td style="text-align:right">${this.fmt(venta.crypto_tasa_dop || 0)}</td></tr>`;
        }

        const cambioHtml = cambio != null && cambio > 0 ? `<tr><td><strong>Cambio:</strong></td><td style="text-align:right"><strong>${this.fmt(cambio)}</strong></td></tr>` : '';

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket 58mm ${venta.numero_venta}</title>
  <style>
    @page { margin: 0; size: 58mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 10px; width: 58mm; padding: 4px; color: #000; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .sep { border-top: 1px dashed #000; margin: 4px 0; }
    .sep-double { border-top: 2px solid #000; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; }
    .big { font-size: 13px; font-weight: bold; }
    .footer { margin-top: 8px; text-align: center; font-size: 9px; color: #333; }
    @media print { body { width: 58mm; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="bold" style="font-size:13px;margin-bottom:2px;">${negocio.nombre}</div>
    ${negocio.direccion ? `<div>${negocio.direccion}</div>` : ''}
    ${negocio.telefono ? `<div>Tel: ${negocio.telefono}</div>` : ''}
    ${negocio.rnc ? `<div>RNC: ${negocio.rnc}</div>` : ''}
  </div>
  <div class="sep"></div>
  <table>
    <tr><td class="bold">Fac:</td><td style="text-align:right">${venta.numero_venta}</td></tr>
    ${venta.ncf ? `<tr><td class="bold">NCF:</td><td style="text-align:right">${venta.ncf}</td></tr>` : ''}
    <tr><td>Fec:</td><td style="text-align:right">${fecha}</td></tr>
    ${venta.cliente_nombre ? `<tr><td>Cli:</td><td style="text-align:right">${venta.cliente_nombre.substring(0, 15)}</td></tr>` : ''}
    ${venta.rnc_cliente ? `<tr><td>RNC:</td><td style="text-align:right">${venta.rnc_cliente}</td></tr>` : ''}
  </table>
  <div class="sep"></div>
  <table>
    <tr style="font-weight:bold;border-bottom:1px solid #000;">
      <td style="padding-bottom:2px;">Desc</td><td style="text-align:right;padding-bottom:2px;">Monto</td>
    </tr>
    ${itemsHtml}
  </table>
  <div class="sep"></div>
  <table>
    <tr><td>Sub:</td><td style="text-align:right">${this.fmt(venta.subtotal)}</td></tr>
    ${venta.descuento > 0 ? `<tr><td>Desc:</td><td style="text-align:right">-${this.fmt(venta.descuento)}</td></tr>` : ''}
    ${venta.impuestos > 0 ? `<tr><td>ITB:</td><td style="text-align:right">${this.fmt(venta.impuestos)}</td></tr>` : ''}
    <tr class="total-line"><td class="big">TOT:</td><td class="big" style="text-align:right">${this.fmt(venta.total)}</td></tr>
  </table>
  <div class="sep-double"></div>
  <table>
    <tr><td class="bold">Pago:</td><td style="text-align:right">${metodoPagoLabel[venta.metodo_pago] || venta.metodo_pago}</td></tr>
    ${pagoDetalle}
    ${cambioHtml}
  </table>
  <div class="sep"></div>
  <div class="footer">
    <div>${negocio.mensaje_pie || '¡Gracias por su compra!'}</div>
  </div>
</body>
</html>`;
    }

    /**
     *  Genera el HTML completo del ticket con estilos para A4.
     */
    // ==================== CIERRE DE CAJA ====================

    /**
     * Datos necesarios para imprimir el ticket de cierre de caja.
     */
    async imprimirCierreCaja(datos: {
        cajero: string;
        fechaApertura: string;
        fechaCierre: string;
        montoInicial: number;
        ventasEfectivo: number;
        ventasTarjeta: number;
        totalEntradas: number;
        totalSalidas: number;
        montoEsperado: number;
        montoContado: number;
        diferencia: number;
        notas?: string;
    }) {
        const negocio = await this.cargarDatosNegocio();
        const html = this.generarHTMLCierreCaja(datos, negocio);

        const ventana = window.open('', '_blank', 'width=320,height=700');
        if (!ventana) {
            alert('El navegador bloqueó la ventana de impresión. Por favor, permite ventanas emergentes para este sitio.');
            return;
        }

        ventana.document.write(html);
        ventana.document.close();

        ventana.onload = () => {
            setTimeout(() => {
                ventana.print();
                ventana.onafterprint = () => ventana.close();
            }, 300);
        };
    }

    private generarHTMLCierreCaja(datos: any, negocio: DatosNegocio): string {
        const fApertura = new Date(datos.fechaApertura).toLocaleString('es-DO', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const fCierre = new Date(datos.fechaCierre).toLocaleString('es-DO', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const totalVentas = datos.ventasEfectivo + datos.ventasTarjeta;
        const difClass = datos.diferencia === 0 ? '' : (datos.diferencia > 0 ? 'color:#d97706;' : 'color:#dc2626;');
        const difLabel = datos.diferencia === 0 ? '✓ CUADRADO' : (datos.diferencia > 0 ? '▲ SOBRANTE' : '▼ FALTANTE');

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cierre de Caja</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 80mm;
      padding: 8px;
      color: #000;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .sep-double { border-top: 2px solid #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 2px 0; }
    .big { font-size: 16px; font-weight: bold; }
    .section-title { font-weight: bold; font-size: 11px; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px; }
    @media print { body { width: 80mm; } }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="center">
    <div class="bold" style="font-size:16px;margin-bottom:2px;">${negocio.nombre}</div>
    ${negocio.direccion ? `<div>${negocio.direccion}</div>` : ''}
    ${negocio.telefono ? `<div>Tel: ${negocio.telefono}</div>` : ''}
    ${negocio.rnc ? `<div>RNC: ${negocio.rnc}</div>` : ''}
  </div>

  <div class="sep-double"></div>

  <div class="center bold" style="font-size:14px;margin:4px 0;">CIERRE DE CAJA</div>

  <div class="sep"></div>

  <!-- TURNO -->
  <div class="section-title">Información del Turno</div>
  <table>
    <tr><td>Cajero:</td><td style="text-align:right" class="bold">${datos.cajero}</td></tr>
    <tr><td>Apertura:</td><td style="text-align:right">${fApertura}</td></tr>
    <tr><td>Cierre:</td><td style="text-align:right">${fCierre}</td></tr>
  </table>

  <div class="sep"></div>

  <!-- VENTAS -->
  <div class="section-title">Resumen de Ventas</div>
  <table>
    <tr><td>Ventas Efectivo:</td><td style="text-align:right">${this.fmt(datos.ventasEfectivo)}</td></tr>
    <tr><td>Ventas Tarjeta:</td><td style="text-align:right">${this.fmt(datos.ventasTarjeta)}</td></tr>
    <tr style="font-weight:bold;"><td>Total Ventas:</td><td style="text-align:right">${this.fmt(totalVentas)}</td></tr>
  </table>

  <div class="sep"></div>

  <!-- MOVIMIENTOS -->
  <div class="section-title">Movimientos</div>
  <table>
    <tr><td>Monto Inicial:</td><td style="text-align:right">${this.fmt(datos.montoInicial)}</td></tr>
    <tr><td>+ Entradas:</td><td style="text-align:right">${this.fmt(datos.totalEntradas)}</td></tr>
    <tr><td>- Salidas:</td><td style="text-align:right">${this.fmt(datos.totalSalidas)}</td></tr>
  </table>

  <div class="sep-double"></div>

  <!-- CUADRE -->
  <div class="section-title">Cuadre de Caja</div>
  <table>
    <tr><td>Esperado:</td><td style="text-align:right" class="bold">${this.fmt(datos.montoEsperado)}</td></tr>
    <tr><td>Contado:</td><td style="text-align:right" class="bold">${this.fmt(datos.montoContado)}</td></tr>
  </table>

  <div class="sep"></div>

  <div class="center" style="margin:6px 0;">
    <div class="big" style="${difClass}">${datos.diferencia > 0 ? '+' : ''}${this.fmt(datos.diferencia)}</div>
    <div class="bold" style="font-size:11px;${difClass}">${difLabel}</div>
  </div>

  ${datos.notas ? `
  <div class="sep"></div>
  <div class="section-title">Notas</div>
  <div style="font-size:11px;">${datos.notas}</div>
  ` : ''}

  <div class="sep-double"></div>

  <div class="center" style="font-size:10px;margin-top:6px;">
    <div>Documento no fiscal</div>
    <div>Generado por LogosPOS</div>
  </div>

</body>
</html>`;
    }

    private generarHTMLFacturaA4(venta: VentaCompleta, negocio: DatosNegocio, cambio?: number): string {
        const fecha = new Date(venta.created_at || new Date()).toLocaleString('es-DO', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const metodoPagoLabel: Record<string, string> = {
            efectivo: 'Efectivo', tarjeta: 'Tarjeta', credito: 'Crédito',
            transferencia: 'Transferencia', crypto: 'Criptomoneda', mixto: 'Mixto'
        };

        const itemsHtml = venta.detalles.map(d => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 0;">${d.producto_nombre}</td>
        <td style="padding: 12px 0; text-align: center;">${d.cantidad}</td>
        <td style="padding: 12px 0; text-align: right;">${this.fmt(d.precio_unitario)}</td>
        <td style="padding: 12px 0; text-align: right;">${this.fmt(d.subtotal)}</td>
      </tr>
    `).join('');

        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Factura ${venta.numero_venta}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; color: #333; margin: 0; padding: 0; }
    .container { width: 100%; max-width: 800px; margin: 0 auto; box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
    .business-info h1 { margin: 0 0 10px 0; color: #1e3a8a; font-size: 28px; }
    .business-info p { margin: 2px 0; color: #64748b; }
    .invoice-info { text-align: right; }
    .invoice-info h2 { margin: 0 0 10px 0; color: #2563eb; font-size: 32px; text-transform: uppercase; letter-spacing: 2px; }
    .invoice-info p { margin: 2px 0; font-weight: bold; }
    .client-section { margin-bottom: 40px; background: #f8fafc; padding: 20px; border-radius: 8px; }
    .client-section h3 { margin: 0 0 10px 0; color: #1e293b; font-size: 16px; text-transform: uppercase; }
    .client-section p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    th { background-color: #f1f5f9; color: #475569; padding: 12px 0; text-align: left; text-transform: uppercase; font-size: 12px; border-bottom: 2px solid #cbd5e1; }
    td { padding: 12px 0; }
    .totals { width: 50%; float: right; }
    .totals table { margin-bottom: 0; }
    .totals th, .totals td { padding: 8px 0; border: none; background: transparent; text-transform: none; font-size: 14px; }
    .totals .grand-total th, .totals .grand-total td { font-size: 20px; font-weight: bold; color: #1e293b; border-top: 2px solid #cbd5e1; padding-top: 12px; }
    .clearfix::after { content: ""; clear: both; display: table; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #cbd5e1; text-align: center; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="business-info">
        <h1>${negocio.nombre}</h1>
        ${negocio.direccion ? `<p>${negocio.direccion}</p>` : ''}
        ${negocio.telefono ? `<p>Teléfono: ${negocio.telefono}</p>` : ''}
        ${negocio.rnc ? `<p>RNC: ${negocio.rnc}</p>` : ''}
      </div>
      <div class="invoice-info">
        <h2>Factura</h2>
        <p>No. ${venta.numero_venta}</p>
        <p style="font-weight: normal; color: #64748b;">${fecha}</p>
        ${venta.ncf ? `<p style="margin-top: 10px; color: #000;">NCF: ${venta.ncf}</p>` : ''}
      </div>
    </div>

    <div class="client-section">
      <h3>Cobrar a:</h3>
      <p><strong>${venta.cliente_nombre || 'Cliente al Contado'}</strong></p>
      ${venta.rnc_cliente ? `<p>RNC/Cédula: ${venta.rnc_cliente}</p>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th style="padding-left: 10px;">Descripción</th>
          <th style="text-align: center;">Cant.</th>
          <th style="text-align: right;">Precio Unit.</th>
          <th style="text-align: right; padding-right: 10px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="clearfix">
      <div style="float: left; width: 40%; padding-top: 10px;">
        <p><strong>Método de Pago:</strong> ${metodoPagoLabel[venta.metodo_pago] || venta.metodo_pago}</p>
        ${venta.referencia_transferencia ? `<p><strong>Referencia:</strong> ${venta.referencia_transferencia}</p>` : ''}
        ${venta.banco_destino ? `<p><strong>Banco:</strong> ${venta.banco_destino}</p>` : ''}
        ${venta.metodo_pago === 'crypto' && venta.crypto_moneda ? `
            <p><strong>Moneda:</strong> ${venta.crypto_moneda === 'BTC' ? 'Bitcoin (BTC)' : (venta.crypto_moneda === 'SOL' ? 'Solana (SOL)' : 'USDT TRC-20')}</p>
            <p><strong>Monto Cripto:</strong> ${venta.crypto_monto} ${venta.crypto_moneda === 'BTC' ? 'BTC' : (venta.crypto_moneda === 'SOL' ? 'SOL' : 'USDT')}</p>
            <p><strong>Tasa de Cambio:</strong> ${this.fmt(venta.crypto_tasa_dop || 0)}</p>
            ${venta.crypto_hash ? `<p><strong>Hash (Txid):</strong> ${venta.crypto_hash}</p>` : ''}
        ` : ''}
      </div>

      <div class="totals">
        <table>
          <tr><th style="text-align: left;">Subtotal</th><td style="text-align: right;">${this.fmt(venta.subtotal)}</td></tr>
          ${venta.descuento > 0 ? `<tr><th style="text-align: left; color: #ef4444;">Descuento</th><td style="text-align: right; color: #ef4444;">-${this.fmt(venta.descuento)}</td></tr>` : ''}
          ${venta.impuestos > 0 ? `<tr><th style="text-align: left;">ITBIS (18%)</th><td style="text-align: right;">${this.fmt(venta.impuestos)}</td></tr>` : ''}
          <tr class="grand-total">
            <th style="text-align: left;">Total a Pagar</th>
            <td style="text-align: right;">${this.fmt(venta.total)}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="footer">
      <p>${negocio.mensaje_pie || '¡Gracias por su compra! Apreciamos su negocio.'}</p>
    </div>
  </div>
</body>
</html>`;
    }
}
