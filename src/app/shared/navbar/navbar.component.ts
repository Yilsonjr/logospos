import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { ProductosService } from '../../services/productos.service';
import { SucursalService } from '../../services/sucursal.service';
import { Usuario } from '../../models/usuario.model';
import { Sucursal } from '../../models/sucursal.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  isMobileMenuOpen = false;
  isCollapsed = false;
  usuario: Usuario | null = null;
  subscriptions: Subscription[] = [];
  productosStockBajo: number = 0;
  
  sucursalesAsignadas: Sucursal[] = [];
  sucursalActiva: Sucursal | null = null;
  cambiandoSucursal = false;

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private productosService: ProductosService,
    private sucursalService: SucursalService,
    private router: Router
  ) {
    // Cargar estado inicial del sidebar
    this.isCollapsed = this.sidebarService.getCollapsed();
  }

  ngOnInit() {
    // Suscribirse al estado del sidebar
    const sidebarSub = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.isCollapsed = collapsed;
      // Al colapsar el sidebar, cerramos todos los menús para que al re-abrir esté limpio
      if (collapsed) {
        this.menuItemsFiltrados.forEach(item => item.expanded = false);
      } else {
        // Al expandir, re-activamos el menú de la ruta actual
        this.expandirMenuPorRuta(this.router.url);
      }
    });

    // Suscribirse al estado de autenticación
    const authSub = this.authService.authState$.subscribe(authState => {
      this.usuario = authState.usuario;
      this.filtrarMenuPorPermisos();
      this.expandirMenuPorRuta(this.router.url);
    });

    // Suscribirse a productos para detectar stock bajo
    const productosSub = this.productosService.productos$.subscribe(productos => {
      this.productosStockBajo = productos.filter(p =>
        p.stock_minimo && p.stock_minimo > 0 && p.stock < p.stock_minimo
      ).length;
    });

    const sucursalActivaSub = this.sucursalService.sucursalActiva$.subscribe(sucursal => {
      this.sucursalActiva = sucursal;
    });

    const sucursalesSub = this.sucursalService.sucursalesAsignadas$.subscribe(sucursales => {
      this.sucursalesAsignadas = sucursales;
    });

    // Suscribirse a eventos de navegación para expandir el menú correcto automáticamente
    const routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.expandirMenuPorRuta(event.urlAfterRedirects || event.url);
    });

    this.subscriptions.push(sidebarSub, authSub, productosSub, sucursalActivaSub, sucursalesSub, routerSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  menuItems = [
    {
      label: 'Dashboard',
      icon: 'fa-solid fa-chart-line',
      link: '/dashboard',
      active: false,
      permissions: ['dashboard.ver']
    },
    {
      label: 'Inventario',
      icon: 'fa-solid fa-boxes-stacked',
      link: '/inventario',
      active: false,
      permissions: ['inventario.ver'],
      submenu: [
        { label: 'Productos', link: '/inventario', icon: 'fa-solid fa-box', permissions: ['inventario.ver'] },
        { label: 'Proveedores', link: '/inventario/proveedores', icon: 'fa-solid fa-truck', permissions: ['proveedores.ver'] }
      ],
      expanded: false
    },
    {
      label: 'Compras',
      icon: 'fa-solid fa-shopping-bag',
      link: '/compras',
      active: false,
      permissions: ['inventario.ver'],
      submenu: [
        { label: 'Lista de Compras', link: '/compras', icon: 'fa-solid fa-list', permissions: ['inventario.ver'] },
        { label: 'Nueva Compra', link: '/compras/nueva', icon: 'fa-solid fa-plus-circle', permissions: ['inventario.crear'] }
      ],
      expanded: false
    },
    {
      label: 'Ventas',
      icon: 'fa-solid fa-shopping-cart',
      link: '/ventas',
      active: false,
      permissions: ['ventas.ver'],
      submenu: [
        { label: 'Nueva Transaccion', link: '/ventas/nueva', icon: 'fa-solid fa-plus-circle', permissions: ['ventas.crear'] },
        { label: 'Historial', link: '/ventas/historial', icon: 'fa-solid fa-clock-rotate-left', permissions: ['ventas.historial'] }
      ],
      expanded: false
    },
    {
      label: 'Caja',
      icon: 'fa-solid fa-cash-register',
      link: '/caja',
      active: false,
      permissions: ['caja.ver'],
      submenu: [
        { label: 'Apertura de Caja', link: '/caja/apertura', icon: 'fa-solid fa-door-open', permissions: ['caja.abrir'] },
        { label: 'Cierre de Caja', link: '/caja/cierre', icon: 'fa-solid fa-door-closed', permissions: ['caja.cerrar'] },
        { label: 'Salida de Efectivo', link: '/caja/salida-efectivo', icon: 'fa-solid fa-money-bill-transfer', permissions: ['caja.movimientos'] },
        { label: 'Entrada de Efectivo', link: '/caja/entrada-efectivo', icon: 'fa-solid fa-hand-holding-dollar', permissions: ['caja.movimientos'] },
        { label: 'Arqueo de Caja', link: '/caja/arqueo', icon: 'fa-solid fa-calculator', permissions: ['caja.arqueo'] },
        { label: 'Historial de Movimientos', link: '/caja/historial', icon: 'fa-solid fa-list-ul', permissions: ['caja.historial'] }
      ],
      expanded: false
    },
    {
      label: 'Clientes',
      icon: 'fa-solid fa-users',
      link: '/clientes',
      active: false,
      permissions: ['clientes.ver']
    },
    {
      label: 'Cuentas por Cobrar',
      icon: 'fa-solid fa-money-bill-trend-up',
      link: '/cuentas-cobrar',
      active: false,
      permissions: ['cuentas.ver'],
      submenu: [
        { label: 'Cuentas Pendientes', link: '/cuentas-cobrar', icon: 'fa-solid fa-hourglass-half', permissions: ['cuentas.ver'] },
        { label: 'Estado de Cuenta', link: '/cuentas-cobrar/estado-cuenta', icon: 'fa-solid fa-file-invoice-dollar', permissions: ['cuentas.ver'] },
        { label: 'Recordatorios', link: '/cuentas-cobrar/recordatorios', icon: 'fa-solid fa-bell', permissions: ['cuentas.recordatorios'] }
      ],
      expanded: false
    },
    {
      label: 'Cuentas por Pagar',
      icon: 'fa-solid fa-file-invoice-dollar',
      link: '/cuentas-pagar',
      active: false,
      permissions: ['cuentas.ver'],
      submenu: [
        { label: 'Deudas Pendientes', link: '/cuentas-pagar', icon: 'fa-solid fa-exclamation-triangle', permissions: ['cuentas.ver'] },
        { label: 'Nueva Cuenta', link: '/cuentas-pagar/nueva', icon: 'fa-solid fa-plus-circle', permissions: ['cuentas.crear'] }
      ],
      expanded: false
    },
    {
      label: 'Administración',
      icon: 'fa-solid fa-user-gear',
      link: '/admin',
      active: false,
      permissions: ['usuarios.ver', 'roles.ver', 'config.general'],
      submenu: [
        { label: 'Usuarios', link: '/admin/usuarios', icon: 'fa-solid fa-users', permissions: ['usuarios.ver'] },
        { label: 'Roles', link: '/admin/roles', icon: 'fa-solid fa-user-tag', permissions: ['roles.ver'] },
        { label: 'Sucursales', link: '/admin/sucursales', icon: 'fa-solid fa-building', permissions: ['config.general'] },
        { label: 'Sistema', link: '/admin/sistema', icon: 'fa-solid fa-cogs', permissions: ['config.general'], devAdminOnly: true },
        { label: 'Fiscal (DGII)', link: '/admin/fiscal', icon: 'fa-solid fa-file-invoice', permissions: ['config.general'] }
      ],
      expanded: false
    },
    {
      label: 'Reportes',
      icon: 'fa-solid fa-chart-bar',
      link: '/reportes',
      active: false,
      permissions: ['reportes.ventas', 'reportes.inventario', 'reportes.caja', 'reportes.clientes'],
      submenu: [
        { label: 'Reportes de Ventas', link: '/reportes/ventas', icon: 'fa-solid fa-chart-line', permissions: ['reportes.ventas'] },
        { label: 'Reportes de Inventario', link: '/reportes/inventario', icon: 'fa-solid fa-boxes-stacked', permissions: ['reportes.inventario'] },
        { label: 'Reportes de Caja', link: '/reportes/caja', icon: 'fa-solid fa-cash-register', permissions: ['reportes.caja'] },
        { label: 'Reportes de Clientes', link: '/reportes/clientes', icon: 'fa-solid fa-users', permissions: ['reportes.clientes'] },
        { label: 'DGII (606/607/608)', link: '/reportes/dgii', icon: 'fa-solid fa-file-invoice', permissions: ['reportes.ventas'] },
        { label: 'Margen de Ganancia', link: '/reportes/margen', icon: 'fa-solid fa-chart-pie', permissions: ['reportes.ventas'] }
      ],
      expanded: false
    },
    {
      label: 'Panel Dev',
      icon: 'fa-solid fa-code',
      link: '/dev-admin/tenants',
      active: false,
      permissions: [],
      devAdminOnly: true,
      submenu: [
        { label: 'Tenants', link: '/dev-admin/tenants', icon: 'fa-solid fa-building', permissions: [] },
        { label: 'Planes', link: '/dev-admin/plans', icon: 'fa-solid fa-tags', permissions: [] }
      ],
      expanded: false
    }
  ] as any[];

  // Items filtrados por permisos
  menuItemsFiltrados: any[] = [];

  // Filtrar menú por permisos
  filtrarMenuPorPermisos() {
    if (!this.usuario) {
      this.menuItemsFiltrados = [];
      return;
    }

    this.menuItemsFiltrados = this.menuItems.filter((item: any) => {
      // Dev Admin: solo visible para is_dev_admin
      if (item.devAdminOnly) {
        return this.usuario?.is_dev_admin === true;
      }

      // Verificar si el usuario tiene alguno de los permisos requeridos para el item principal
      const tienePermisoItem = !item.permissions ||
        item.permissions.some((permiso: string) => this.authService.tienePermiso(permiso));

      if (!tienePermisoItem) return false;

      // Si tiene submenu, filtrar los subitems
      if (item.submenu) {
        item.submenu = item.submenu.filter((subitem: any) => {
          if (subitem.devAdminOnly && this.usuario?.is_dev_admin !== true) return false;

          return !subitem.permissions ||
            subitem.permissions.some((permiso: string) => this.authService.tienePermiso(permiso));
        });

        // Si no quedan subitems después del filtro, ocultar el item principal
        if (item.submenu.length === 0) return false;
      }

      return true;
    });
  }

  expandirMenuPorRuta(url: string) {
    if (this.isCollapsed) return;
    
    this.menuItemsFiltrados.forEach(item => {
      if (item.submenu) {
        // Verificar si alguna subruta coincide con la URL actual
        const isSubRouteActive = item.submenu.some((sub: any) => url.startsWith(sub.link));
        if (isSubRouteActive) {
          item.expanded = true;
        }
      }
    });
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  toggleSidebar() {
    this.sidebarService.toggleSidebar();
  }

  toggleSubmenu(item: any) {
    const isOpening = !item.expanded;
    
    // Acordeón: Cerrar todos los demás menús antes de abrir el nuevo
    this.menuItemsFiltrados.forEach(i => {
      if (i !== item) i.expanded = false;
    });

    if (this.isCollapsed && isOpening) {
      // Si está colapsado y queremos abrir un menú, expandimos el sidebar primero
      this.sidebarService.toggleSidebar();
    }
    
    item.expanded = isOpening;
  }

  handleMenuClick(event: Event, item: any) {
    if (item.submenu) {
      event.preventDefault(); // Prevenir navegación si tiene submenu
      this.toggleSubmenu(item);
    } else {
      // Si no tiene submenu, es una opción directa -> colapsar sidebar
      this.onOptionSelected();
    }
  }

  // Se llama cuando el usuario selecciona una opción final (link o sublink)
  onOptionSelected() {
    // Colapsar el sidebar (esto lo oculta en móvil o lo reduce en desktop según la lógica del service)
    this.sidebarService.setCollapsed(true);
    // Limpiar estados expandidos para que al volver a abrir esté limpio
    this.menuItemsFiltrados.forEach(item => item.expanded = false);
  }

  // Ir al perfil
  irAPerfil() {
    this.router.navigate(['/perfil']);
  }

  // Cerrar sesión
  async cerrarSesion() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Obtener iniciales del usuario
  obtenerIniciales(): string {
    if (!this.usuario) return 'U';
    return `${this.usuario.nombre.charAt(0)}${this.usuario.apellido.charAt(0)}`.toUpperCase();
  }

  // Obtener color del rol
  obtenerColorRol(): string {
    return this.usuario?.rol?.color || '#3b82f6';
  }

  obtenerPrimerNombre(): string {
    return this.usuario?.nombre ? this.usuario.nombre.split(' ')[0] : 'Usuario';
  }

  // Cambiar sucursal
  cambiarSucursal(sucursalId: string | number) {
    if (this.cambiandoSucursal) return;
    this.cambiandoSucursal = true;
    
    setTimeout(() => {
      const encontrada = this.sucursalesAsignadas.find(s => s.id?.toString() === sucursalId.toString());
      if (encontrada) {
        this.sucursalService.setSucursalActiva(encontrada, true);
        window.location.reload(); 
      }
      this.cambiandoSucursal = false;
    }, 150);
  }
}