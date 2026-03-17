import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FiscalService } from '../../../services/fiscal.service';
import { ConfiguracionFiscal, SecuenciaNCF, TipoComprobante, TIPOS_COMPROBANTE } from '../../../models/fiscal.model';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-configuracion-fiscal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './configuracion-fiscal.component.html',
    styleUrls: ['./configuracion-fiscal.component.css']
})
export class ConfiguracionFiscalComponent implements OnInit {
    config: ConfiguracionFiscal = {
        id: 1,
        modo_fiscal: false,
        itbis_defecto: 18.0
    };

    secuencias: SecuenciaNCF[] = [];
    tiposComprobante = TIPOS_COMPROBANTE;

    // Modal/Form State
    mostrandoFormulario = false;
    secuenciaEnEdicion: Partial<SecuenciaNCF> = {};

    constructor(
        private fiscalService: FiscalService,
        private cdr: ChangeDetectorRef
    ) { }

    async ngOnInit() {
        await this.cargarDatos();
    }

    async cargarDatos() {
        try {
            // Suscribirse a cambios en la config
            this.fiscalService.config$.subscribe(cfg => {
                if (cfg) {
                    this.config = { ...cfg };
                    this.cdr.detectChanges();
                }
            });

            // Cargar datos iniciales
            await this.fiscalService.cargarConfiguracion();
            this.secuencias = await this.fiscalService.obtenerSecuencias();
            this.cdr.detectChanges();
        } catch (error) {
            console.error('Error cargando datos fiscales:', error);
        }
    }

    async guardarConfiguracion() {
        try {
            await this.fiscalService.actualizarConfiguracion(this.config);
            await Swal.fire('Guardado', 'Configuración fiscal actualizada', 'success');
            await this.cargarDatos();
        } catch (error) {
            await Swal.fire('Error', 'No se pudo guardar la configuración', 'error');
        }
    }

    nuevaSecuencia() {
        this.secuenciaEnEdicion = {
            activo: true,
            numero_actual: 0
        };
        this.mostrandoFormulario = true;
        this.cdr.detectChanges();
    }

    editarSecuencia(secuencia: SecuenciaNCF) {
        this.secuenciaEnEdicion = { ...secuencia };
        this.mostrandoFormulario = true;
        this.cdr.detectChanges();
    }

    cancelarEdicion() {
        this.mostrandoFormulario = false;
        this.secuenciaEnEdicion = {};
        this.cdr.detectChanges();
    }

    async guardarSecuencia() {
        try {
            if (!this.secuenciaEnEdicion.tipo_ncf || !this.secuenciaEnEdicion.prefijo) {
                await Swal.fire('Error', 'Complete los campos obligatorios', 'warning');
                return;
            }

            // Asegurar que numero_actual comience en rango_inicial si es nuevo
            if (!this.secuenciaEnEdicion.id && !this.secuenciaEnEdicion.numero_actual) {
                this.secuenciaEnEdicion.numero_actual = this.secuenciaEnEdicion.rango_inicial;
            }

            await this.fiscalService.guardarSecuencia(this.secuenciaEnEdicion);

            // Cerrar modal y recargar
            this.mostrandoFormulario = false;
            this.cdr.detectChanges(); // Forzar cierre visual inmediato

            await this.cargarDatos(); // Recargar lista desde DB

            await Swal.fire('Éxito', 'Secuencia guardada correctamente', 'success');
        } catch (error) {
            console.error(error);
            await Swal.fire('Error', 'Error al guardar secuencia', 'error');
        }
    }

    getDescripcionTipo(codigo: string): string {
        return this.tiposComprobante.find(t => t.codigo === codigo)?.descripcion || codigo;
    }
}
