import { Component, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SucursalService } from '../../../../services/sucursal.service';
import { ProductosService } from '../../../../services/productos.service';
import { StockTransferService } from '../../../../services/stock-transfer.service';
import { AuthService } from '../../../../services/auth.service';
import { Sucursal } from '../../../../models/sucursal.model';
import { Productos } from '../../../../models/productos.model';
import Swal from 'sweetalert2';

interface ItemTransferencia {
  producto: Productos;
  cantidad: number;
}

@Component({
  selector: 'app-nueva-transferencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nueva-transferencia.component.html',
  styleUrls: ['./nueva-transferencia.component.css']
})
export class NuevaTransferenciaComponent implements OnInit {
  private sucursalService = inject(SucursalService);
  private productosService = inject(ProductosService);
  private transferService = inject(StockTransferService);
  private authService = inject(AuthService);

  @Output() cancelar = new EventEmitter<void>();
  @Output() confirmada = new EventEmitter<void>();

  sucursales: Sucursal[] = [];
  productos: Productos[] = [];
  sucursalDestinoId: number | null = null;
  notas: string = '';
  
  carrito: ItemTransferencia[] = [];
  busqueda: string = '';
  guardando = false;

  async ngOnInit() {
    this.sucursales = await this.sucursalService.cargarSucursalesUsuario(this.authService.usuarioActual?.id || 0);
    this.sucursales = this.sucursales.filter(s => s.id !== this.sucursalService.sucursalActiva?.id);
    
    // El servico de productos ya carga los productos de la sucursal activa
    this.productosService.productos$.subscribe(prods => {
      this.productos = prods;
    });
  }

  get productosFiltrados() {
    if (!this.busqueda) return this.productos;
    const b = this.busqueda.toLowerCase();
    return this.productos.filter(p => 
      p.nombre.toLowerCase().includes(b) || 
      (p.codigo_barras && p.codigo_barras.includes(b))
    );
  }

  agregarProducto(p: Productos) {
    const existe = this.carrito.find(i => i.producto.id === p.id);
    if (existe) {
      if (existe.cantidad < (p.stock || 0)) {
        existe.cantidad++;
      } else {
        Swal.fire('Stock Insuficiente', 'No puedes transferir más de lo que tienes en stock', 'warning');
      }
    } else {
      if ((p.stock || 0) > 0) {
        this.carrito.push({ producto: p, cantidad: 1 });
      } else {
        Swal.fire('Sin Stock', 'Este producto no tiene existencias en esta sucursal', 'warning');
      }
    }
  }

  eliminarDelCarrito(index: number) {
    this.carrito.splice(index, 1);
  }

  async confirmar() {
    if (!this.sucursalDestinoId) {
      Swal.fire('Error', 'Selecciona una sucursal destino', 'error');
      return;
    }
    if (this.carrito.length === 0) {
      Swal.fire('Error', 'Agrega al menos un producto', 'error');
      return;
    }

    this.guardando = true;
    try {
      const transferencia = {
        sucursal_origen_id: this.sucursalService.sucursalActiva?.id,
        sucursal_destino_id: this.sucursalDestinoId,
        usuario_id: this.authService.usuarioActual?.id,
        notas: this.notas
      };

      const detalles = this.carrito.map(i => ({
        producto_id: i.producto.id!,
        cantidad: i.cantidad
      }));

      await this.transferService.crearTransferencia(transferencia, detalles);
      
      // Actualizar productos locales ya que descontamos stock
      await this.productosService.cargarProductos();

      Swal.fire('Éxito', 'Transferencia enviada correctamente', 'success');
      this.confirmada.emit();
    } catch (e: any) {
      console.error(e);
      Swal.fire('Error', 'No se pudo crear la transferencia', 'error');
    } finally {
      this.guardando = false;
    }
  }
}
