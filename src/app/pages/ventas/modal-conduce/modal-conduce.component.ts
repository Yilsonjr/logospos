import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConduceService } from '../../../services/conduce.service';
import { ConduceCompleto, ESTADOS_CONDUCE } from '../../../models/conduce.model';
import { VentaCompleta } from '../../../models/ventas.model';
import { ClientesService } from '../../../services/clientes.service';
import { TenantService } from '../../../services/tenant.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-modal-conduce',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './modal-conduce.component.html',
    styleUrl: './modal-conduce.component.css'
})
export class ModalConduceComponent implements OnInit {
    @Input() venta!: VentaCompleta;
    @Output() close = new EventEmitter<void>();
    @Output() conduceGuardado = new EventEmitter<ConduceCompleto>();

    // Formulario
    motorista = '';
    vehiculo = '';
    direccionEntrega = '';
    notas = '';

    // Estado
    isLoading = false;
    isSaving = false;
    conduceGenerado?: ConduceCompleto;
    estadosConduce = ESTADOS_CONDUCE;

    constructor(
        private conduceService: ConduceService,
        private clientesService: ClientesService,
        private tenantService: TenantService,
        private cdr: ChangeDetectorRef
    ) { }

    async ngOnInit() {
        this.isLoading = true;
        this.cdr.detectChanges();

        try {
            // Pre-llenar dirección del cliente si existe
            if (this.venta.cliente_id) {
                const clientes = this.clientesService.clientesSnapshot;
                const cliente = clientes.find(c => c.id === this.venta.cliente_id);
                if (cliente?.direccion) {
                    this.direccionEntrega = cliente.direccion;
                }
            }

            // Verificar si ya existe un conduce para esta venta
            const existente = await this.conduceService.obtenerConducePorVenta(this.venta.id!);
            if (existente) {
                this.conduceGenerado = this.buildConduceCompleto(existente);
                this.motorista = existente.motorista || '';
                this.vehiculo = existente.vehiculo || '';
                this.direccionEntrega = existente.direccion_entrega || '';
                this.notas = existente.notas || '';
            }
        } catch (err) {
            console.error('Error al inicializar conduce:', err);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    async guardarYGenerar() {
        if (!this.motorista.trim()) {
            Swal.fire({
                title: 'Falta información',
                text: 'Por favor indica quién lleva el pedido (Motorista/Entregador).',
                icon: 'warning',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        this.isSaving = true;
        this.cdr.detectChanges();

        try {
            const conduce = await this.conduceService.crearConduce(this.venta, {
                motorista: this.motorista,
                vehiculo: this.vehiculo || undefined,
                direccion_entrega: this.direccionEntrega || undefined,
                notas: this.notas || undefined
            });

            this.conduceGenerado = this.buildConduceCompleto(conduce);
            this.conduceGuardado.emit(this.conduceGenerado);

            Swal.fire({
                title: '✅ Conduce generado',
                text: `Conduce ${conduce.numero_conduce} creado exitosamente.`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (err: any) {
            console.error('Error al guardar conduce:', err);
            Swal.fire({
                title: '❌ Error',
                text: err.message || 'No se pudo generar el conduce.',
                icon: 'error',
                confirmButtonColor: '#3b82f6'
            });
        } finally {
            this.isSaving = false;
            this.cdr.detectChanges();
        }
    }

    imprimir() {
        if (!this.conduceGenerado) return;
        // El template de impresión usa 'Logos POS' como fallback si no hay datos del negocio
        this.conduceService.imprimirConduce(this.conduceGenerado, null);
    }

    async cambiarEstado(estado: string) {
        if (!this.conduceGenerado?.id) return;
        try {
            await this.conduceService.actualizarEstado(this.conduceGenerado.id, estado);
            this.conduceGenerado = { ...this.conduceGenerado, estado: estado as any };
            this.cdr.detectChanges();
        } catch (err) {
            console.error('Error al cambiar estado:', err);
        }
    }

    // Construye el ConduceCompleto con los detalles de la venta
    private buildConduceCompleto(conduce: any): ConduceCompleto {
        const clientes = this.clientesService.clientesSnapshot;
        const cliente = clientes.find(c => c.id === this.venta.cliente_id);

        return {
            ...conduce,
            numero_venta: this.venta.numero_venta,
            cliente_nombre: this.venta.cliente_nombre || cliente?.nombre || 'Cliente General',
            cliente_rnc: cliente?.rnc || undefined,
            cliente_telefono: cliente?.telefono || undefined,
            items: (this.venta.detalles || []).map(d => ({
                producto_nombre: d.producto_nombre,
                cantidad: d.cantidad,
                precio_unitario: d.precio_unitario,
                subtotal: d.subtotal,
                unidad: 'Und.'
            }))
        };
    }

    get estadoActual() {
        return this.estadosConduce.find(e => e.valor === this.conduceGenerado?.estado);
    }

    cerrar() { this.close.emit(); }
}
