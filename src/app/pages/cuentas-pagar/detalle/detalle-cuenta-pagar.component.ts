import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CuentasPagarService } from '../../../services/cuentas-pagar.service';
import { CuentaPagarConPagos, PagoCuentaPagar } from '../../../models/cuentas-pagar.model';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-detalle-cuenta-pagar',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './detalle-cuenta-pagar.component.html',
    styleUrls: ['./detalle-cuenta-pagar.component.css']
})
export class DetalleCuentaPagarComponent implements OnInit {
    cuenta: CuentaPagarConPagos | null = null;
    isLoading = true;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private cuentasPagarService: CuentasPagarService,
        private cdr: ChangeDetectorRef
    ) { }

    async ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            await this.cargarDetalle(parseInt(id));
        } else {
            this.router.navigate(['/cuentas-pagar']);
        }
    }

    async cargarDetalle(id: number) {
        this.isLoading = true;
        this.cdr.detectChanges();
        try {
            const data = await this.cuentasPagarService.obtenerCuentaConPagos(id);
            if (data) {
                this.cuenta = data;
            } else {
                Swal.fire('Error', 'No se encontró la cuenta por pagar', 'error');
                this.router.navigate(['/cuentas-pagar']);
            }
        } catch (error) {
            console.error('Error al cargar detalle:', error);
            Swal.fire('Error', 'Hubo un problema al cargar los detalles', 'error');
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    async eliminarPago(pago: PagoCuentaPagar) {
        const result = await Swal.fire({
            title: '¿Eliminar pago?',
            text: `Se eliminará el pago de $${pago.monto.toLocaleString()} realizado el ${this.formatearFecha(pago.fecha_pago)}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ef4444'
        });

        if (result.isConfirmed && this.cuenta?.id) {
            try {
                await this.cuentasPagarService.eliminarPago(pago.id!, this.cuenta.id);
                Swal.fire('Eliminado', 'El pago ha sido eliminado correctamente', 'success');
                await this.cargarDetalle(this.cuenta.id);
            } catch (error) {
                console.error('Error al eliminar pago:', error);
                Swal.fire('Error', 'No se pudo eliminar el pago', 'error');
            }
        }
    }

    formatearFecha(fecha: string): string {
        return new Date(fecha).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    obtenerClaseEstado(estado: string): string {
        const base = 'badge rounded-pill px-3 py-2 border ';
        switch (estado) {
            case 'pendiente': return base + 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
            case 'parcial': return base + 'bg-info-subtle text-info-emphasis border-info-subtle';
            case 'pagada': return base + 'bg-success-subtle text-success border-success-subtle';
            case 'vencida': return base + 'bg-danger-subtle text-danger border-danger-subtle';
            default: return base + 'bg-secondary-subtle text-secondary border-secondary-subtle';
        }
    }
}
