import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DevAdminService, CrearTenantPayload, Plan } from '../../services/dev-admin.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-tenant-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dev-admin-container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <button class="btn-back" (click)="router.navigate(['/dev-admin/tenants'])">← Volver</button>
          <h1>➕ Nuevo Tenant</h1>
          <p class="subtitle">Registra un nuevo negocio y su usuario administrador</p>
        </div>
      </div>

      <form (ngSubmit)="guardar()" class="form-grid">
        <!-- Datos del Negocio -->
        <div class="form-section">
          <h2>🏢 Datos del Negocio</h2>
          <div class="form-row">
            <div class="form-group">
              <label>Nombre del Negocio *</label>
              <input type="text" [(ngModel)]="form.nombre" name="nombre" required placeholder="Ej: Colmado La Esquina" />
            </div>
            <div class="form-group">
              <label>RNC</label>
              <input type="text" [(ngModel)]="form.rnc" name="rnc" placeholder="000-00000-0" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="form.email" name="email" placeholder="negocio@email.com" />
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input type="tel" [(ngModel)]="form.telefono" name="telefono" placeholder="+1 (809) 555-0000" />
            </div>
          </div>
          <div class="form-group full-width">
            <label>Dirección</label>
            <input type="text" [(ngModel)]="form.direccion" name="direccion" placeholder="Calle, Sector, Ciudad" />
          </div>
          <div class="form-group">
            <label>Plan *</label>
            <select [(ngModel)]="form.plan_slug" name="plan_slug" required>
              <option *ngFor="let plan of planes" [value]="plan.slug">
                {{ plan.nombre }} — {{ plan.precio | currency:'USD' }}/mes
              </option>
            </select>
          </div>
        </div>

        <!-- Admin User -->
        <div class="form-section">
          <h2>👤 Usuario Administrador (primer usuario para este negocio)</h2>
          <div class="form-row">
            <div class="form-group">
              <label>Nombre *</label>
              <input type="text" [(ngModel)]="form.admin_nombre" name="admin_nombre" required placeholder="Juan" />
            </div>
            <div class="form-group">
              <label>Apellido *</label>
              <input type="text" [(ngModel)]="form.admin_apellido" name="admin_apellido" required placeholder="Pérez" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email *</label>
              <input type="email" [(ngModel)]="form.admin_email" name="admin_email" required placeholder="admin@negocio.com" />
            </div>
            <div class="form-group">
              <label>Username *</label>
              <input type="text" [(ngModel)]="form.admin_username" name="admin_username" required placeholder="admin" />
            </div>
          </div>
          <div class="form-group">
            <label>Contraseña *</label>
            <input type="password" [(ngModel)]="form.admin_password" name="admin_password" required placeholder="Mínimo 6 caracteres" />
          </div>
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button type="button" class="btn-secondary" (click)="router.navigate(['/dev-admin/tenants'])">Cancelar</button>
          <button type="submit" class="btn-primary" [disabled]="isSaving">
            {{ isSaving ? '⏳ Creando...' : '✅ Crear Tenant' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styleUrls: ['./dev-admin.styles.css']
})
export class TenantFormComponent {
  planes: Plan[] = [];
  isSaving = false;

  form: CrearTenantPayload = {
    nombre: '',
    rnc: '',
    email: '',
    telefono: '',
    direccion: '',
    plan_slug: 'basico',
    admin_nombre: '',
    admin_apellido: '',
    admin_email: '',
    admin_username: '',
    admin_password: ''
  };

  constructor(
    public router: Router,
    private devAdminService: DevAdminService,
    private cdr: ChangeDetectorRef
  ) {
    this.devAdminService.cargarPlanes();
    this.devAdminService.planes$.subscribe(p => {
      this.planes = p;
      if (p.length && !this.form.plan_slug) this.form.plan_slug = p[0].slug;
      this.cdr.detectChanges();
    });
  }

  async guardar() {
    // Validations
    if (!this.form.nombre.trim()) {
      Swal.fire('⚠️ Requerido', 'El nombre del negocio es obligatorio', 'warning');
      return;
    }
    if (!this.form.admin_nombre.trim() || !this.form.admin_apellido.trim()) {
      Swal.fire('⚠️ Requerido', 'Nombre y apellido del admin son obligatorios', 'warning');
      return;
    }
    if (!this.form.admin_email.trim() || !this.form.admin_username.trim()) {
      Swal.fire('⚠️ Requerido', 'Email y username del admin son obligatorios', 'warning');
      return;
    }
    if (!this.form.admin_password || this.form.admin_password.length < 6) {
      Swal.fire('⚠️ Requerido', 'La contraseña debe tener al menos 6 caracteres', 'warning');
      return;
    }

    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const tenant = await this.devAdminService.crearTenant(this.form);

      await Swal.fire({
        title: '✅ Tenant Creado',
        html: `
          <b>${tenant.nombre}</b> ha sido registrado.<br><br>
          <b>Credenciales del Admin:</b><br>
          Usuario: <code>${this.form.admin_username}</code><br>
          Contraseña: <code>${this.form.admin_password}</code>
        `,
        icon: 'success'
      });

      this.router.navigate(['/dev-admin/tenants']);
    } catch (error: any) {
      Swal.fire('❌ Error', error.message || 'No se pudo crear el tenant', 'error');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }
}
