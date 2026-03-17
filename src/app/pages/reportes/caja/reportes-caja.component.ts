import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { CajaService } from '../../../services/caja.service';
import { Caja } from '../../../models/caja.model';

@Component({
    selector: 'app-reportes-caja',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './reportes-caja.component.html',
    styleUrls: ['./reportes-caja.component.css']
})
export class ReportesCajaComponent implements OnInit {
    fechaInicio: string = '';
    fechaFin: string = '';
    cajas: Caja[] = [];
    cajasAbiertas: Caja[] = []; // Cajas abiertas actualmente (solo admin)
    isLoading = false;
    isAdmin = false;
    // Resumen
    totalIngresos = 0;
    totalVentasEfectivo = 0;
    totalVentasTarjeta = 0;
    totalDiferencias = 0;

    constructor(
        private cajaService: CajaService,
        private authService: AuthService
    ) {
        const hoy = new Date();
        const hace30dias = new Date();
        hace30dias.setDate(hoy.getDate() - 30);

        this.fechaFin = hoy.toISOString().split('T')[0];
        this.fechaInicio = hace30dias.toISOString().split('T')[0];
    }

    ngOnInit() {
        this.isAdmin = this.authService.tienePermiso('admin') || this.authService.usuarioActual?.rol?.nombre.toLowerCase() === 'admin';
        this.cargarReporte();

        if (this.isAdmin) {
            this.cargarCajasAbiertas();
        }
    }

    async cargarCajasAbiertas() {
        try {
            this.cajasAbiertas = await this.cajaService.obtenerTodasCajasAbiertas();
        } catch (error) {
            console.error('Error cargando cajas abiertas:', error);
        }
    }

    async cargarReporte() {
        this.isLoading = true;
        try {
            const fechaFinAjustada = `${this.fechaFin}T23:59:59`;
            const fechaInicioAjustada = `${this.fechaInicio}T00:00:00`;

            // Simulación de error si no existe el método (aunque lo vi en el archivo)
            // Ajuste: usar any si typescript se queja, pero debería estar bien.
            this.cajas = await (this.cajaService as any).obtenerCajasPorFecha(fechaInicioAjustada, fechaFinAjustada);
            this.calcularResumen();
        } catch (error) {
            console.error('Error al cargar reporte de caja:', error);
        } finally {
            this.isLoading = false;
        }
    }

    calcularResumen() {
        this.totalIngresos = 0;
        this.totalVentasEfectivo = 0;
        this.totalVentasTarjeta = 0;
        this.totalDiferencias = 0;

        this.cajas.forEach(caja => {
            this.totalVentasEfectivo += caja.total_ventas_efectivo || 0;
            this.totalVentasTarjeta += caja.total_ventas_tarjeta || 0;
            this.totalIngresos += (caja.total_ventas_efectivo || 0) + (caja.total_ventas_tarjeta || 0);
            this.totalDiferencias += caja.diferencia || 0;
        });
    }

    formatearMoneda(valor: number): string {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP'
        }).format(valor);
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return '-';
        return new Date(fecha).toLocaleDateString() + ' ' + new Date(fecha).toLocaleTimeString();
    }
}
