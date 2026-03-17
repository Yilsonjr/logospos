import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { METODOS_PAGO } from '../../../models/ventas.model';
import { Cliente } from '../../../models/clientes.model';
import { ConfiguracionFiscal, TIPOS_COMPROBANTE } from '../../../models/fiscal.model';
import { VerifoneService } from '../../../services/verifone.service';
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

type MetodoPago = 'efectivo' | 'tarjeta' | 'credito' | 'transferencia' | 'mixto';

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
    procesandoTarjeta: boolean = false;

    metodoPago: MetodoPago = 'efectivo';
    montoEfectivo: number | null = null;
    montoTarjeta: number = 0;
    montoTransferencia: number = 0;
    bancoDestino: string = '';
    referenciaTransferencia: string = '';
    cambio: number = 0;
    bancosRD = BANCOS_RD;
    metodosPago = METODOS_PAGO.map(m => ({
        valor: m.valor as MetodoPago,
        etiqueta: m.etiqueta,
        icono: m.icono
    }));

    ngOnInit() {
        this.cambiarMetodoPago('efectivo');
    }

    ngOnChanges(changes: SimpleChanges) {
        // Si cambia el cliente y tiene RNC, auto-switch a B01
        if (changes['clienteSeleccionado'] && this.configFiscal?.modo_fiscal) {
            const rnc = (this.clienteSeleccionado as any)?.rnc;
            if (rnc) {
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
        this.cambio = -this.total;

        if (metodo === 'tarjeta') {
            this.montoTarjeta = this.total;
            this.cambio = 0;
        } else if (metodo === 'transferencia') {
            this.montoTransferencia = this.total;
            this.cambio = 0;
        }
    }

    calcularCambio() {
        const efectivo = this.montoEfectivo || 0;
        if (this.metodoPago === 'efectivo') {
            this.cambio = efectivo - this.total;
        } else if (this.metodoPago === 'mixto') {
            this.calcularMixto();
        }
    }

    calcularMixto() {
        const efectivo = this.montoEfectivo || 0;
        const totalPagado = efectivo + this.montoTarjeta + this.montoTransferencia;
        this.cambio = totalPagado - this.total;
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
        if (this.metodoPago === 'efectivo' && (this.montoEfectivo || 0) < this.total) return false;
        if (this.metodoPago === 'mixto' && this.totalPagadoMixto < this.total) return false;
        if (this.necesitaBanco() && !this.bancoDestino) return false;
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
            // Fiscal
            tipoComprobante: this.configFiscal?.modo_fiscal ? this.tipoComprobante : undefined,
            rncCliente: this.configFiscal?.modo_fiscal ? this.rncCliente : undefined
        });
    }
}
