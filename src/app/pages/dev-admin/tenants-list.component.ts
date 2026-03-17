import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DevAdminService, Tenant } from '../../services/dev-admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-tenants-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dev-admin-container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <h1>🏢 Panel Dev — Tenants</h1>
          <p class="subtitle">Gestiona todos los negocios registrados en Logos-POS</p>
        </div>
        <div class="header-right">
          <button class="btn-primary" (click)="router.navigate(['/dev-admin/tenants/new'])">
            ➕ Nuevo Tenant
          </button>
          <button class="btn-secondary" (click)="router.navigate(['/dev-admin/plans'])">
            📋 Planes
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-number">{{ tenants.length }}</span>
          <span class="stat-label">Total Tenants</span>
        </div>
        <div class="stat-card stat-activo">
          <span class="stat-number">{{ tenantsActivos }}</span>
          <span class="stat-label">Activos</span>
        </div>
        <div class="stat-card stat-suspendido">
          <span class="stat-number">{{ tenantsSuspendidos }}</span>
          <span class="stat-label">Suspendidos</span>
        </div>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <input type="text" [(ngModel)]="filtroTexto" (ngModelChange)="aplicarFiltros()"
          placeholder="🔍 Buscar por nombre, email o RNC..." class="search-input" />
        <select [(ngModel)]="filtroEstado" (ngModelChange)="aplicarFiltros()" class="filter-select">
          <option value="todos">Todos</option>
          <option value="activo">Activos</option>
          <option value="suspendido">Suspendidos</option>
          <option value="vencido">Vencidos</option>
        </select>
      </div>

      <!-- Loading -->
      <div *ngIf="isLoading" class="loading">
        <div class="spinner"></div>
        <p>Cargando tenants...</p>
      </div>

      <!-- List -->
      <div *ngIf="!isLoading" class="tenants-grid">
        <div *ngFor="let tenant of tenantsFiltrados" class="tenant-card"
          [class.suspendido]="tenant.estado === 'suspendido'"
          [class.vencido]="tenant.estado === 'vencido'">
          <div class="tenant-header">
            <div class="tenant-info">
              <h3>{{ tenant.nombre }}</h3>
              <span class="badge" [class]="'badge-' + tenant.estado">{{ tenant.estado | uppercase }}</span>
            </div>
            <span class="plan-badge">{{ tenant.plan_nombre || tenant.plan_slug }}</span>
          </div>
          <div class="tenant-meta">
            <p *ngIf="tenant.email">📧 {{ tenant.email }}</p>
            <p *ngIf="tenant.rnc">🆔 RNC: {{ tenant.rnc }}</p>
            <p>📅 {{ formatearFecha(tenant.created_at) }}</p>
          </div>
          <div class="tenant-actions">
            <button class="btn-sm btn-view" (click)="verDetalle(tenant)">👁 Ver</button>
            <button *ngIf="tenant.estado === 'activo'" class="btn-sm btn-danger"
              (click)="suspenderTenant(tenant)">⛔ Suspender</button>
            <button *ngIf="tenant.estado !== 'activo'" class="btn-sm btn-success"
              (click)="reactivarTenant(tenant)">✅ Reactivar</button>
            <button class="btn-sm btn-impersonate" (click)="impersonar(tenant)">🔑 Entrar</button>
          </div>
        </div>

        <div *ngIf="tenantsFiltrados.length === 0" class="empty-state">
          <p>No hay tenants que coincidan con tu búsqueda</p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dev-admin.styles.css']
})
export class TenantsListComponent implements OnInit, OnDestroy {
  tenants: Tenant[] = [];
  tenantsFiltrados: Tenant[] = [];
  filtroTexto = '';
  filtroEstado = 'todos';
  isLoading = false;
  private subs: Subscription[] = [];

  get tenantsActivos(): number { return this.tenants.filter(t => t.estado === 'activo').length; }
  get tenantsSuspendidos(): number { return this.tenants.filter(t => t.estado !== 'activo').length; }

  constructor(
    public router: Router,
    private devAdminService: DevAdminService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    this.subs.push(
      this.devAdminService.tenants$.subscribe(tenants => {
        this.tenants = tenants;
        this.aplicarFiltros();
        this.cdr.detectChanges();
      })
    );
    this.isLoading = true;
    await this.devAdminService.cargarTenants();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()); }

  aplicarFiltros() {
    let filtrados = [...this.tenants];
    if (this.filtroTexto.trim()) {
      const t = this.filtroTexto.toLowerCase();
      filtrados = filtrados.filter(tenant =>
        tenant.nombre.toLowerCase().includes(t) ||
        (tenant.email || '').toLowerCase().includes(t) ||
        (tenant.rnc || '').includes(t)
      );
    }
    if (this.filtroEstado !== 'todos') {
      filtrados = filtrados.filter(tenant => tenant.estado === this.filtroEstado);
    }
    this.tenantsFiltrados = filtrados;
  }

  verDetalle(tenant: Tenant) {
    this.router.navigate(['/dev-admin/tenants', tenant.id]);
  }

  async suspenderTenant(tenant: Tenant) {
    const result = await Swal.fire({
      title: '⛔ Suspender Tenant',
      html: `¿Suspender <b>${tenant.nombre}</b>?<br>Los usuarios de este negocio no podrán acceder al sistema.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, suspender',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    });
    if (result.isConfirmed) {
      await this.devAdminService.cambiarEstadoTenant(tenant.id, 'suspendido');
      Swal.fire({ title: '✅ Suspendido', timer: 1500, showConfirmButton: false, icon: 'success' });
    }
  }

  async reactivarTenant(tenant: Tenant) {
    await this.devAdminService.cambiarEstadoTenant(tenant.id, 'activo');
    Swal.fire({ title: '✅ Reactivado', timer: 1500, showConfirmButton: false, icon: 'success' });
  }

  impersonar(tenant: Tenant) {
    this.devAdminService.impersonarTenant(tenant.id);
    Swal.fire({
      title: '🔑 Modo Impersonación',
      html: `Ahora estás viendo los datos de <b>${tenant.nombre}</b>.<br>Ve al Dashboard para explorar.`,
      icon: 'info',
      confirmButtonText: 'Ir al Dashboard'
    }).then(() => this.router.navigate(['/dashboard']));
  }

  formatearFecha(fecha?: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-DO', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
