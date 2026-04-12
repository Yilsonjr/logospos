import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DevAdminService, Tenant, Plan, Subscripcion } from '../../services/dev-admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dev-admin-container" *ngIf="tenant">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <button class="btn-back" (click)="router.navigate(['/dev-admin/tenants'])">← Volver</button>
          <h1>{{ tenant.nombre }}</h1>
          <span class="badge" [class]="'badge-' + tenant.estado">{{ tenant.estado | uppercase }}</span>
        </div>
        <div class="header-right">
          <button class="btn-impersonate" (click)="impersonar()">🔑 Entrar como este Tenant</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-number">{{ stats.usuarios_activos }}</span>
          <span class="stat-label">Usuarios</span>
        </div>
        <div class="stat-card">
          <span class="stat-number">{{ stats.productos_activos }}</span>
          <span class="stat-label">Productos</span>
        </div>
        <div class="stat-card stat-activo">
          <span class="stat-number">{{ stats.ventas_mes | currency:'USD':'symbol':'1.2-2' }}</span>
          <span class="stat-label">Ventas este mes</span>
        </div>
        <div class="stat-card">
          <span class="stat-number">{{ stats.ventas_total | currency:'USD':'symbol':'1.2-2' }}</span>
          <span class="stat-label">Ventas total</span>
        </div>
      </div>

      <div class="detail-grid">
        <!-- Info -->
        <div class="form-section">
          <h2>📋 Información del Negocio</h2>
          <div class="form-row">
            <div class="form-group">
              <label>Nombre</label>
              <input type="text" [(ngModel)]="tenant.nombre" />
            </div>
            <div class="form-group">
              <label>RNC</label>
              <input type="text" [(ngModel)]="tenant.rnc" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="tenant.email" />
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input type="tel" [(ngModel)]="tenant.telefono" />
            </div>
          </div>
          <div class="form-group full-width">
            <label>Dirección</label>
            <input type="text" [(ngModel)]="tenant.direccion" />
          </div>
          <button class="btn-primary" (click)="guardarCambios()">💾 Guardar Cambios</button>
        </div>

        <!-- Plan & Subscription -->
        <div class="form-section">
          <h2>📦 Plan y Suscripción</h2>
          <div class="current-plan">
            <span class="plan-label">Plan actual:</span>
            <span class="plan-badge plan-badge-lg">{{ tenant.plan_nombre || tenant.plan_slug }}</span>
          </div>
          <div class="form-group">
            <label>Cambiar Plan</label>
            <select [(ngModel)]="nuevoPlan">
              <option *ngFor="let plan of planes" [value]="plan.slug">
                {{ plan.nombre }} — {{ plan.precio | currency:'USD' }}/mes
              </option>
            </select>
          </div>
          <button class="btn-primary" (click)="cambiarPlan()" [disabled]="nuevoPlan === tenant.plan_slug">
            🔄 Cambiar Plan
          </button>

          <!-- Subscription History -->
          <h3 class="sub-title">Historial de Suscripciones</h3>
          <div class="sub-list">
            <div *ngFor="let sub of subscripciones" class="sub-item">
              <span class="sub-plan">{{ sub.plan_slug }}</span>
              <span class="badge" [class]="'badge-' + sub.estado">{{ sub.estado }}</span>
              <span class="sub-date">{{ formatearFecha(sub.created_at) }}</span>
            </div>
            <p *ngIf="subscripciones.length === 0" class="text-muted">Sin historial</p>
          </div>
        </div>

        <!-- PRO FEATURES MANAGEMENT -->
        <div class="form-section features-section">
          <h2>⚡ Funciones Pro (Acceso Granular)</h2>
          <p class="section-desc">
            Activa o desactiva módulos específicos para este negocio, independientemente de su plan base.
            Las funciones con la etiqueta <span class="badge-plan-default">Plan ✓</span> vienen incluidas en su plan.
          </p>

          <div class="features-grid">
            <div *ngFor="let feature of featuresList" class="feature-item">
              <div class="feature-info">
                <span class="feature-icon">{{ feature.icon }}</span>
                <div class="feature-text">
                  <span class="feature-name">{{ feature.nombre }}</span>
                  <span class="feature-desc">{{ feature.descripcion }}</span>
                </div>
                <span *ngIf="getPlanFeatureValue(feature.key)" class="badge-plan-default">Plan ✓</span>
              </div>
              <div class="feature-toggle-wrapper">
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    [checked]="getFeatureValue(feature.key)"
                    (change)="toggleFeature(feature.key, $any($event.target).checked)"
                  />
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label" [class.active]="getFeatureValue(feature.key)">
                  {{ getFeatureValue(feature.key) ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
            </div>
          </div>

          <div class="features-actions">
            <button class="btn-primary" (click)="guardarFeaturesOverride()" [disabled]="guardandoFeatures">
              {{ guardandoFeatures ? '⏳ Guardando...' : '💾 Guardar Funciones' }}
            </button>
            <button class="btn-secondary" (click)="resetearFeatures()">↩ Restaurar Valores del Plan</button>
          </div>
        </div>

        <!-- Kill Switch -->
        <div class="form-section kill-switch-section">
          <h2>🔐 Control de Acceso (Kill Switch)</h2>
          <p class="kill-switch-desc">
            Controla si los usuarios de este negocio pueden acceder al sistema.
          </p>

          <div *ngIf="tenant.estado === 'activo'" class="kill-switch-active">
            <div class="status-indicator status-active">
              <span class="dot"></span> Sistema ACTIVO
            </div>
            <button class="btn-danger btn-lg" (click)="suspender()">
              ⛔ Suspender Acceso
            </button>
          </div>

          <div *ngIf="tenant.estado !== 'activo'" class="kill-switch-suspended">
            <div class="status-indicator status-suspended">
              <span class="dot"></span> Sistema SUSPENDIDO
            </div>
            <button class="btn-success btn-lg" (click)="reactivar()">
              ✅ Reactivar Acceso
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div *ngIf="!tenant" class="loading">
      <div class="spinner"></div>
      <p>Cargando tenant...</p>
    </div>
  `,
  styles: [`
    .features-section { grid-column: 1 / -1; }
    .section-desc { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1.5rem; line-height: 1.5; }
    .features-grid { display: flex; flex-direction: column; gap: 0.75rem; }
    .feature-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.25rem; background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
      transition: background 0.2s;
    }
    .feature-item:hover { background: rgba(255,255,255,0.06); }
    .feature-info { display: flex; align-items: center; gap: 1rem; flex: 1; }
    .feature-icon { font-size: 1.5rem; width: 2rem; text-align: center; }
    .feature-text { display: flex; flex-direction: column; flex: 1; }
    .feature-name { font-weight: 600; color: #e2e8f0; font-size: 0.9rem; }
    .feature-desc { color: #64748b; font-size: 0.78rem; margin-top: 2px; }
    .badge-plan-default {
      font-size: 0.7rem; padding: 2px 8px; border-radius: 20px;
      background: rgba(99, 102, 241, 0.2); color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3); white-space: nowrap; margin-right: 1rem;
    }
    .feature-toggle-wrapper { display: flex; align-items: center; gap: 0.75rem; }
    .toggle-label { font-size: 0.8rem; color: #64748b; min-width: 50px; text-align: right; }
    .toggle-label.active { color: #34d399; font-weight: 600; }
    .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
      background: #374151; border-radius: 24px; transition: 0.3s;
    }
    .toggle-slider:before {
      position: absolute; content: ""; height: 18px; width: 18px;
      left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s;
    }
    input:checked + .toggle-slider { background: #6366f1; }
    input:checked + .toggle-slider:before { transform: translateX(20px); }
    .features-actions { display: flex; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap; }
    .btn-secondary {
      padding: 0.625rem 1.25rem; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; background: transparent; color: #94a3b8;
      cursor: pointer; font-size: 0.875rem; transition: all 0.2s;
    }
    .btn-secondary:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
  `],
  styleUrls: ['./dev-admin.styles.css']
})
export class TenantDetailComponent implements OnInit {
  tenant: Tenant | null = null;
  planes: Plan[] = [];
  subscripciones: Subscripcion[] = [];
  nuevoPlan = '';
  guardandoFeatures = false;
  stats = { ventas_total: 0, ventas_mes: 0, productos_activos: 0, usuarios_activos: 0 };

  // Local copy of the current feature overrides (editable)
  currentOverrides: Record<string, boolean> = {};

  // All manageable Pro features
  featuresList = [
    { key: 'fiscal_ncf',         icon: '🧾', nombre: 'Módulo Fiscal / NCF',        descripcion: 'Emisión de comprobantes fiscales (Sistema dominicano DGII)' },
    { key: 'cripto',             icon: '🔐', nombre: 'Pagos en Criptomonedas',      descripcion: 'Aceptar pagos en Solana (SOL) y USDC' },
    { key: 'stock_transfers',    icon: '🔄', nombre: 'Transferencias de Stock',     descripcion: 'Mover inventario entre sucursales' },
    { key: 'kardex',             icon: '📊', nombre: 'Kardex de Inventario',        descripcion: 'Historial completo de movimientos de productos' },
    { key: 'reportes_avanzados', icon: '📈', nombre: 'Reportes Avanzados',          descripcion: 'Análisis de margen, rentabilidad y tendencias' },
    { key: 'multi_sucursal',     icon: '🏪', nombre: 'Multi-Sucursal',              descripcion: 'Gestión de múltiples puntos de venta' },
    { key: 'auditoria',          icon: '🔍', nombre: 'Auditoría Completa',          descripcion: 'Trazabilidad de todas las acciones del sistema' },
    { key: 'cuentas_pagar',      icon: '💳', nombre: 'Cuentas por Pagar',           descripcion: 'Gestión de deudas con proveedores' },
    { key: 'cuentas_cobrar',     icon: '💰', nombre: 'Cuentas por Cobrar',          descripcion: 'Gestión de créditos a clientes y cobros' },
  ];

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private devAdminService: DevAdminService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    const tenantId = this.route.snapshot.paramMap.get('id');
    if (!tenantId) { this.router.navigate(['/dev-admin/tenants']); return; }

    await this.devAdminService.cargarPlanes();
    this.devAdminService.planes$.subscribe(p => { this.planes = p; this.cdr.detectChanges(); });

    this.tenant = await this.devAdminService.obtenerTenant(tenantId);
    if (this.tenant) {
      this.nuevoPlan = this.tenant.plan_slug;
      this.subscripciones = await this.devAdminService.obtenerSubscripciones(tenantId);
      this.stats = await this.devAdminService.obtenerEstadisticasTenant(tenantId);
      this.currentOverrides = { ...(this.tenant.features_override || {}) };
    }
    this.cdr.detectChanges();
  }

  /** Returns the effective value for a feature (plan default merged with override) */
  getFeatureValue(key: string): boolean {
    if (!this.tenant) return false;
    if (key in this.currentOverrides) return this.currentOverrides[key];
    return (this.tenant.plan_features || {})[key] ?? false;
  }

  /** Returns the plan's default value (without overrides) */
  getPlanFeatureValue(key: string): boolean {
    return (this.tenant?.plan_features || {})[key] ?? false;
  }

  /** Toggle a feature override */
  toggleFeature(key: string, value: boolean) {
    this.currentOverrides = { ...this.currentOverrides, [key]: value };
  }

  /** Save the current overrides to the database */
  async guardarFeaturesOverride() {
    if (!this.tenant) return;
    this.guardandoFeatures = true;
    try {
      await this.devAdminService.guardarFeaturesOverride(this.tenant.id, this.currentOverrides);
      if (this.tenant) this.tenant.features_override = { ...this.currentOverrides };
      Swal.fire({ title: '✅ Funciones Guardadas', text: 'La configuración ha sido actualizada.', timer: 2000, showConfirmButton: false, icon: 'success' });
    } catch (error: any) {
      Swal.fire('❌ Error', error.message || 'No se pudo guardar', 'error');
    } finally {
      this.guardandoFeatures = false;
      this.cdr.detectChanges();
    }
  }

  /** Clear all overrides, reverts to plan defaults */
  resetearFeatures() {
    this.currentOverrides = {};
    this.cdr.detectChanges();
  }

  async guardarCambios() {
    if (!this.tenant) return;
    try {
      await this.devAdminService.actualizarTenant(this.tenant.id, {
        nombre: this.tenant.nombre,
        rnc: this.tenant.rnc,
        email: this.tenant.email,
        telefono: this.tenant.telefono,
        direccion: this.tenant.direccion
      });
      Swal.fire({ title: '✅ Guardado', timer: 1500, showConfirmButton: false, icon: 'success' });
    } catch (error: any) {
      Swal.fire('❌ Error', error.message || 'No se pudo guardar', 'error');
    }
  }

  async cambiarPlan() {
    if (!this.tenant || this.nuevoPlan === this.tenant.plan_slug) return;
    const planNombre = this.planes.find(p => p.slug === this.nuevoPlan)?.nombre || this.nuevoPlan;
    const result = await Swal.fire({
      title: '🔄 Cambiar Plan',
      html: `¿Cambiar <b>${this.tenant.nombre}</b> al plan <b>${planNombre}</b>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      await this.devAdminService.cambiarPlanTenant(this.tenant.id, this.nuevoPlan);
      this.tenant.plan_slug = this.nuevoPlan;
      this.subscripciones = await this.devAdminService.obtenerSubscripciones(this.tenant.id);
      this.cdr.detectChanges();
      Swal.fire({ title: '✅ Plan cambiado', timer: 1500, showConfirmButton: false, icon: 'success' });
    }
  }

  async suspender() {
    if (!this.tenant) return;
    const result = await Swal.fire({
      title: '⛔ Suspender Acceso',
      html: `<b>${this.tenant.nombre}</b> ya no podrá acceder al sistema.<br>¿Continuar?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, suspender',
      confirmButtonColor: '#ef4444'
    });
    if (result.isConfirmed) {
      await this.devAdminService.cambiarEstadoTenant(this.tenant.id, 'suspendido');
      this.tenant.estado = 'suspendido';
      this.cdr.detectChanges();
      Swal.fire({ title: '⛔ Suspendido', timer: 1500, showConfirmButton: false, icon: 'success' });
    }
  }

  async reactivar() {
    if (!this.tenant) return;
    await this.devAdminService.cambiarEstadoTenant(this.tenant.id, 'activo');
    this.tenant.estado = 'activo';
    this.cdr.detectChanges();
    Swal.fire({ title: '✅ Reactivado', timer: 1500, showConfirmButton: false, icon: 'success' });
  }

  impersonar() {
    if (!this.tenant) return;
    this.devAdminService.impersonarTenant(this.tenant.id);
    Swal.fire({
      title: '🔑 Modo Impersonación',
      html: `Ahora ves los datos de <b>${this.tenant.nombre}</b>.`,
      icon: 'info',
      confirmButtonText: 'Ir al Dashboard'
    }).then(() => this.router.navigate(['/dashboard']));
  }

  formatearFecha(fecha?: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-DO', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
