import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BootstrapService } from '../../../services/bootstrap.service';
import { AuthService } from '../../../services/auth.service';
import { SupabaseService } from '../../../services/supabase.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-sistema',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sistema.component.html',
  styleUrls: ['./sistema.component.css']
})
export class SistemaComponent implements OnInit {
  estadoSistema = {
    rolesCreados: false,
    adminCreado: false,
    usuariosDemo: 0
  };

  isLoading = false;
  isBackingUp = false;

  isDevAdmin = false;

  constructor(
    private bootstrapService: BootstrapService,
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    this.isDevAdmin = this.authService.usuarioActual?.is_dev_admin === true;
    if (this.isDevAdmin) {
      await this.verificarEstado();
    }
  }

  async verificarEstado() {
    this.isLoading = true;
    this.cdr.detectChanges();
    try {
      this.estadoSistema = await this.bootstrapService.verificarEstadoSistema();
    } catch (error) {
      console.error('Error verificando estado:', error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
      setTimeout(() => this.cdr.detectChanges(), 100);
    }
  }

  async reinicializarSistema() {
    if (!this.authService.tienePermiso('config.general')) {
      Swal.fire({
        title: '🚫 Sin Permisos',
        text: 'No tienes permisos para ejecutar esta operación',
        icon: 'error'
      });
      return;
    }

    const result = await Swal.fire({
      title: '⚠️ Reconstruir Roles del Sistema',
      html: `
        <p class="text-muted">Esta operación verificará y recreará los roles base del sistema si están incompletos o dañados.</p>
        <div class="alert alert-warning text-start small mt-3">
          <strong>⚠️ Importante:</strong> No se eliminarán datos existentes. Solo se crearán los roles faltantes.
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '<i class="fa-solid fa-arrows-rotate me-2"></i> Ejecutar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#6b7280'
    });

    if (result.isConfirmed) {
      this.isLoading = true;
      this.cdr.detectChanges();
      try {
        await this.bootstrapService.inicializarSistema();

        await Swal.fire({
          title: '✅ Roles Reconstruidos',
          text: 'La matriz de roles y permisos ha sido verificada y reparada correctamente',
          icon: 'success',
          confirmButtonColor: '#10b981'
        });

        await this.verificarEstado();

      } catch (error) {
        console.error('Error reinicializando sistema:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudo reconstruir los roles del sistema',
          icon: 'error'
        });
      } finally {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  async limpiarSesiones() {
    if (!this.authService.tienePermiso('config.general')) {
      Swal.fire({
        title: '🚫 Sin Permisos',
        text: 'No tienes permisos para ejecutar esta operación',
        icon: 'error'
      });
      return;
    }

    const result = await Swal.fire({
      title: '🗑️ Limpiar Sesiones Inactivas',
      html: `
        <p class="text-muted">Se cerrarán y eliminarán todas las sesiones de usuarios que estén inactivas.</p>
        <div class="alert alert-info text-start small mt-3">
          <strong>ℹ️ Nota:</strong> Los usuarios actualmente conectados no se verán afectados.
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '<i class="fa-solid fa-broom me-2"></i> Limpiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (result.isConfirmed) {
      this.isLoading = true;
      this.cdr.detectChanges();
      try {
        // Cerrar todas las sesiones marcadas como inactivas
        const { error } = await this.supabaseService.client
          .from('sesiones')
          .delete()
          .eq('activa', false);

        if (error) throw error;

        await Swal.fire({
          title: '✅ Sesiones Limpiadas',
          text: 'Las sesiones inactivas han sido eliminadas correctamente',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });

      } catch (error) {
        console.error('Error limpiando sesiones:', error);
        Swal.fire({
          title: '❌ Error',
          text: 'No se pudieron limpiar las sesiones inactivas',
          icon: 'error'
        });
      } finally {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  async generarBackup() {
    if (!this.authService.tienePermiso('config.general')) {
      Swal.fire({
        title: '🚫 Sin Permisos',
        text: 'No tienes permisos para generar respaldos',
        icon: 'error'
      });
      return;
    }

    const result = await Swal.fire({
      title: '📦 Generar Copia de Seguridad',
      html: `
        <p class="text-muted">Se exportarán todos los datos críticos del sistema en un archivo JSON descargable.</p>
        <div class="text-start small mt-3 bg-light rounded p-3">
          <strong>🗂️ Incluye:</strong>
          <ul class="mb-0 mt-2">
            <li>Productos e Inventario</li>
            <li>Clientes y Proveedores</li>
            <li>Ventas y Compras</li>
            <li>Cuentas por Cobrar y Pagar</li>
            <li>Usuarios y Roles</li>
            <li>Configuración Fiscal y NCF</li>
          </ul>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '<i class="fa-solid fa-download me-2"></i> Descargar Backup',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) return;

    this.isBackingUp = true;
    this.cdr.detectChanges();

    try {
      const client = this.supabaseService.client;

      // Consultar todas las tablas críticas en paralelo
      const [
        { data: productos },
        { data: clientes },
        { data: proveedores },
        { data: ventas },
        { data: compras },
        { data: cuentasCobrar },
        { data: cuentasPagar },
        { data: usuarios },
        { data: roles },
        { data: cajas },
        { data: configFiscal },
        { data: secuenciasNcf }
      ] = await Promise.all([
        client.from('productos').select('*'),
        client.from('clientes').select('*'),
        client.from('proveedores').select('*'),
        client.from('ventas').select('*'),
        client.from('compras').select('*'),
        client.from('cuentas_cobrar').select('*'),
        client.from('cuentas_pagar').select('*'),
        client.from('usuarios').select('id, nombre, apellido, email, username, rol_id, activo, created_at'),
        client.from('roles').select('*'),
        client.from('cajas').select('*'),
        client.from('configuracion_fiscal').select('*'),
        client.from('secuencias_ncf').select('*'),
      ]);

      const fecha = new Date().toISOString().slice(0, 10);

      const backup = {
        metadata: {
          sistema: 'LicorPos',
          version: '1.0.0',
          fecha_generacion: new Date().toISOString(),
          generado_por: (() => { try { return JSON.parse(localStorage.getItem('dolvin_usuario') || '{}')?.username || 'sistema'; } catch { return 'sistema'; } })(),
          total_tablas: 12
        },
        datos: {
          productos: productos || [],
          clientes: clientes || [],
          proveedores: proveedores || [],
          ventas: ventas || [],
          compras: compras || [],
          cuentas_cobrar: cuentasCobrar || [],
          cuentas_pagar: cuentasPagar || [],
          usuarios: usuarios || [],
          roles: roles || [],
          cajas: cajas || [],
          configuracion_fiscal: configFiscal || [],
          secuencias_ncf: secuenciasNcf || []
        }
      };

      // Calcular total de registros exportados
      const totalRegistros = Object.values(backup.datos).reduce(
        (acc, tabla) => acc + (Array.isArray(tabla) ? tabla.length : 0), 0
      );

      // Generar y descargar el archivo JSON
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `licorpos_backup_${fecha}.json`;
      link.click();
      URL.revokeObjectURL(url);

      Swal.fire({
        title: '✅ Backup Generado',
        html: `
          <p class="text-muted">El archivo ha sido descargado exitosamente.</p>
          <div class="bg-light rounded p-3 text-start small mt-2">
            <div class="d-flex justify-content-between"><span>Archivo:</span><strong>licorpos_backup_${fecha}.json</strong></div>
            <div class="d-flex justify-content-between mt-1"><span>Registros exportados:</span><strong>${totalRegistros.toLocaleString()}</strong></div>
            <div class="d-flex justify-content-between mt-1"><span>Tablas incluidas:</span><strong>12</strong></div>
          </div>
        `,
        icon: 'success',
        confirmButtonColor: '#10b981'
      });

    } catch (error) {
      console.error('Error generando backup:', error);
      Swal.fire({
        title: '❌ Error en Backup',
        text: 'No se pudo generar la copia de seguridad. Verifica tu conexión.',
        icon: 'error'
      });
    } finally {
      this.isBackingUp = false;
      this.cdr.detectChanges();
    }
  }
}
