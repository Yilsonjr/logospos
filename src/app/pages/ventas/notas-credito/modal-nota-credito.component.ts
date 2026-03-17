import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotasCreditoService } from '../../../services/notas-credito.service';
import { VentasService } from '../../../services/ventas.service';
import { MOTIVOS_NOTA_CREDITO } from '../../../models/nota-credito.model';
import Swal from 'sweetalert2';

interface ItemDevolucion {
  producto_id?: number;
  producto_nombre: string;
  precio_unitario: number;
  cantidad_original: number;
  cantidad_devolver: number;
  seleccionado: boolean;
}

@Component({
  selector: 'app-modal-nota-credito',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-nota-credito.component.html',
  styleUrls: ['./modal-nota-credito.component.css']
})
export class ModalNotaCreditoComponent implements OnInit {
  @Input() ventaId!: number;
  @Output() cancelar = new EventEmitter<void>();
  @Output() notaCreada = new EventEmitter<void>();

  private ventasService = inject(VentasService);
  private notasCreditoService = inject(NotasCreditoService);
  private cdr = inject(ChangeDetectorRef);

  venta: any = null;
  items: ItemDevolucion[] = [];
  motivoSeleccionado = '';
  motivoPersonalizado = '';
  motivos = MOTIVOS_NOTA_CREDITO;
  isLoading = true;
  isSaving = false;

  async ngOnInit() {
    await this.cargarVenta();
  }

  async cargarVenta() {
    this.isLoading = true;
    try {
      const ventaCompleta = await this.ventasService.obtenerVentaCompleta(this.ventaId);
      this.venta = ventaCompleta;
      this.items = ((ventaCompleta as any)?.detalles || []).map((d: any) => ({
        producto_id: d.producto_id,
        producto_nombre: d.producto_nombre,
        precio_unitario: d.precio_unitario,
        cantidad_original: d.cantidad,
        cantidad_devolver: 1,
        seleccionado: false
      }));
    } catch (err: any) {
      Swal.fire('Error', 'No se pudo cargar la factura original.', 'error');
      this.cancelar.emit();
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  get itemsSeleccionados(): ItemDevolucion[] {
    return this.items.filter(i => i.seleccionado);
  }

  get totalDevolucion(): number {
    return this.itemsSeleccionados.reduce((s, i) => s + (i.precio_unitario * i.cantidad_devolver), 0);
  }

  get puedeConfirmar(): boolean {
    return this.itemsSeleccionados.length > 0 && !!this.motivoFinal;
  }

  get motivoFinal(): string {
    return this.motivoSeleccionado === 'Otro' ? this.motivoPersonalizado : this.motivoSeleccionado;
  }

  onItemToggle(item: ItemDevolucion) {
    if (item.seleccionado && item.cantidad_devolver === 0) {
      item.cantidad_devolver = 1;
    }
  }

  decrementQty(item: ItemDevolucion) {
    if (item.cantidad_devolver > 1) item.cantidad_devolver--;
  }

  incrementQty(item: ItemDevolucion) {
    if (item.cantidad_devolver < item.cantidad_original) item.cantidad_devolver++;
  }

  validarCantidad(item: ItemDevolucion) {
    if (item.cantidad_devolver < 1) item.cantidad_devolver = 1;
    if (item.cantidad_devolver > item.cantidad_original) item.cantidad_devolver = item.cantidad_original;
  }

  async confirmar() {
    const result = await Swal.fire({
      title: '¿Confirmar devolución?',
      html: `Se generará una Nota de Crédito por <strong>${this.formatMoneda(this.totalDevolucion)}</strong>.<br>El stock será restituido automáticamente.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a'
    });
    if (!result.isConfirmed) return;

    this.isSaving = true;
    try {
      await this.notasCreditoService.crearNotaCredito({
        venta_id: this.ventaId,
        motivo: this.motivoFinal,
        detalles: this.itemsSeleccionados.map(i => ({
          producto_id: i.producto_id,
          producto_nombre: i.producto_nombre,
          cantidad: i.cantidad_devolver,
          precio_unitario: i.precio_unitario,
          subtotal: i.precio_unitario * i.cantidad_devolver
        }))
      }, this.venta);

      await Swal.fire({
        title: '✅ Nota de Crédito Generada',
        html: `La devolución fue registrada correctamente.<br>El inventario fue actualizado.`,
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });

      this.notaCreada.emit();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error al generar la nota de crédito.', 'error');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  formatMoneda(v: number): string {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(v);
  }
}
