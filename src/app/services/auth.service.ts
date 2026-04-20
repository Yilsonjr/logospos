import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { SucursalService } from './sucursal.service';
import { Usuario, Rol, LoginCredentials, LoginResponse, AuthState, Sesion } from '../models/usuario.model';
import { Router } from '@angular/router';
import bcrypt from 'bcryptjs';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authStateSubject = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    usuario: null,
    token: null,
    permisos: []
  });

  public authState$ = this.authStateSubject.asObservable();

  // Emite `true` cuando initializeAuth() ha terminado (éxito o fallo)
  private initializedSubject = new BehaviorSubject<boolean>(false);
  public initialized$ = this.initializedSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService,
    private sucursalService: SucursalService,
    private router: Router
  ) {
    this.initializeAuth();
  }

  // Inicializar autenticación al cargar la app
  private async initializeAuth() {
    try {
      // Intentar recuperar de localStorage o sessionStorage
      let token = localStorage.getItem('dolvin_token') || sessionStorage.getItem('dolvin_token');
      let usuarioData = localStorage.getItem('dolvin_usuario') || sessionStorage.getItem('dolvin_usuario');

      if (token && usuarioData) {
        const usuario = JSON.parse(usuarioData);

        // Restore tenant context
        if (usuario.tenant_id) {
          this.tenantService.setTenantId(usuario.tenant_id);
          this.sucursalService.cargarSucursalesUsuario(usuario.id);
          // Cargar features del tenant en background
          this.cargarFeaturesTenant(usuario.tenant_id);
        }

        // Verificar validez del token ANTES de marcar como autenticado
        const isValid = await this.verificarToken(token);

        if (isValid) {
          const permisos = await this.cargarPermisosUsuario(usuario.id);
          this.authStateSubject.next({
            isAuthenticated: true,
            usuario,
            token,
            permisos
          });
        } else {
          console.warn('Token inválido o expirado durante inicialización');
          // Limpiar sin llamar logout() para evitar redirección circular antes de que el guard esté listo
          localStorage.removeItem('dolvin_token');
          localStorage.removeItem('dolvin_usuario');
          sessionStorage.removeItem('dolvin_token');
          sessionStorage.removeItem('dolvin_usuario');
        }
      }
    } catch (error) {
      console.error('Error al inicializar autenticación:', error);
      localStorage.removeItem('dolvin_token');
      localStorage.removeItem('dolvin_usuario');
      sessionStorage.removeItem('dolvin_token');
      sessionStorage.removeItem('dolvin_usuario');
    } finally {
      // Siempre señalar que la inicialización terminó
      this.initializedSubject.next(true);
    }
  }

  // Login
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Buscar usuario por username o email
      const { data: usuario, error: errorUsuario } = await this.supabaseService.client
        .from('usuarios')
        .select('*')
        .or(`username.ilike.${credentials.username},email.ilike.${credentials.username}`)
        .eq('activo', true)
        .single();

      if (errorUsuario || !usuario) {
        throw new Error('Usuario no encontrado o inactivo');
      }

      // Set tenant context immediately
      if (usuario.tenant_id) {
        this.tenantService.setTenantId(usuario.tenant_id);
        // Cargar features del tenant
        await this.cargarFeaturesTenant(usuario.tenant_id);

        // Kill Switch: Check tenant status (skip for dev admins)
        if (!usuario.is_dev_admin) {
          const { data: tenant } = await this.supabaseService.client
            .from('tenants')
            .select('estado')
            .eq('id', usuario.tenant_id)
            .single();

          if (tenant?.estado === 'suspendido') {
            this.tenantService.clear();
            throw new Error('Su cuenta ha sido suspendida. Contacte al administrador del sistema.');
          }
          if (tenant?.estado === 'vencido') {
            this.tenantService.clear();
            throw new Error('Su suscripción ha vencido. Contacte al administrador para renovar.');
          }
        }
      }

      // Cargar información del rol por separado
      const { data: rol, error: errorRol } = await this.supabaseService.client
        .from('roles')
        .select('*')
        .eq('id', usuario.rol_id)
        .single();

      if (!errorRol && rol) {
        usuario.rol = rol;
      }

      // Verificar contraseña (implementación con Bcrypt y Migración Lazy)
      let esValida = false;
      let esHashVálido = false;

      try {
        // Intentar comparar como Hash primero
        esValida = bcrypt.compareSync(credentials.password, usuario.password);
        esHashVálido = true;
      } catch (e) {
        // Si falla compareSync, el valor en BD no es un hash válido (es texto plano)
        esHashVálido = false;
      }

      // Si no es válida vía hash O el formato no era de hash, intentamos texto plano (Migración)
      if (!esValida) {
        const esTextoPlanoIgual = usuario.password === credentials.password;

        if (esTextoPlanoIgual) {
          esValida = true;
          // Si el formato no era hash, migramos a uno seguro ahora mismo
          if (!esHashVálido) {
            console.log('🔄 Migrando contraseña de texto plano a Hash para:', usuario.username);
            try {
              const passwordHasheada = bcrypt.hashSync(credentials.password, 10);
              await this.supabaseService.client
                .from('usuarios')
                .update({
                  password: passwordHasheada,
                  updated_at: new Date().toISOString()
                })
                .eq('id', usuario.id);
            } catch (err) {
              console.error('⚠️ Error al migrar contraseña:', err);
              // No bloqueamos el login aunque falle la actualización del hash
            }
          }
        }
      }

      if (!esValida) {
        throw new Error('Contraseña incorrecta');
      }

      // Generar token de sesión
      const token = this.generarToken();
      const expiracion = new Date();
      expiracion.setHours(expiracion.getHours() + (credentials.recordar ? 24 * 7 : 8));

      // Crear sesión en BD
      const sesion: Omit<Sesion, 'id'> = {
        usuario_id: usuario.id,
        token,
        fecha_inicio: new Date().toISOString(),
        fecha_expiracion: expiracion.toISOString(),
        ip_address: await this.obtenerIP(),
        user_agent: navigator.userAgent,
        activa: true
      };

      // Include tenant_id in session if available
      const sesionPayload: any = { ...sesion };
      if (usuario.tenant_id) {
        sesionPayload.tenant_id = usuario.tenant_id;
      }

      await this.supabaseService.client
        .from('sesiones')
        .insert([sesionPayload]);

      // Actualizar último acceso
      await this.supabaseService.client
        .from('usuarios')
        .update({ ultimo_acceso: new Date().toISOString() })
        .eq('id', usuario.id);

      // Cargar permisos
      const permisos = await this.cargarPermisosUsuario(usuario.id);

      // Guardar en localStorage
      if (credentials.recordar) {
        localStorage.setItem('dolvin_token', token);
        localStorage.setItem('dolvin_usuario', JSON.stringify(usuario));
      } else {
        sessionStorage.setItem('dolvin_token', token);
        sessionStorage.setItem('dolvin_usuario', JSON.stringify(usuario));
      }

      // Load branch assignments for this user
      await this.sucursalService.cargarSucursalesUsuario(usuario.id);

      // Actualizar estado
      this.authStateSubject.next({
        isAuthenticated: true,
        usuario,
        token,
        permisos
      });

      const response: LoginResponse = {
        usuario,
        token,
        expiracion: expiracion.toISOString()
      };

      return response;

    } catch (error: any) {
      console.error('Error en login:', error);
      throw new Error(error.message || 'Error al iniciar sesión');
    }
  }

  // Logout
  async logout() {
    try {
      const currentState = this.authStateSubject.value;

      if (currentState.token) {
        // Marcar sesión como inactiva
        await this.supabaseService.client
          .from('sesiones')
          .update({ activa: false })
          .eq('token', currentState.token);
      }

      // Limpiar almacenamiento
      localStorage.removeItem('dolvin_token');
      localStorage.removeItem('dolvin_usuario');
      sessionStorage.removeItem('dolvin_token');
      sessionStorage.removeItem('dolvin_usuario');

      // Clear tenant and branch context
      this.tenantService.clear();
      this.sucursalService.limpiarSucursal();

      // Actualizar estado
      this.authStateSubject.next({
        isAuthenticated: false,
        usuario: null,
        token: null,
        permisos: []
      });

      // Redirigir al login
      this.router.navigate(['/login']);

    } catch (error) {
      console.error('Error en logout:', error);
    }
  }

  // Verificar si el usuario tiene un permiso específico
  tienePermiso(permiso: string): boolean {
    const currentState = this.authStateSubject.value;
    // Si es administrador (rol_id 1 o nombre 'admin'), tiene acceso total
    if (currentState.usuario?.rol_id === 1 || currentState.usuario?.rol?.nombre.toLowerCase() === 'admin') {
      return true;
    }
    return currentState.permisos.includes(permiso);
  }

  // Verificar si el usuario tiene alguno de los permisos
  tieneAlgunPermiso(permisos: string[]): boolean {
    const currentState = this.authStateSubject.value;

    // Si es administrador, acceso total
    if (currentState.usuario?.rol_id === 1 || currentState.usuario?.rol?.nombre.toLowerCase() === 'admin') {
      return true;
    }

    return permisos.some(permiso => currentState.permisos.includes(permiso));
  }

  // Verificar si el usuario tiene todos los permisos
  tieneTodosPermisos(permisos: string[]): boolean {
    const currentState = this.authStateSubject.value;

    // Si es administrador, acceso total
    if (currentState.usuario?.rol_id === 1 || currentState.usuario?.rol?.nombre.toLowerCase() === 'admin') {
      return true;
    }

    return permisos.every(permiso => currentState.permisos.includes(permiso));
  }

  // Obtener usuario actual
  get usuarioActual(): Usuario | null {
    return this.authStateSubject.value.usuario;
  }

  // Verificar si está autenticado
  get isAuthenticated(): boolean {
    return this.authStateSubject.value.isAuthenticated;
  }

  // Cargar permisos del usuario
  private async cargarPermisosUsuario(usuarioId: number): Promise<string[]> {
    try {
      // Primero obtener el rol_id del usuario
      const { data: usuario, error: errorUsuario } = await this.supabaseService.client
        .from('usuarios')
        .select('rol_id')
        .eq('id', usuarioId)
        .single();

      if (errorUsuario || !usuario) {
        return [];
      }

      // Luego obtener los permisos del rol
      const { data: rol, error: errorRol } = await this.supabaseService.client
        .from('roles')
        .select('permisos')
        .eq('id', usuario.rol_id)
        .single();

      if (errorRol || !rol) {
        return [];
      }

      return rol.permisos || [];
    } catch (error) {
      console.error('Error al cargar permisos:', error);
      return [];
    }
  }

  // Verificar validez del token
  private async verificarToken(token: string): Promise<boolean> {
    try {
      const { data: sesion, error } = await this.supabaseService.client
        .from('sesiones')
        .select('fecha_expiracion, activa')
        .eq('token', token)
        .eq('activa', true)
        .single();

      if (error || !sesion) {
        return false;
      }

      const ahora = new Date();
      const expiracion = new Date(sesion.fecha_expiracion);

      return ahora < expiracion;
    } catch (error) {
      console.error('Error al verificar token:', error);
      return false;
    }
  }

  // Cargar features efectivas del tenant (plan + overrides)
  private async cargarFeaturesTenant(tenantId: string): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('tenants')
        .select('features_override, planes(features)')
        .eq('id', tenantId)
        .single();

      if (error || !data) return;

      const planFeatures: Record<string, boolean> = (data as any).planes?.features || {};
      const overrides: Record<string, boolean> = (data as any).features_override || {};
      const efectivas: Record<string, boolean> = { ...planFeatures, ...overrides };

      this.tenantService.setFeatures(efectivas);
    } catch (error) {
      console.error('Error al cargar features del tenant:', error);
    }
  }

  // Generar token único
  private generarToken(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return `dolvin_${timestamp}_${random}`;
  }

  // Obtener IP del usuario (simulado)
  private async obtenerIP(): Promise<string> {
    try {
      // En producción, usar un servicio real para obtener la IP
      return '127.0.0.1';
    } catch (error) {
      return 'unknown';
    }
  }

  // Cambiar contraseña
  async cambiarContrasena(contrasenaActual: string, contrasenaNueva: string): Promise<void> {
    try {
      const usuario = this.usuarioActual;
      if (!usuario) {
        throw new Error('No hay usuario autenticado');
      }

      // Verificar contraseña actual
      const { data: usuarioData, error } = await this.supabaseService.client
        .from('usuarios')
        .select('password')
        .eq('id', usuario.id)
        .single();

      if (error || !usuarioData) {
        throw new Error('Contraseña actual incorrecta');
      }

      const passwordActualDB = usuarioData.password as string; // Ensure it's treated as a string

      let actualValida = false;
      try {
        actualValida = bcrypt.compareSync(contrasenaActual, passwordActualDB);
      } catch (e) {
        // Caso borde: Si aún es texto plano
        actualValida = passwordActualDB === contrasenaActual;
      }

      if (!actualValida) {
        throw new Error('Contraseña actual incorrecta');
      }

      // Hashear nueva contraseña
      const nuevaHash = bcrypt.hashSync(contrasenaNueva, 10);

      // Actualizar contraseña
      await this.supabaseService.client
        .from('usuarios')
        .update({
          password: nuevaHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', usuario.id);

      await Swal.fire({
        title: '✅ Contraseña Actualizada',
        text: 'Tu contraseña ha sido cambiada exitosamente',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);
      throw new Error(error.message || 'Error al cambiar contraseña');
    }
  }

  // Obtener sesiones activas del usuario
  async obtenerSesionesActivas(): Promise<Sesion[]> {
    try {
      const usuario = this.usuarioActual;
      if (!usuario) return [];

      const { data, error } = await this.supabaseService.client
        .from('sesiones')
        .select('*')
        .eq('usuario_id', usuario.id)
        .eq('activa', true)
        .order('fecha_inicio', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener sesiones:', error);
      return [];
    }
  }

  // Cerrar sesión específica
  async cerrarSesion(sesionId: number): Promise<void> {
    try {
      await this.supabaseService.client
        .from('sesiones')
        .update({ activa: false })
        .eq('id', sesionId);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  }

  // Cerrar todas las sesiones excepto la actual
  async cerrarTodasLasSesiones(): Promise<void> {
    try {
      const usuario = this.usuarioActual;
      const tokenActual = this.authStateSubject.value.token;

      if (!usuario || !tokenActual) return;

      await this.supabaseService.client
        .from('sesiones')
        .update({ activa: false })
        .eq('usuario_id', usuario.id)
        .neq('token', tokenActual);

      await Swal.fire({
        title: 'Sesiones Cerradas',
        text: 'Se han cerrado todas las demás sesiones activas',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

    } catch (error) {
      console.error('Error al cerrar sesiones:', error);
      throw error;
    }
  }
}