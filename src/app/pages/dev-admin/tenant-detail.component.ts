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
  styleUrls: ['./dev-admin.styles.css']
})
export class TenantDetailComponent implements OnInit {
  tenant: Tenant | null = null;
  planes: Plan[] = [];
  subscripciones: Subscripcion[] = [];
  nuevoPlan = '';
  stats = { ventas_total: 0, ventas_mes: 0, productos_activos: 0, usuarios_activos: 0 };

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

    // Load tenant details
    this.tenant = await this.devAdminService.obtenerTenant(tenantId);
    if (this.tenant) {
      this.nuevoPlan = this.tenant.plan_slug;
      this.subscripciones = await this.devAdminService.obtenerSubscripciones(tenantId);
      this.stats = await this.devAdminService.obtenerEstadisticasTenant(tenantId);
    }
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
