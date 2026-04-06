import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockTransferService } from '../../../services/stock-transfer.service';
import { SucursalService } from '../../../services/sucursal.service';
import { AuthService } from '../../../services/auth.service';
import { NuevaTransferenciaComponent } from './nueva-transferencia/nueva-transferencia.component';
import { TransferenciaStock, DetalleTransferenciaStock } from '../../../models/stock-transfer.model';
import { Sucursal } from '../../../models/sucursal.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-transferencias-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, NuevaTransferenciaComponent],
  templateUrl: './transferencias-stock.component.html',
  styleUrls: ['./transferencias-stock.component.css']
})
export class TransferenciasStockComponent implements OnInit {
  private transferService = inject(StockTransferService);
  private sucursalService = inject(SucursalService);
  private authService = inject(AuthService);

  transferencias: TransferenciaStock[] = [];
  cargando = false;
  
  // Detalle
  mostrarDetalle = false;
  transferenciaSeleccionada: TransferenciaStock | null = null;
  detallesSeleccionados: DetalleTransferenciaStock[] = [];
  cargandoDetalle = false;

  // Nueva Transferencia Modal
  mostrarNueva = false;

  async ngOnInit() {
    this.cargarTransferencias();
  }

  async cargarTransferencias() {
    this.cargando = true;
    try {
      this.transferencias = await this.transferService.getTransferencias();
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudieron cargar las transferencias', 'error');
    } finally {
      this.cargando = false;
    }
  }

  async verDetalle(t: TransferenciaStock) {
    this.transferenciaSeleccionada = t;
    this.mostrarDetalle = true;
    this.cargandoDetalle = true;
    try {
      this.detallesSeleccionados = await this.transferService.getDetallesTransferencia(t.id!);
    } catch (e) {
      console.error(e);
    } finally {
      this.cargandoDetalle = false;
    }
  }

  async confirmarRecepcion(t: TransferenciaStock) {
    const result = await Swal.fire({
      title: '¿Confirmar recepción?',
      text: 'Se aumentará el stock en la sucursal destino.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, recibir stock',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await this.transferService.recibirTransferencia(t.id!);
        Swal.fire('Éxito', 'Stock recibido correctamente', 'success');
        this.mostrarDetalle = false;
        this.cargarTransferencias();
      } catch (e: any) {
        Swal.fire('Error', e.message || 'Error al recibir stock', 'error');
      }
    }
  }

  async cancelarTransferencia(t: TransferenciaStock) {
    const result = await Swal.fire({
      title: '¿Cancelar transferencia?',
      text: 'El stock regresará a la sucursal de origen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonColor: '#d33'
    });

    if (result.isConfirmed) {
      try {
        await this.transferService.cancelarTransferencia(t.id!);
        Swal.fire('Cancelada', 'La transferencia ha sido cancelada', 'success');
        this.mostrarDetalle = false;
        this.cargarTransferencias();
      } catch (e: any) {
        Swal.fire('Error', e.message || 'Error al cancelar', 'error');
      }
    }
  }

  getEstadoClass(estado: string) {
    switch (estado) {
      case 'recibido': return 'bg-success';
      case 'enviado': return 'bg-primary';
      case 'cancelado': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }
}
