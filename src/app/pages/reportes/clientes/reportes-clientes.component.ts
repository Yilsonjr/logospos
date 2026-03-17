import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClientesService } from '../../../services/clientes.service';
import { Cliente } from '../../../models/clientes.model';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-reportes-clientes',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './reportes-clientes.component.html',
    styleUrls: ['./reportes-clientes.component.css']
})
export class ReportesClientesComponent implements OnInit, OnDestroy {
    clientes: Cliente[] = [];
    clientesConDeuda: Cliente[] = [];
    isLoading = false;
    subscription: Subscription | null = null;

    // Resumen
    totalClientes = 0;
    totalDeuda = 0;
    clientesDeudores = 0;

    constructor(private clientesService: ClientesService) { }

    ngOnInit() {
        this.isLoading = true;
        this.cargarDatos();
    }

    async cargarDatos() {
        try {
            this.clientes = await this.clientesService.cargarTodosClientes();
            this.calcularResumen();
        } catch (error) {
            console.error('Error al cargar reporte de clientes:', error);
        } finally {
            this.isLoading = false;
        }
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    calcularResumen() {
        this.totalClientes = this.clientes.length;
        this.totalDeuda = 0;
        this.clientesConDeuda = [];

        this.clientes.forEach(cliente => {
            const deuda = cliente.balance_pendiente || 0;
            if (deuda > 0) {
                this.totalDeuda += deuda;
                this.clientesConDeuda.push(cliente);
            }
        });

        this.clientesDeudores = this.clientesConDeuda.length;
    }

    formatearMoneda(valor: number): string {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP'
        }).format(valor);
    }
}
