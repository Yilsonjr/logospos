import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { METODOS_PAGO } from '../../../models/ventas.model';
import { Cliente } from '../../../models/clientes.model';
import { ConfiguracionFiscal, TIPOS_COMPROBANTE } from '../../../models/fiscal.model';
import { VerifoneService } from '../../../services/verifone.service';
import { SyncService } from '../../../services/offline/sync.service';
import { CryptoService, CryptoMoneda, CryptoConfig } from '../../../services/crypto.service';
import Swal from 'sweetalert2';

// Bancos principales de RD
export const BANCOS_RD = [
    { id: 'banreservas', nombre: 'Banreservas' },
    { id: 'popular', nombre: 'Banco Popular' },
    { id: 'bhd', nombre: 'BHD León' },
    { id: 'scotiabank', nombre: 'Scotiabank' },
    { id: 'santa_cruz', nombre: 'Banco Santa Cruz' },
    { id: 'promerica', nombre: 'Banco Promerica' },
    { id: 'caribe', nombre: 'Banco Caribe' },
    { id: 'lopez_haro', nombre: 'Banco López de Haro' },
    { id: 'vimenca', nombre: 'Banco Vimenca' },
    { id: 'ademi', nombre: 'Banco ADEMI' },
    { id: 'asociacion_popular', nombre: 'Asociación Popular' },
    { id: 'asociacion_cibao', nombre: 'Asociación Cibao' },
    { id: 'otro', nombre: 'Otro' }
];

type MetodoPago = 'efectivo' | 'tarjeta' | 'credito' | 'transferencia' | 'mixto' | 'crypto';

@Component({
    selector: 'app-modal-pago',
    imports: [CommonModule, FormsModule],
    templateUrl: './modal.pago.html',
    styleUrl: './modal.pago.css'
})
export class ModalPagoComponent implements OnInit, OnChanges {
    @Input() total: number = 0;
    @Input() clienteSeleccionado?: Cliente;

    // === FISCAL ===
    @Input() configFiscal: ConfiguracionFiscal | null = null;
    @Input() tipoComprobante: string = 'B02';
    @Input() rncCliente: string = '';
    @Output() tipoComprobanteChange = new EventEmitter<string>();
    @Output() rncClienteChange = new EventEmitter<string>();
    tiposComprobante = TIPOS_COMPROBANTE.filter(t => t.codigo !== 'B03' && t.codigo !== 'B04');
    // ==============

    @Output() confirmarPago = new EventEmitter<any>();
    @Output() cancelar = new EventEmitter<void>();

    private verifoneService = inject(VerifoneService);
    private syncService = inject(SyncService);
    procesandoTarjeta: boolean = false;
    isOffline: boolean = false;

    metodoPago: MetodoPago = 'efectivo';
    montoEfectivo: number | null = null;
    montoTarjeta: number = 0;
    montoTransferencia: number = 0;
    bancoDestino: string = '';
    referenciaTransferencia: string = '';
    cambio: number = 0;
    bancosRD = BANCOS_RD;

    // === CRIPTO ===
    private cryptoService = inject(CryptoService);
    cryptoMoneda: CryptoMoneda = 'USDT_TRC20';
    cryptoTasaDOP: number = 0;
    cryptoMonto: number = 0;
    cryptoHash: string = '';
    cryptoQrUrl: string = '';
    cryptoConfig: CryptoConfig = { wallet_usdt_trc20: null, wallet_btc: null, wallet_solana: null };
    cargandoCrypto: boolean = false;
    cryptoConfirmado: boolean = false;
    // ==============

    // === DESCUENTO GLOBAL ===
    descuentoValor: number = 0;
    tipodescuento: 'porcentaje' | 'fijo' = 'fijo';

    get descuentoCalculado(): number {
        if (this.tipodescuento === 'porcentaje') {
            const pct = Math.min(this.descuentoValor || 0, 100);
            return (this.total * pct) / 100;
        }
        return Math.min(this.descuentoValor || 0, this.total);
    }

