import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ComprasService } from '../../../services/compras.service';
import { CompraConDetalles } from '../../../models/compras.model';

@Component({
    selector: 'app-detalle-compra',
    imports: [CommonModule, RouterModule],
    templateUrl: './detalle-compra.component.html',
    styleUrl: './detalle-compra.component.css'
})
export class DetalleCompraComponent implements OnInit {
    compra?: CompraConDetalles;
    isLoading = true;

    constructor(
        private route: ActivatedRoute,
        private comprasService: ComprasService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        console.log('🔹 ID obtenido de URL:', id);
        if (id) {
            this.cargarCompra(Number(id));
        } else {
            console.warn('⚠️ No se encontró ID en la URL');
            this.isLoading = false;
        }
    }

    async cargarCompra(id: number) {
        console.log('🔹 Cargar Compra iniciado:', id);
        try {
            this.isLoading = true;
            console.log('🔹 Llamando a servicio...');
            this.compra = await this.comprasService.obtenerCompraConDetalles(id);
            console.log('✅ Compra cargada:', this.compra);
        } catch (error) {
            console.error('❌ Error al cargar detalle compra:', error);
        } finally {
            console.log('🔹 Finalizando carga, isLoading = false');
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    formatearFecha(fecha?: string): string {
        if (!fecha) return '-';
        return new Date(fecha).toLocaleDateString('es-DO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
