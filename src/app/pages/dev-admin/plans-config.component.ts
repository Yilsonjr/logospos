import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DevAdminService, Plan } from '../../services/dev-admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-plans-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dev-admin-container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <button class="btn-back" (click)="router.navigate(['/dev-admin/tenants'])">← Volver</button>
          <h1>📋 Configuración de Planes</h1>
          <p class="subtitle">Administra los planes y precios disponibles para tus clientes</p>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="isLoading" class="loading">
        <div class="spinner"></div>
        <p>Cargando planes...</p>
      </div>

      <!-- Plans Grid -->
      <div *ngIf="!isLoading" class="plans-grid">
        <div *ngFor="let plan of planes" class="plan-card" [class.plan-popular]="plan.slug === 'profesional'">
          <div *ngIf="plan.slug === 'profesional'" class="popular-badge">⭐ Más Popular</div>
          <h2 class="plan-name">{{ plan.nombre }}</h2>
          <div class="plan-price">
            <span class="price-amount">{{ plan.precio | currency:'USD':'symbol':'1.2-2' }}</span>
            <span class="price-interval">/mes</span>
          </div>

          <!-- Features -->
          <div class="plan-features">
            <h3>Funciones incluidas:</h3>
            <ul>
              <li *ngFor="let feature of getFeatureKeys(plan)">
                <span [class.feature-active]="plan.features[feature]"
                      [class.feature-inactive]="!plan.features[feature]">
                  {{ plan.features[feature] ? '✅' : '❌' }}
                </span>
                {{ formatFeatureName(feature) }}
              </li>
            </ul>
          </div>

          <!-- Edit -->
          <div class="plan-edit">
            <div class="form-group">
              <label>Precio (USD)</label>
              <input type="number" [(ngModel)]="plan.precio" step="5" min="0" />
            </div>
            <button class="btn-primary" (click)="guardarPlan(plan)">💾 Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dev-admin.styles.css']
})
export class PlansConfigComponent implements OnInit, OnDestroy {
  planes: Plan[] = [];
  isLoading = false;
  private subs: Subscription[] = [];

  constructor(
    public router: Router,
    private devAdminService: DevAdminService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    this.subs.push(
      this.devAdminService.planes$.subscribe(planes => {
        this.planes = planes;
        this.cdr.detectChanges();
      })
    );
    this.isLoading = true;
    await this.devAdminService.cargarPlanes();
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()); }

  getFeatureKeys(plan: Plan): string[] {
    return Object.keys(plan.features || {});
  }

  formatFeatureName(key: string): string {
    const names: Record<string, string> = {
      'ventas': 'Punto de Venta',
      'ncf': 'Comprobantes Fiscales (NCF)',
      'inventario_avanzado': 'Inventario Avanzado',
      'multi_sucursal': 'Multi-Sucursal',
      'cuentas_cobrar': 'Cuentas por Cobrar',
      'cuentas_pagar': 'Cuentas por Pagar',
      'reportes': 'Reportes',
      'usuarios_ilimitados': 'Usuarios Ilimitados'
    };
    return names[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  async guardarPlan(plan: Plan) {
    try {
      await this.devAdminService.actualizarPlan(plan.slug, {
        precio: plan.precio,
        features: plan.features
      });
      Swal.fire({ title: '✅ Plan guardado', timer: 1500, showConfirmButton: false, icon: 'success' });
    } catch (error: any) {
      Swal.fire('❌ Error', error.message || 'No se pudo guardar el plan', 'error');
    }
  }
}
