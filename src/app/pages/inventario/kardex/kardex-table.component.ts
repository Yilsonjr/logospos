import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KardexService } from '../../../services/kardex.service';
import { MovimientoInventario } from '../../../models/kardex.model';

@Component({
  selector: 'app-kardex-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kardex-table.component.html',
  styleUrls: ['./kardex-table.component.css']
})
export class KardexTableComponent implements OnInit {
  @Input() productoId!: number;
  @Input() sucursalId!: number;

  private kardexService = inject(KardexService);
  
  movimientos: MovimientoInventario[] = [];
  isLoading = true;

  ngOnInit() {
    if (this.productoId && this.sucursalId) {
      this.cargarKardex();
    }
  }

  async cargarKardex() {
    this.isLoading = true;
    try {
      this.movimientos = await this.kardexService.getMovimientos(this.productoId, this.sucursalId);
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading = false;
    }
  }

  getTipoBadgeClass(tipo: string) {
    switch (tipo) {
      case 'entrada':
      case 'compra':
        return 'bg-success-subtle text-success border-success';
      case 'salida':
      case 'venta':
        return 'bg-danger-subtle text-danger border-danger';
      case 'transferencia':
        return 'bg-primary-subtle text-primary border-primary';
      default:
        return 'bg-secondary-subtle text-secondary border-secondary';
    }
  }
}
