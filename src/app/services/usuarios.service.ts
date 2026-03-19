import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { Usuario, Rol, CrearUsuario, ActualizarUsuario, CrearRol, ROLES_PREDEFINIDOS } from '../models/usuario.model';
import bcrypt from 'bcryptjs';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {
  private usuariosSubject = new BehaviorSubject<Usuario[]>([]);
  public usuarios$ = this.usuariosSubject.asObservable();

  private rolesSubject = new BehaviorSubject<Rol[]>([]);
  public roles$ = this.rolesSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService
  ) { }

  // ==================== USUARIOS ====================

  // Cargar todos los usuarios
  async cargarUsuarios(): Promise<void> {
    try {
      const tenantId = this.tenantService.getTenantIdOrThrow();
      const { data, error } = await this.supabaseService.client
        .from('usuarios')
        .select(`
          *,
          roles (*)
        `)
        .eq('tenant_id', tenantId)
        .order('nombre', { ascending: true });

      if (error) throw error;

      const usuariosConRol = data?.map(usuario => ({
        ...usuario,
        rol: usuario.roles
      })) || [];

      this.usuariosSubject.next(usuariosConRol);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      throw error;
    }
  }

  // Crear usuario
  async crearUsuario(usuario: CrearUsuario): Promise<Usuario> {
    try {
      // Verificar que el username y email sean únicos
      const { data: existeUsuario } = await this.supabaseService.client
        .from('usuarios')
        .select('id')
        .or(`username.eq.${usuario.username},email.eq.${usuario.email}`)
        .maybeSingle();

      if (existeUsuario) {
        throw new Error('El nombre de usuario o email ya existe');
      }

      const passwordPlana = usuario.password as string;

      // Hashear contraseña antes de insertar
      const passwordHasheada = bcrypt.hashSync(passwordPlana, 10);

      // Inject tenant_id if not present
      const usuarioConTenant = {
        ...usuario,
        password: passwordHasheada,
        tenant_id: (usuario as any).tenant_id || this.tenantService.getTenantIdOrThrow()
      };

      const { data, error } = await this.supabaseService.client
        .from('usuarios')
        .insert([usuarioConTenant])
        .select(`
          *,
          roles (*)
        `)
        .single();

      if (error) throw error;

      await this.cargarUsuarios();
      return {
        ...data,
        rol: data.roles
      };
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  }

  // Actualizar usuario
  async actualizarUsuario(id: number, usuario: ActualizarUsuario): Promise<Usuario> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('usuarios')
        .update({
          ...usuario,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          roles (*)
        `)
        .maybeSingle();

      if (error) throw error;

      // Si no devuelve datos, recargamos igualmente y retornamos el usuario actual
      await this.cargarUsuarios();

      if (!data) {
        // La actualización fue exitosa pero Supabase no devolvió datos (p.ej. RLS)
        const actualizado = this.usuariosSubject.value.find(u => u.id === id);
        if (actualizado) return actualizado;
        throw new Error('No se pudo verificar la actualización del usuario.');
      }

      return {
        ...data,
        rol: data.roles
      };
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      throw error;
    }
  }

  // Desactivar usuario
  async desactivarUsuario(id: number): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('usuarios')
        .update({
          activo: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Cerrar todas las sesiones activas del usuario
      await this.supabaseService.client
        .from('sesiones')
        .update({ activa: false })
        .eq('usuario_id', id);

      await this.cargarUsuarios();
    } catch (error) {
      console.error('Error al desactivar usuario:', error);
      throw error;
    }
  }

  // Activar usuario
  async activarUsuario(id: number): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('usuarios')
        .update({
          activo: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await this.cargarUsuarios();
    } catch (error) {
      console.error('Error al activar usuario:', error);
      throw error;
    }
  }

  // Resetear contraseña
  async resetearContrasena(id: number, nuevaContrasena: string): Promise<void> {
    try {
      // Hashear nueva contraseña
      const passwordHasheada = bcrypt.hashSync(nuevaContrasena, 10);

      const { error } = await this.supabaseService.client
        .from('usuarios')
        .update({
          password: passwordHasheada,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Cerrar todas las sesiones activas del usuario para forzar re-login
      await this.supabaseService.client
        .from('sesiones')
        .update({ activa: false })
        .eq('usuario_id', id);

    } catch (error) {
      console.error('Error al resetear contraseña:', error);
      throw error;
    }
  }

  // ==================== ROLES ====================

  // Cargar todos los roles (globales y del tenant actual)
  async cargarRoles(): Promise<void> {
    try {
      const tenantId = this.tenantService.getTenantIdOrThrow();
      const { data, error } = await this.supabaseService.client
        .from('roles')
        .select('*')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`) // Roles propios del tenant o roles globales
        .eq('activo', true)            // Solo activos
        .order('nombre', { ascending: true });

      if (error) throw error;
      this.rolesSubject.next(data || []);
    } catch (error) {
      console.error('Error al cargar roles:', error);
      throw error;
    }
  }


  // Crear rol
  async crearRol(rol: CrearRol): Promise<Rol> {
    try {
      // Verificar que el nombre sea único
      const { data: existeRol } = await this.supabaseService.client
        .from('roles')
        .select('id')
        .eq('nombre', rol.nombre)
        .maybeSingle();

      if (existeRol) {
        throw new Error('Ya existe un rol con ese nombre');
      }

      const { data, error } = await this.supabaseService.client
        .from('roles')
        .insert([rol])
        .select()
        .single();

      if (error) throw error;

      await this.cargarRoles();
      return data;
    } catch (error) {
      console.error('Error al crear rol:', error);
      throw error;
    }
  }

  // Actualizar rol
  async actualizarRol(id: number, rol: Partial<CrearRol>): Promise<Rol> {
    try {
      // Si se está actualizando el nombre, verificar unicidad
      if (rol.nombre) {
        const { data: existeRol } = await this.supabaseService.client
          .from('roles')
          .select('id')
          .eq('nombre', rol.nombre)
          .neq('id', id)
          .maybeSingle();

        if (existeRol) {
          throw new Error('Ya existe un rol con ese nombre');
        }
      }

      const { data, error } = await this.supabaseService.client
        .from('roles')
        .update({
          ...rol,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await this.cargarRoles();
      return data;
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      throw error;
    }
  }

  // Desactivar rol
  async desactivarRol(id: number): Promise<void> {
    try {
      // Verificar que no haya usuarios activos con este rol
      const { data: usuariosConRol } = await this.supabaseService.client
        .from('usuarios')
        .select('id')
        .eq('rol_id', id)
        .eq('activo', true);

      if (usuariosConRol && usuariosConRol.length > 0) {
        throw new Error('No se puede desactivar un rol que tiene usuarios activos asignados');
      }

      const { error } = await this.supabaseService.client
        .from('roles')
        .update({
          activo: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await this.cargarRoles();
    } catch (error) {
      console.error('Error al desactivar rol:', error);
      throw error;
    }
  }

  // Activar rol
  async activarRol(id: number): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('roles')
        .update({
          activo: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await this.cargarRoles();
    } catch (error) {
      console.error('Error al activar rol:', error);
      throw error;
    }
  }

  // ==================== INICIALIZACIÓN ====================

  // Crear roles predefinidos (ejecutar una sola vez)
  async crearRolesPredefinidos(): Promise<void> {
    try {
      for (const rolData of ROLES_PREDEFINIDOS) {
        // Verificar si ya existe
        const { data: existeRol } = await this.supabaseService.client
          .from('roles')
          .select('id')
          .eq('nombre', rolData.nombre)
          .maybeSingle();

        if (!existeRol) {
          await this.crearRol({
            ...rolData,
            permisos: [...rolData.permisos] // Convertir readonly array a mutable array
          });
        }
      }
    } catch (error) {
      console.error('Error al crear roles predefinidos:', error);
      throw error;
    }
  }

  // Crear usuario administrador inicial
  async crearUsuarioAdmin(datosAdmin: CrearUsuario): Promise<Usuario> {
    try {
      // Buscar rol de Super Administrador
      const { data: rolAdmin } = await this.supabaseService.client
        .from('roles')
        .select('id')
        .eq('nombre', 'Super Administrador')
        .single();

      if (!rolAdmin) {
        throw new Error('Rol de Super Administrador no encontrado');
      }

      const usuarioAdmin: CrearUsuario = {
        ...datosAdmin,
        rol_id: rolAdmin.id,
        activo: true
      };

      return await this.crearUsuario(usuarioAdmin);
    } catch (error) {
      console.error('Error al crear usuario admin:', error);
      throw error;
    }
  }

  // ==================== UTILIDADES ====================

  // Obtener usuarios por rol
  async obtenerUsuariosPorRol(rolId: number): Promise<Usuario[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('usuarios')
        .select(`
          *,
          roles (*)
        `)
        .eq('rol_id', rolId)
        .eq('activo', true);

      if (error) throw error;

      return data?.map(usuario => ({
        ...usuario,
        rol: usuario.roles
      })) || [];
    } catch (error) {
      console.error('Error al obtener usuarios por rol:', error);
      return [];
    }
  }

  // Obtener estadísticas de usuarios
  async obtenerEstadisticasUsuarios(): Promise<{
    total: number;
    activos: number;
    inactivos: number;
    porRol: { rol: string; cantidad: number; color: string }[];
  }> {
    try {
      const usuarios = this.usuariosSubject.value;
      const roles = this.rolesSubject.value;

      const total = usuarios.length;
      const activos = usuarios.filter(u => u.activo).length;
      const inactivos = total - activos;

      const porRol = roles.map(rol => ({
        rol: rol.nombre,
        cantidad: usuarios.filter(u => u.rol_id === rol.id && u.activo).length,
        color: rol.color
      }));

      return {
        total,
        activos,
        inactivos,
        porRol
      };
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return {
        total: 0,
        activos: 0,
        inactivos: 0,
        porRol: []
      };
    }
  }
}