    get totalConDescuento(): number {
        return Math.max(this.total - this.descuentoCalculado, 0);
    }
    // ========================

    metodosPago = METODOS_PAGO.map(m => ({
        valor: m.valor as MetodoPago,
        etiqueta: m.etiqueta,
        icono: m.icono
    }));

    async ngOnInit() {
        this.cambiarMetodoPago('efectivo');
        this.syncService.isOnline$.subscribe(online => {
            this.isOffline = !online;
            if (this.isOffline && this.configFiscal?.modo_fiscal && this.tipoComprobante !== 'B02') {
                this.tipoComprobante = 'B02';
                this.tipoComprobanteChange.emit('B02');
            }
        });
        // Pre-load crypto wallet config for instant display
        this.cryptoConfig = await this.cryptoService.getCryptoConfig();
    }

    ngOnChanges(changes: SimpleChanges) {
        // Si cambia el cliente y tiene RNC, auto-switch a B01 (solo online)
        if (changes['clienteSeleccionado'] && this.configFiscal?.modo_fiscal) {
            const rnc = (this.clienteSeleccionado as any)?.rnc;
            if (rnc && !this.isOffline) {
                this.tipoComprobante = 'B01';
                this.rncCliente = rnc;
                this.tipoComprobanteChange.emit(this.tipoComprobante);
                this.rncClienteChange.emit(this.rncCliente);
            } else {
                this.tipoComprobante = 'B02';
                this.tipoComprobanteChange.emit(this.tipoComprobante);
            }
        }
    }

    cambiarMetodoPago(metodo: MetodoPago) {
        this.metodoPago = metodo;
        this.montoEfectivo = null;
        this.montoTarjeta = 0;
        this.montoTransferencia = 0;
        this.bancoDestino = '';
        this.referenciaTransferencia = '';
        this.cambio = -this.totalConDescuento;
        this.cryptoConfirmado = false;
        this.cryptoHash = '';

        if (metodo === 'tarjeta') {
            this.montoTarjeta = this.totalConDescuento;
            this.cambio = 0;
        } else if (metodo === 'transferencia') {
            this.montoTransferencia = this.totalConDescuento;
            this.cambio = 0;
        } else if (metodo === 'crypto') {
            this.cargarTasaCrypto();
        }
    }

    async cargarTasaCrypto() {
        this.cargandoCrypto = true;
        this.cryptoMonto = 0;
        this.cryptoQrUrl = '';
        try {
            if (this.cryptoMoneda === 'USDT_TRC20') {
                this.cryptoTasaDOP = await this.cryptoService.getTasaUSDT_DOP();
            } else if (this.cryptoMoneda === 'BTC') {
                this.cryptoTasaDOP = await this.cryptoService.getTasaBTC_DOP();
            } else {
                this.cryptoTasaDOP = await this.cryptoService.getTasaSOL_DOP();
            }
            this.calcularMontoCrypto();
        } finally {
            this.cargandoCrypto = false;
        }
    }

    calcularMontoCrypto() {
        if (!this.cryptoTasaDOP) return;
        this.cryptoMonto = parseFloat(
            (this.totalConDescuento / this.cryptoTasaDOP).toFixed(
                this.cryptoService.decimalPlacesFor(this.cryptoMoneda)
            )
        );
        const wallet = this.walletActiva;
        if (wallet) {
            this.cryptoQrUrl = this.cryptoService.buildQrUrl(wallet, this.cryptoMonto, this.cryptoMoneda);
        }
    }

    async cambiarMonedaCrypto(moneda: CryptoMoneda) {
        this.cryptoMoneda = moneda;
        this.cryptoConfirmado = false;
        await this.cargarTasaCrypto();
    }

    get walletActiva(): string | null {
        if (this.cryptoMoneda === 'USDT_TRC20') return this.cryptoConfig.wallet_usdt_trc20;
        if (this.cryptoMoneda === 'BTC') return this.cryptoConfig.wallet_btc;
        return this.cryptoConfig.wallet_solana;
    }

