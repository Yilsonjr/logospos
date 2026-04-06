import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';
import { Sucursal } from '../models/sucursal.model';

@Injectable({
  providedIn: 'root'
})
export class SucursalService {
  private sucursalesAsignadasSubject = new BehaviorSubject<Sucursal[]>([]);
  public sucursalesAsignadas$ = this.sucursalesAsignadasSubject.asObservable();

  private sucursalActivaSubject = new BehaviorSubject<Sucursal | null>(null);
  public sucursalActiva$ = this.sucursalActivaSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService
  ) {
    this.recuperarSucursalDeCache();
  }

  // Load available branches for a user after login
  async cargarSucursalesUsuario(usuarioId: number): Promise<Sucursal[]> {
    try {
      const tenantId = this.tenantService.getTenantIdOrThrow();
      
      const { data, error } = await this.supabaseService.client
        .from('usuarios_sucursales')
        .select(`
          sucursal_id,
          sucursales (*)
        `)
        .eq('usuario_id', usuarioId)
        .eq('sucursales.tenant_id', tenantId)
        .eq('sucursales.activa', true);

      if (error) throw error;

      // Extract the nested 'sucursales' array/object from the join
      const sucursales: Sucursal[] = data
        ?.map((item: any) => item.sucursales)
        .filter(s => s !== null && s !== undefined) || [];

      this.sucursalesAsignadasSubject.next(sucursales);

      // Auto-assign active branch if they only have one, or restore from cache
      if (sucursales.length > 0) {
        const cachedId = localStorage.getItem('dolvin_sucursal_id');
        const matched = sucursales.find(s => s.id?.toString() === cachedId);
        
        if (matched) {
          this.setSucursalActiva(matched, false);
        } else if (sucursales.length === 1) {
          // If only 1 assigned, default to it
          this.setSucursalActiva(sucursales[0], false);
        }
      } else {
        // Fallback for edge cases, clean state.
        this.limpiarSucursal();
      }

      return sucursales;
    } catch (error) {
      console.error('Error cargando sucursales de usuario:', error);
      return [];
    }
  }

  setSucursalActiva(sucursal: Sucursal, persistToDb: boolean = false): void {
    if (!sucursal || !sucursal.id) return;
    
    this.sucursalActivaSubject.next(sucursal);
    localStorage.setItem('dolvin_sucursal_id', sucursal.id.toString());
    sessionStorage.setItem('dolvin_sucursal_id', sucursal.id.toString());
  }

  get sucursalActiva(): Sucursal | null {
    return this.sucursalActivaSubject.value;
  }

  getSucursalActivaIdOrThrow(): number {
    const s = this.sucursalActivaSubject.value;
    if (!s || !s.id) {
       throw new Error('No hay sucursal activa seleccionada. Por favor seleccione una sucursal.');
    }
    return s.id;
  }

  private recuperarSucursalDeCache() {
    // Only basic ID restoration if needed early, complete object comes from cargarSucursalesUsuario
    const stored = localStorage.getItem('dolvin_sucursal_id') || sessionStorage.getItem('dolvin_sucursal_id');
    if (stored) {
       // We only have the ID, wait for `cargarSucursalesUsuario` to load the full object.
       // Keep this empty for now so we don't dispatch an incomplete object.
    }
  }

  limpiarSucursal(): void {
    this.sucursalActivaSubject.next(null);
    this.sucursalesAsignadasSubject.next([]);
    localStorage.removeItem('dolvin_sucursal_id');
    sessionStorage.removeItem('dolvin_sucursal_id');
  }

  async obtenerTodasSucursales(): Promise<Sucursal[]> {
    try {
      const tenantId = this.tenantService.getTenantIdOrThrow();
      const { data, error } = await this.supabaseService.client
        .from('sucursales')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nombre');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener todas las sucursales:', error);
      return [];
    }
  }

  async crearSucursal(sucursal: Partial<Sucursal>): Promise<Sucursal> {
    try {
      const tenantId = this.tenantService.getTenantIdOrThrow();
      const { data, error } = await this.supabaseService.client
        .from('sucursales')
        .insert([{ ...sucursal, tenant_id: tenantId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al crear sucursal:', error);
      throw error;
    }
  }

  async actualizarSucursal(id: number, sucursal: Partial<Sucursal>): Promise<Sucursal> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('sucursales')
        .update(sucursal)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al actualizar sucursal:', error);
      throw error;
    }
  }
}
