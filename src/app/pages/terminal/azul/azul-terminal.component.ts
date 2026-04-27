import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AzulService, AzulResponse } from '../../../services/azul.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-azul-terminal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="azul-container">
            <div class="azul-header">
                <div class="title-group">
                    <h1><i class="fa-solid fa-credit-card"></i> Terminal AZUL</h1>
                    <p>Gestión de transacciones y reimpresión de comprobantes</p>
                </div>
                <div class="header-actions">
                    <button class="btn-config" (click)="abrirConfig()">
                        <i class="fa-solid fa-gear"></i> Configurar
                    </button>
                    <button class="btn-refresh" (click)="cargarHistorial()">
                        <i class="fa-solid fa-sync" [class.fa-spin]="cargando"></i> Actualizar
                    </button>
                </div>
            </div>

            <div class="azul-stats" *ngIf="transacciones.length > 0">
                <div class="stat-card">
                    <span class="stat-label">Ventas Hoy</span>
                    <span class="stat-value">{{ totalVentasHoy | currency:'DOP':'symbol':'1.2-2' }}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Transacciones</span>
                    <span class="stat-value">{{ transacciones.length }}</span>
                </div>
            </div>

            <div class="azul-content">
                <div class="history-card">
                    <div class="card-header">
                        <h3>Últimas Transacciones</h3>
                        <div class="search-box">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="text" [(ngModel)]="filtro" placeholder="Buscar por factura o tarjeta...">
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="azul-table">
                            <thead>
                                <tr>
                                    <th>Fecha/Hora</th>
                                    <th>Factura</th>
                                    <th>Tarjeta</th>
                                    <th>Autorización</th>
                                    <th>Referencia</th>
                                    <th class="num">Monto</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr *ngFor="let t of transaccionesFiltradas">
                                    <td>{{ t.DateTime | date:'dd/MM/yyyy HH:mm' }}</td>
                                    <td><strong>{{ t.InvoiceNumber }}</strong></td>
                                    <td>{{ t.CardType }} ({{ t.CardNumber }})</td>
                                    <td><span class="code-badge">{{ t.AuthorizationCode }}</span></td>
                                    <td>{{ t.ReceiptNumber }}</td>
                                    <td class="num fw-bold">{{ t.Amount | currency:'DOP' }}</td>
                                    <td>
                                        <span class="status-badge" [class.success]="t.Success" [class.error]="!t.Success">
                                            {{ t.Message }}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn-print-sm" (click)="reimprimir(t.ReceiptNumber || '')" title="Reimprimir Comprobante">
                                            <i class="fa-solid fa-print"></i>
                                        </button>
                                    </td>
                                </tr>
                                <tr *ngIf="transacciones.length === 0 && !cargando">
                                    <td colspan="8" class="text-center py-5 text-muted">
                                        <i class="fa-solid fa-inbox fa-3x mb-3 d-block"></i>
                                        No se encontraron transacciones en el terminal
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal de Configuración -->
        <div class="modal-overlay" *ngIf="mostrandoConfig">
            <div class="config-modal animate__animated animate__zoomIn">
                <div class="modal-header">
                    <h3><i class="fa-solid fa-gear"></i> Configuración de Terminal</h3>
                    <button class="btn-close" (click)="mostrandoConfig = false">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>URL del Agente/Bridge</label>
                        <input type="text" [(ngModel)]="configTemp.terminalUrl" placeholder="http://localhost:8080/azul">
                        <small>Dirección donde está instalado el agente local de AZUL.</small>
                    </div>
                    <div class="form-group">
                        <label>Merchant ID (MID)</label>
                        <input type="text" [(ngModel)]="configTemp.merchantId" placeholder="Ej: 390XXXX">
                    </div>
                    <div class="form-group">
                        <label>Terminal ID (TID)</label>
                        <input type="text" [(ngModel)]="configTemp.terminalId" placeholder="Ej: 80XXXX">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" (click)="mostrandoConfig = false">Cancelar</button>
                    <button class="btn-save" (click)="guardarConfig()">Guardar Cambios</button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .azul-container { padding: 24px; max-width: 1200px; margin: 0 auto; }
        .azul-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .title-group h1 { font-size: 1.8rem; font-weight: 700; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 12px; }
        .title-group h1 i { color: #2563eb; }
        .title-group p { color: #64748b; margin: 4px 0 0; }

        .azul-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #fff; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
        .stat-label { display: block; color: #64748b; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; }
        .stat-value { display: block; color: #1e293b; font-size: 1.5rem; font-weight: 700; }

        .history-card { background: #fff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden; }
        .card-header { padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
        .card-header h3 { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1e293b; }

        .search-box { position: relative; min-width: 300px; }
        .search-box i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .search-box input { width: 100%; padding: 8px 12px 8px 36px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; outline: none; transition: border 0.2s; }
        .search-box input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }

        .azul-table { width: 100%; border-collapse: collapse; }
        .azul-table th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
        .azul-table td { padding: 16px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; color: #334155; }
        .azul-table tr:hover { background: #f8fafc; }
        .num { text-align: right; }

        .code-badge { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-weight: 600; color: #475569; }
        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .status-badge.success { background: #dcfce7; color: #166534; }
        .status-badge.error { background: #fee2e2; color: #991b1b; }

        .btn-refresh { background: #fff; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #475569; transition: all 0.2s; }
        .btn-refresh:hover { background: #f8fafc; border-color: #94a3b8; }

        .btn-config { background: #fff; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #475569; transition: all 0.2s; margin-right: 8px; }
        .btn-config:hover { background: #f1f5f9; border-color: #2563eb; color: #2563eb; }

        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
        .config-modal { background: #fff; border-radius: 16px; width: 100%; max-width: 450px; shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .modal-header { padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { margin: 0; font-size: 1.1rem; }
        .btn-close { background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer; }
        
        .modal-body { padding: 24px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 8px; }
        .form-group input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; }
        .form-group small { display: block; color: #94a3b8; font-size: 0.75rem; margin-top: 4px; }

        .modal-footer { padding: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; }
        .btn-cancel { padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
        .btn-save { padding: 8px 16px; border-radius: 8px; border: none; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }

        .btn-print-sm { background: #f1f5f9; border: none; color: #475569; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .btn-print-sm:hover { background: #2563eb; color: #fff; transform: translateY(-1px); }

        @media (max-width: 768px) {
            .azul-header { flex-direction: column; align-items: flex-start; gap: 16px; }
            .search-box { min-width: 100%; }
        }
    `]
})
export class AzulTerminalComponent implements OnInit {
    private azulService = inject(AzulService);
    transacciones: AzulResponse[] = [];
    filtro: string = '';
    cargando: boolean = false;

    // Configuración
    mostrandoConfig: boolean = false;
    configTemp: any = {};

    ngOnInit() {
        this.cargarHistorial();
    }

    abrirConfig() {
        this.configTemp = this.azulService.getConfig();
        this.mostrandoConfig = true;
    }

    guardarConfig() {
        this.azulService.guardarConfig(this.configTemp);
        this.mostrandoConfig = false;
        Swal.fire({
            icon: 'success',
            title: 'Configuración Guardada',
            text: 'Los cambios se han guardado localmente.',
            timer: 2000,
            showConfirmButton: false
        });
        this.cargarHistorial();
    }

    async cargarHistorial() {
        this.cargando = true;
        try {
            this.transacciones = await this.azulService.obtenerTransacciones();
        } finally {
            this.cargando = false;
        }
    }

    get transaccionesFiltradas() {
        if (!this.filtro) return this.transacciones;
        const q = this.filtro.toLowerCase();
        return this.transacciones.filter(t => 
            t.InvoiceNumber?.toLowerCase().includes(q) || 
            t.CardNumber?.includes(q) ||
            t.AuthorizationCode?.toLowerCase().includes(q)
        );
    }

    get totalVentasHoy() {
        return this.transacciones
            .filter(t => t.Success)
            .reduce((sum, t) => sum + (t.Amount || 0), 0);
    }

    async reimprimir(referencia: string) {
        if (!referencia) {
            Swal.fire('Sin referencia', 'Esta transacción no tiene número de referencia para reimprimir.', 'warning');
            return;
        }
        const result = await Swal.fire({
            title: '¿Reimprimir comprobante?',
            text: `Se enviará la orden de reimpresión para la referencia ${referencia}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, imprimir',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2563eb'
        });

        if (result.isConfirmed) {
            Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const success = await this.azulService.reimprimir(referencia);
            Swal.close();

            if (success) {
                Swal.fire({ icon: 'success', title: 'Impresión enviada', timer: 1500, showConfirmButton: false });
            } else {
                Swal.fire('Error', 'No se pudo enviar la orden de impresión al terminal.', 'error');
            }
        }
    }
}
