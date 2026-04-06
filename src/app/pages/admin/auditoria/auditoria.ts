import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditoriaService, AuditoriaTraza } from '../../../services/auditoria.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, UpperCasePipe],
  templateUrl: './auditoria.html',
  styleUrls: []
})
export class AuditoriaComponent implements OnInit {
  trazas: AuditoriaTraza[] = [];
  cargando: boolean = true;
  terminoBusqueda: string = '';

  constructor(private auditoriaService: AuditoriaService) {}

  ngOnInit(): void {
    this.cargarTrazas();
  }

  async cargarTrazas(): Promise<void> {
    this.cargando = true;
    try {
      this.trazas = await this.auditoriaService.obtenerTrazas(200);
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudieron cargar las trazas de auditoría', 'error');
    } finally {
      this.cargando = false;
    }
  }

  getTrazasFiltradas(): AuditoriaTraza[] {
    if (!this.terminoBusqueda) return this.trazas;
    const termino = this.terminoBusqueda.toLowerCase();
    return this.trazas.filter(t => 
      t.usuario_nombre.toLowerCase().includes(termino) ||
      t.accion_tipo.toLowerCase().includes(termino) ||
      (t.descripcion && t.descripcion.toLowerCase().includes(termino))
    );
  }

  getBadgeClass(tipo: string): string {
    if (tipo.includes('ELIMINADO') || tipo.includes('ANULADA')) return 'bg-danger-subtle text-danger border border-danger-subtle';
    if (tipo.includes('ACTUALIZADO') || tipo.includes('EDITADO')) return 'bg-warning-subtle text-warning border border-warning-subtle';
    return 'bg-primary-subtle text-primary border border-primary-subtle';
  }

  getIconClass(tipo: string): string {
    if (tipo.includes('ELIMINADO') || tipo.includes('ANULADA')) return 'fa-trash';
    if (tipo.includes('ACTUALIZADO') || tipo.includes('EDITADO')) return 'fa-pen';
    return 'fa-shield';
  }

  formatearAccion(tipo: string): string {
    return tipo.replace(/_/g, ' ');
  }

  verDetalles(traza: AuditoriaTraza): void {
    if (!traza.detalles) return;
    Swal.fire({
      title: '<strong>Detalles de Auditoría</strong>',
      html: `<pre class="text-start bg-light p-3 rounded mt-3" style="font-size: 0.85rem;"><code>${JSON.stringify(traza.detalles, null, 2)}</code></pre>`,
      icon: 'info',
      confirmButtonText: 'Cerrar',
      width: '600px'
    });
  }
}
