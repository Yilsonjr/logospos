import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductosService } from '../../../services/productos.service';
import { Productos } from '../../../models/productos.model';
import { Subscription } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

    exportarPDF() {
        if (this.productos.length === 0) return;

        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text('Reporte de Inventario', 14, 20);
        doc.setFontSize(10);
        doc.text(`Fecha de generación: ${new Date().toLocaleString()}`, 14, 28);

        // Resumen
        doc.setFontSize(12);
        doc.text('Resumen de Inventario', 14, 40);
        doc.setFontSize(10);
        doc.text(`Total Productos: ${this.totalProductos}`, 14, 47);
        doc.text(`Unidades Totales: ${this.totalUnidades}`, 14, 53);
        doc.text(`Valor Inventario (Venta): ${this.formatearMoneda(this.valorInventarioVenta)}`, 14, 59);
        doc.text(`Margen Potencial: ${this.formatearMoneda(this.margenPotencial)}`, 14, 65);

        // Tabla
        const head = [['Código', 'Producto', 'Categoría', 'Costo', 'Precio', 'Stock', 'Valor Total']];
        const data = this.productos.map(p => [
            p.codigo_barras || p.sku || 'N/A',
            p.nombre,
            p.categoria || 'Sin Cat',
            this.formatearMoneda(p.precio_compra || 0),
            this.formatearMoneda(p.precio_venta || 0),
            p.stock || 0,
            this.formatearMoneda((p.stock || 0) * (p.precio_venta || 0))
        ]);

        autoTable(doc, {
            head: head,
            body: data,
            startY: 75,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 8 }
        });

        doc.save(`reporte_inventario_${new Date().toISOString().split('T')[0]}.pdf`);
    }
}