    get cryptoSymbol(): string {
        return this.cryptoService.symbolFor(this.cryptoMoneda);
    }

    copiarWallet() {
        if (this.walletActiva) {
            navigator.clipboard.writeText(this.walletActiva).then(() =>
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Dirección copiada', timer: 1500, showConfirmButton: false })
            );
        }
    }

    calcularCambio() {
        const efectivo = this.montoEfectivo || 0;
        if (this.metodoPago === 'efectivo') {
            this.cambio = efectivo - this.totalConDescuento;
        } else if (this.metodoPago === 'mixto') {
            this.calcularMixto();
        }
    }

    calcularMixto() {
        const efectivo = this.montoEfectivo || 0;
        const totalPagado = efectivo + this.montoTarjeta + this.montoTransferencia;
        this.cambio = totalPagado - this.totalConDescuento;
    }

    formatearMoneda(valor: number): string {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP'
        }).format(valor);
    }

    // Validar si el pago mixto requiere banco
    necesitaBanco(): boolean {
        return (this.metodoPago === 'transferencia') ||
            (this.metodoPago === 'mixto' && this.montoTransferencia > 0);
    }

    // Calcular total pagado para mixto
    get totalPagadoMixto(): number {
        return (this.montoEfectivo || 0) + this.montoTarjeta + this.montoTransferencia;
    }

    // Puede confirmar?
    get puedeConfirmar(): boolean {
        if (this.metodoPago === 'credito' && !this.clienteSeleccionado) return false;
        if (this.metodoPago === 'efectivo' && (this.montoEfectivo || 0) < this.totalConDescuento) return false;
        if (this.metodoPago === 'mixto' && this.totalPagadoMixto < this.totalConDescuento) return false;
        if (this.necesitaBanco() && !this.bancoDestino) return false;
        if (this.metodoPago === 'crypto' && !this.cryptoConfirmado) return false;
        if (this.metodoPago === 'crypto' && !this.walletActiva) return false;
        return true;
    }

    async onConfirmar() {
        // Si hay un monto que cobrar por tarjeta, simular el pase por el Verifone
        if (this.metodoPago === 'tarjeta' || (this.metodoPago === 'mixto' && this.montoTarjeta > 0)) {
            this.procesandoTarjeta = true;
            try {
                const montoACobrar = this.metodoPago === 'tarjeta' ? this.total : this.montoTarjeta;
                const res = await this.verifoneService.procesarPago(montoACobrar);

                if (!res.aprobado) {
                    Swal.fire('Pago Declinado', res.mensaje || 'Transacción rechazada', 'error');
                    this.procesandoTarjeta = false;
                    return;
                }
            } catch (err) {
                Swal.fire('Error', 'No se pudo comunicar con la terminal Verifone.', 'error');
                this.procesandoTarjeta = false;
                return;
            }
            this.procesandoTarjeta = false;
        }

        this.confirmarPago.emit({
            metodoPago: this.metodoPago,
            montoEfectivo: this.montoEfectivo || 0,
            montoTarjeta: this.montoTarjeta,
            montoTransferencia: this.montoTransferencia,
            bancoDestino: this.bancoDestino || null,
            referenciaTransferencia: this.referenciaTransferencia || null,
            cambio: this.cambio,
            descuento: this.descuentoCalculado,
            // Cripto
            crypto_moneda: this.metodoPago === 'crypto' ? this.cryptoMoneda : null,
            crypto_monto: this.metodoPago === 'crypto' ? this.cryptoMonto : null,
            crypto_tasa_dop: this.metodoPago === 'crypto' ? this.cryptoTasaDOP : null,
            crypto_hash: this.cryptoHash || null,
            // Fiscal
            tipoComprobante: this.configFiscal?.modo_fiscal ? this.tipoComprobante : undefined,
            rncCliente: this.configFiscal?.modo_fiscal ? this.rncCliente : undefined
        });
    }
}
