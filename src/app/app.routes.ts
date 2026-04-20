import { Routes } from '@angular/router';

// Componentes Carga Inicial (Eager Loading)
import { LoginComponent } from './pages/auth/login/login.component';

// Guards
import { AuthGuard } from './guards/auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { DevAdminGuard } from './guards/dev-admin.guard';
import { FeatureGuard } from './guards/feature.guard';

export const routes: Routes = [
    // Ruta de Login (sin protección, Eager Load para renderizado inmediato)
    { path: 'login', component: LoginComponent },

    // ============================================
    // Dev Admin routes (only for is_dev_admin users)
    // ============================================
    { 
        path: 'dev-admin/tenants', 
        loadComponent: () => import('./pages/dev-admin/tenants-list.component').then(m => m.TenantsListComponent), 
        canActivate: [AuthGuard, DevAdminGuard] 
    },
    { 
        path: 'dev-admin/tenants/new', 
        loadComponent: () => import('./pages/dev-admin/tenant-form.component').then(m => m.TenantFormComponent), 
        canActivate: [AuthGuard, DevAdminGuard] 
    },
    { 
        path: 'dev-admin/tenants/:id', 
        loadComponent: () => import('./pages/dev-admin/tenant-detail.component').then(m => m.TenantDetailComponent), 
        canActivate: [AuthGuard, DevAdminGuard] 
    },
    { 
        path: 'dev-admin/plans', 
        loadComponent: () => import('./pages/dev-admin/plans-config.component').then(m => m.PlansConfigComponent), 
        canActivate: [AuthGuard, DevAdminGuard] 
    },

    // ============================================
    // Rutas protegidas (Lazy Loading - Optimizado)
    // ============================================
    
    // Dashboard
    {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['dashboard.ver'] }
    },

    // Inventario
    {
        path: 'inventario',
        loadComponent: () => import('./pages/inventario/inventario.component').then(m => m.Inventario),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['inventario.ver'] }
    },
    {
        path: 'inventario/proveedores',
        loadComponent: () => import('./pages/inventario/proveedores/proveedores.component').then(m => m.ProveedoresComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['proveedores.ver'] }
    },

    // Compras
    {
        path: 'compras',
        loadComponent: () => import('./pages/compras/compras.component').then(m => m.ComprasComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['inventario.ver'] }
    },
    {
        path: 'compras/nueva',
        loadComponent: () => import('./pages/compras/nueva-compra/nueva-compra.component').then(m => m.NuevaCompraComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['inventario.crear'] }
    },
    {
        path: 'compras/:id',
        loadComponent: () => import('./pages/compras/detalle-compra/detalle-compra.component').then(m => m.DetalleCompraComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['inventario.ver'] }
    },

    // Clientes
    {
        path: 'clientes',
        loadComponent: () => import('./pages/clientes/clientes.component').then(m => m.ClientesComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['clientes.ver'] }
    },

    // Ventas
    {
        path: 'ventas/nueva',
        loadComponent: () => import('./pages/ventas/pos/pos.component').then(m => m.PosComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['ventas.crear'] }
    },
    {
        path: 'ventas/historial',
        loadComponent: () => import('./pages/ventas/historial/historial-ventas.component').then(m => m.HistorialVentasComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['ventas.historial'] }
    },

    // Caja
    {
        path: 'caja/apertura',
        loadComponent: () => import('./pages/caja/apertura/apertura-caja.component').then(m => m.AperturaCajaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.abrir'] }
    },
    {
        path: 'caja/cierre',
        loadComponent: () => import('./pages/caja/cierre/cierre-caja.component').then(m => m.CierreCajaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.cerrar'] }
    },
    {
        path: 'caja/entrada-efectivo',
        loadComponent: () => import('./pages/caja/movimiento/movimiento-caja.component').then(m => m.MovimientoCajaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.movimientos'] }
    },
    {
        path: 'caja/salida-efectivo',
        loadComponent: () => import('./pages/caja/movimiento/movimiento-caja.component').then(m => m.MovimientoCajaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.movimientos'] }
    },
    {
        path: 'caja/arqueo',
        loadComponent: () => import('./pages/caja/arqueo/arqueo-caja.component').then(m => m.ArqueoCajaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.arqueo'] }
    },
    {
        path: 'caja/historial',
        loadComponent: () => import('./pages/caja/historial/historial-caja.component').then(m => m.HistorialCajaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['caja.historial'] }
    },

    // Cuentas por Cobrar
    {
        path: 'cuentas-cobrar',
        loadComponent: () => import('./pages/cuentas-cobrar/cuentas-cobrar.component').then(m => m.CuentasCobrarComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.ver'] }
    },
    {
        path: 'cuentas-cobrar/recordatorios',
        loadComponent: () => import('./pages/cuentas-cobrar/recordatorios/recordatorios').then(m => m.RecordatoriosComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.recordatorios'] }
    },
    {
        path: 'cuentas-cobrar/estado-cuenta',
        loadComponent: () => import('./pages/cuentas-cobrar/estado-cuenta/estado-cuenta.component').then(m => m.EstadoCuentaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.ver'] }
    },

    // Cuentas por Pagar
    {
        path: 'cuentas-pagar',
        loadComponent: () => import('./pages/cuentas-pagar/cuentas-pagar.component').then(m => m.CuentasPagarComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.ver'] }
    },
    {
        path: 'cuentas-pagar/nueva',
        loadComponent: () => import('./pages/cuentas-pagar/nueva-cuenta/nueva-cuenta.component').then(m => m.NuevaCuentaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.crear'] }
    },
    {
        path: 'cuentas-pagar/editar/:id',
        loadComponent: () => import('./pages/cuentas-pagar/nueva-cuenta/nueva-cuenta.component').then(m => m.NuevaCuentaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.editar'] }
    },
    {
        path: 'cuentas-pagar/detalle/:id',
        loadComponent: () => import('./pages/cuentas-pagar/detalle/detalle-cuenta-pagar.component').then(m => m.DetalleCuentaPagarComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.ver'] }
    },
    {
        path: 'cuentas-pagar/plan-pagos',
        loadComponent: () => import('./pages/cuentas-pagar/plan-pagos/plan-pagos.component').then(m => m.PlanPagosComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['cuentas.ver'] }
    },

    // Perfil de Usuario
    {
        path: 'perfil',
        loadComponent: () => import('./pages/auth/perfil/perfil.component').then(m => m.PerfilComponent),
        canActivate: [AuthGuard]
    },

    // Reportes
    {
        path: 'reportes/ventas',
        loadComponent: () => import('./pages/reportes/ventas/reportes-ventas.component').then(m => m.ReportesVentasComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['reportes.ventas'] }
    },
    {
        path: 'reportes/inventario',
        loadComponent: () => import('./pages/reportes/inventario/reportes-inventario.component').then(m => m.ReportesInventarioComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['reportes.inventario'] }
    },
    {
        path: 'reportes/caja',
        loadComponent: () => import('./pages/reportes/caja/reportes-caja.component').then(m => m.ReportesCajaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['reportes.caja'] }
    },
    {
        path: 'reportes/clientes',
        loadComponent: () => import('./pages/reportes/clientes/reportes-clientes.component').then(m => m.ReportesClientesComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['reportes.clientes'] }
    },
    {
        path: 'reportes/dgii',
        loadComponent: () => import('./pages/reportes/dgii/reportes-dgii.component').then(m => m.ReportesDgiiComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['reportes.ventas'] }
    },
    {
        path: 'reportes/margen',
        loadComponent: () => import('./pages/reportes/margen/reportes-margen.component').then(m => m.ReportesMargenComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['reportes.ventas'] }
    },
    {
        path: 'reportes',
        redirectTo: 'reportes/ventas',
        pathMatch: 'full'
    },

    // Administración
    {
        path: 'admin/usuarios',
        loadComponent: () => import('./pages/admin/usuarios/usuarios.component').then(m => m.UsuariosComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['usuarios.ver'] }
    },
    {
        path: 'admin/roles',
        loadComponent: () => import('./pages/admin/roles/roles.component').then(m => m.RolesComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['roles.ver'] }
    },
    {
        path: 'admin/sucursales',
        loadComponent: () => import('./pages/admin/sucursales/sucursales.component').then(m => m.SucursalesComponent),
        canActivate: [AuthGuard, PermissionGuard, FeatureGuard],
        data: { permissions: ['config.general'], feature: 'multi_sucursal' }
    },
    {
        path: 'admin/auditoria',
        loadComponent: () => import('./pages/admin/auditoria/auditoria').then(m => m.AuditoriaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['config.logs'] }
    },
    {
        path: 'admin/sistema',
        loadComponent: () => import('./pages/admin/sistema/sistema.component').then(m => m.SistemaComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['config.general'] }
    },
    {
        path: 'admin/fiscal',
        loadComponent: () => import('./pages/admin/configuracion-fiscal/configuracion-fiscal.component').then(m => m.ConfiguracionFiscalComponent),
        canActivate: [AuthGuard, PermissionGuard],
        data: { permissions: ['config.general'] }
    },

    // Redirecciones fallback
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: '**', redirectTo: 'dashboard' }
];
