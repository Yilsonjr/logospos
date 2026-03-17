import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CuentasPagarService } from '../../../services/cuentas-pagar.service';
import { PlanPagos } from '../../../models/cuentas-pagar.model';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-plan-pagos',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './plan-pagos.component.html',
    styleUrls: ['./plan-pagos.component.css']
})
export class PlanPagosComponent implements OnInit {
    plan: PlanPagos[] = [];
    isLoading = true;
    diasProyeccion = 30;

    constructor(
        private cuentasPagarService: CuentasPagarService,
        private cdr: ChangeDetectorRef
    ) { }

    async ngOnInit() {
        await this.cargarPlan();
    }

    async cargarPlan() {
        this.isLoading = true;
        this.cdr.detectChanges();
        try {
            this.plan = await this.cuentasPagarService.obtenerPlanPagos(this.diasProyeccion);
        } catch (error) {
            console.error('Error al cargar plan de pagos:', error);
        } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    formatearFecha(fecha: string): string {
        return new Date(fecha).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
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

    calcularTotalProyeccion(): number {
        return this.plan.reduce((sum, p) => sum + p.monto_total, 0);
    }
}
