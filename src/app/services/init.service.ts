import { Injectable } from '@angular/core';
import { UsuariosService } from './usuarios.service';
import { CrearUsuario } from '../models/usuario.model';

@Injectable({
  providedIn: 'root'
})
export class InitService {

  constructor(private usuariosService: UsuariosService) {}

  // Inicializar datos de demostración
  async inicializarDatosDemo(): Promise<void> {
    try {
      console.log('🚀 Inicializando datos de demostración...');

      // 1. Crear roles predefinidos
      await this.usuariosService.crearRolesPredefinidos();
      console.log('✅ Roles predefinidos creados');

      // 2. Cargar roles para obtener IDs
      await this.usuariosService.cargarRoles();
      const roles = await this.obtenerRoles();

      // 3. Crear usuarios de demostración
      await this.crearUsuariosDemo(roles);
      console.log('✅ Usuarios de demostración creados');

      console.log('🎉 Inicialización completada exitosamente');

    } catch (error) {
      console.error('❌ Error en inicialización:', error);
      throw error;
    }
  }

  private async obtenerRoles(): Promise<{ [nombre: string]: number }> {
    return new Promise((resolve) => {
      this.usuariosService.roles$.subscribe(roles => {
        const rolesMap: { [nombre: string]: number } = {};
        roles.forEach(rol => {
          if (rol.id) {
            rolesMap[rol.nombre] = rol.id;
          }
        });
        resolve(rolesMap);
      });
    });
  }

  private async crearUsuariosDemo(roles: { [nombre: string]: number }): Promise<void> {
    const usuariosDemo: CrearUsuario[] = [
      {
        nombre: 'Administrador',
        apellido: 'Sistema',
        email: 'admin@dolvinpos.com',
        username: 'admin',
        password: 'admin123',
        telefono: '+1234567890',
        rol_id: roles['Super Administrador'],
        activo: true
      },
      {
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'cajero@dolvinpos.com',
        username: 'cajero',
        password: 'cajero123',
        telefono: '+1234567891',
        rol_id: roles['Cajero'],
        activo: true
      },
      {
        nombre: 'María',
        apellido: 'González',
        email: 'vendedor@dolvinpos.com',
        username: 'vendedor',
        password: 'vendedor123',
        telefono: '+1234567892',
        rol_id: roles['Vendedor'],
        activo: true
      },
      {
        nombre: 'Carlos',
        apellido: 'Rodríguez',
        email: 'supervisor@dolvinpos.com',
        username: 'supervisor',
        password: 'supervisor123',
        telefono: '+1234567893',
        rol_id: roles['Administrador'],
        activo: true
      },
      {
        nombre: 'Ana',
        apellido: 'López',
        email: 'consulta@dolvinpos.com',
        username: 'consulta',
        password: 'consulta123',
        telefono: '+1234567894',
        rol_id: roles['Solo Lectura'],
        activo: true
      }
    ];

    for (const usuarioData of usuariosDemo) {
      try {
        // Verificar si el usuario ya existe
        const existeUsuario = await this.verificarUsuarioExiste(usuarioData.username);
        
        if (!existeUsuario) {
          await this.usuariosService.crearUsuario(usuarioData);
          console.log(`✅ Usuario creado: ${usuarioData.username}`);
        } else {
          console.log(`ℹ️ Usuario ya existe: ${usuarioData.username}`);
        }
      } catch (error) {
        console.error(`❌ Error creando usuario ${usuarioData.username}:`, error);
      }
    }
  }

  private async verificarUsuarioExiste(username: string): Promise<boolean> {
    try {
      // Esta función debería verificar en la base de datos si el usuario existe
      // Por ahora retornamos false para permitir la creación
      return false;
    } catch (error) {
      return false;
    }
  }

  // Método para mostrar información de usuarios demo
  mostrarInformacionDemo(): void {
    console.log(`
🎯 USUARIOS DE DEMOSTRACIÓN DISPONIBLES:

👑 SUPER ADMINISTRADOR
   Usuario: admin
   Contraseña: admin123
   Permisos: Acceso completo al sistema

🔧 ADMINISTRADOR  
   Usuario: supervisor
   Contraseña: supervisor123
   Permisos: Gestión completa excepto usuarios

💰 CAJERO
   Usuario: cajero
   Contraseña: cajero123
   Permisos: Operaciones de caja y ventas

🛒 VENDEDOR
   Usuario: vendedor
   Contraseña: vendedor123
   Permisos: Solo ventas y consultas básicas

👁️ SOLO LECTURA
   Usuario: consulta
   Contraseña: consulta123
   Permisos: Solo consultas, sin modificaciones

🚀 Para inicializar los datos, ejecuta:
   initService.inicializarDatosDemo()
    `);
  }
}