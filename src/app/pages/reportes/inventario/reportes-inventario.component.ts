import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductosService } from '../../../services/productos.service';
import { Productos } from '../../../models/productos.model';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-reportes-inventario',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './reportes-inventario.component.html',
    styleUrls: ['./reportes-inventario.component.css']
})
export class ReportesInventarioComponent implements OnInit, OnDestroy {
    productos: Productos[] = [];
    productosBajoStock: Productos[] = [];
    isLoading = false;
    subscription: Subscription | null = null;

    // Resumen
    totalProductos = 0;
    totalUnidades = 0;
    valorInventarioCosto = 0;
    valorInventarioVenta = 0;
    margenPotencial = 0;

    constructor(private productosService: ProductosService) { }

    ngOnInit() {
        this.isLoading = true;
        this.productosService.cargarProductos().then(() => {
            this.isLoading = false;
        });

        this.subscription = this.productosService.productos$.subscribe(productos => {
            this.productos = productos;
            this.calcularResumen();
        });
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    calcularResumen() {
        this.totalProductos = this.productos.length;
        this.totalUnidades = 0;
        this.valorInventarioCosto = 0;
        this.valorInventarioVenta = 0;
        this.productosBajoStock = [];

        this.productos.forEach(producto => {
            const stock = producto.stock || 0;
            this.totalUnidades += stock;
            this.valorInventarioCosto += stock * (producto.precio_compra || 0);
            this.valorInventarioVenta += stock * (producto.precio_venta || 0);

            if (stock <= (producto.stock_minimo || 5)) {
                this.productosBajoStock.push(producto);
            }
        });

        this.margenPotencial = this.valorInventarioVenta - this.valorInventarioCosto;
    }

    formatearMoneda(valor: number): string {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP'
        }).format(valor);
    }
}
