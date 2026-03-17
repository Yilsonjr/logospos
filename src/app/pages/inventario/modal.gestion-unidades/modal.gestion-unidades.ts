import { Component, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalUnidadesComponent } from '../modal.unidades/modal.unidades';
import { UnidadesService } from '../../../services/unidades.service';
import { Unidad } from '../../../models/unidades.model';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-modal-gestion-unidades',
    imports: [CommonModule, ModalUnidadesComponent],
    templateUrl: './modal.gestion-unidades.html',
    styleUrl: './modal.gestion-unidades.css'
})
export class ModalGestionUnidadesComponent implements OnInit, OnDestroy {
    @Output() close = new EventEmitter<void>();

    todasUnidades: Unidad[] = [];
    unidadesFiltradas: Unidad[] = [];
    isModalUnidadOpen = false;
    unidadEditando?: Unidad;
    filtroActivo: 'todas' | 'activas' | 'inactivas' = 'todas';
    private unidadesSubscription?: Subscription;

    constructor(
        private unidadesService: UnidadesService,
        private cdr: ChangeDetectorRef
    ) { }

    async ngOnInit() {
        // Suscribirse primero: cada vez que el servicio emita nuevos datos,
        // actualizamos la vista local sin volver a llamar cargarUnidades().
        // Esto evita el bucle infinito (subscribe → cargarUnidades → next → subscribe → …)
        this.unidadesSubscription = this.unidadesService.unidades$.subscribe(
            (data: Unidad[]) => {
                this.todasUnidades = data;
                this.aplicarFiltro();
                this.cdr.detectChanges();
            }
        );

        // Solo disparamos UNA carga inicial. El BehaviorSubject emitirá y
        // la suscripción de arriba actualizará la UI automáticamente.
        await this.unidadesService.cargarUnidades();
    }

    ngOnDestroy() {
        if (this.unidadesSubscription) {
            this.unidadesSubscription.unsubscribe();
        }
    }

    aplicarFiltro() {
        switch (this.filtroActivo) {
            case 'activas':
                this.unidadesFiltradas = this.todasUnidades.filter(c => c.activo);
                break;
            case 'inactivas':
                this.unidadesFiltradas = this.todasUnidades.filter(c => !c.activo);
                break;
            default:
                this.unidadesFiltradas = [...this.todasUnidades];
        }
        this.cdr.detectChanges();
    }

    cambiarFiltro(filtro: 'todas' | 'activas' | 'inactivas') {
        this.filtroActivo = filtro;
        this.aplicarFiltro();
    }

    get totalActivas(): number { return this.todasUnidades.filter(c => c.activo).length; }
    get totalInactivas(): number { return this.todasUnidades.filter(c => !c.activo).length; }

    cerrarModal() { this.close.emit(); }

    abrirModalUnidad() {
        this.unidadEditando = undefined;
        this.isModalUnidadOpen = true;
    }

    editarUnidad(unidad: Unidad) {
        this.unidadEditando = unidad;
        this.isModalUnidadOpen = true;
    }

    cerrarModalUnidad() {
        this.isModalUnidadOpen = false;
        this.unidadEditando = undefined;
    }

    async eliminarUnidad(unidad: Unidad) {
        try {
            const result = await Swal.fire({
                title: '🗑️ ¿Eliminar unidad de medida?',
                html: `
          <p>La unidad de medida <strong>"${unidad.nombre}"</strong> será eliminada de tu catálogo.</p>
          <p class="text-sm text-gray-600 mt-2">¿Deseas eliminarla permanentemente o solo desactivarla para que no salga en la lista desplegable?</p>
        `,
                icon: 'question',
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                denyButtonColor: '#f59e0b',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Eliminar permanentemente',
                denyButtonText: 'Solo desactivar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await this.unidadesService.eliminarUnidad(unidad.id!);
                Swal.fire({
                    title: '✅ Eliminada',
                    text: `La unidad "${unidad.nombre}" ha sido eliminada.`,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else if (result.isDenied) {
                await this.unidadesService.cambiarEstadoUnidad(unidad.id!, false);
                Swal.fire({
                    title: '✅ Desactivada',
                    text: `La unidad "${unidad.nombre}" ha sido desactivada.`,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } catch (error: any) {
            console.error('❌ Error al eliminar unidad:', error);
            Swal.fire({
                title: '❌ Error',
                text: error.message || 'Ocurrió un error al procesar la unidad.',
                icon: 'error',
                confirmButtonColor: '#3b82f6'
            });
        }
    }

    async onUnidadGuardada(unidad: Unidad) {
        console.log('✅ Unidad guardada:', unidad.nombre);
        // La suscripción del ngOnInit ya actualizará la lista automáticamente
        // vía el BehaviorSubject. Solo cerramos el modal.
        this.cerrarModalUnidad();
    }
}
