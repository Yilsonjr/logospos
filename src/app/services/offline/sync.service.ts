import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { SupabaseService } from '../supabase.service';
import { TenantService } from '../tenant.service';
import { DbService, VentaPendiente } from './db.service';
import { VentasService } from '../ventas.service';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private isOnlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  public isOnline$ = this.isOnlineSubject.asObservable();

  private pendingCountSubject = new BehaviorSubject<number>(0);
  public pendingCount$ = this.pendingCountSubject.asObservable();

  private isSyncingSubject = new BehaviorSubject<boolean>(false);
  public isSyncing$ = this.isSyncingSubject.asObservable();

  private syncInterval?: Subscription;

  constructor(
    private supabaseService: SupabaseService,
    private tenantService: TenantService,
    private db: DbService,
    private ventasService: VentasService,
    private ngZone: NgZone
  ) {
    this.iniciarListenersRed();
    this.actualizarContadorPendientes();

    // Automatically re-sync catalogs when a tenant logs in
    this.tenantService.tenantId$.subscribe(tenantId => {
      if (tenantId && this.isOnlineSubject.value) {
        this.descargarCatalogos().catch(e => console.error('Error downloading initial catalogs:', e));
      }
    });
  }

  // Detecta cambios en la conectividad del navegador
  private iniciarListenersRed() {
    window.addEventListener('online', () => {
      this.ngZone.run(() => {
        this.isOnlineSubject.next(true);
        this.sincronizarVentasPendientes();
      });
    });

    window.addEventListener('offline', () => {
      this.ngZone.run(() => {
        this.isOnlineSubject.next(false);
      });
    });

    // Validar pendientes cada 30 segundos si hay internet
    this.syncInterval = interval(30000).subscribe(() => {
      if (this.isOnlineSubject.value && !this.isSyncingSubject.value) {
        this.sincronizarVentasPendientes();
      }
    });

    // Validar pendientes locales de manera silenciosa
    this.db.ventasPendientes.hook('creating', () => {
      setTimeout(() => this.actualizarContadorPendientes(), 100);
    });
    this.db.ventasPendientes.hook('deleting', () => {
      setTimeout(() => this.actualizarContadorPendientes(), 100);
    });
  }

  // Revisa la cantidad de facturas pendientes en DB local
  public async actualizarContadorPendientes() {
    const tenantId = this.tenantService.tenantId;
    if (!tenantId) {
      this.pendingCountSubject.next(0);
      return;
    }

    try {
        const count = await this.db.ventasPendientes
            .where('tenant_id')
            .equals(tenantId)
            .count();
        this.ngZone.run(() => {
            this.pendingCountSubject.next(count);
        });
    } catch(err) {
        console.warn('Error counting offline DB queue', err);
    }
  }

  // --- OPERACIONES HACIA ABAJO (DOWNSTREAM) ---
  // Descargar catálogos completos para consulta offline
  public async descargarCatalogos() {
    const tenantId = this.tenantService.tenantId;
    if (!tenantId || !this.isOnlineSubject.value) return;

    this.isSyncingSubject.next(true);

    try {
      // 1. Descargar Productos
      const { data: prods, error: pErr } = await this.supabaseService.client
        .from('productos')
        .select(`*, categorias (nombre)`)
        .eq('tenant_id', tenantId);

      if (!pErr && prods) {
        const localProds = prods.map(p => ({
          ...p,
          categoria: p.categorias?.nombre || 'Sin Categoría',
          stock: p.stock_actual
        }));
        await this.db.productos.bulkPut(localProds);
      }

      // 2. Descargar Clientes
      const { data: clis, error: cErr } = await this.supabaseService.client
        .from('clientes')
        .select('*')
        .eq('tenant_id', tenantId);

      if (!cErr && clis) {
        await this.db.clientes.bulkPut(clis);
      }

    } catch (error) {
      console.error('Error sincronizando catálogos al iniciar offline mode', error);
    } finally {
      this.isSyncingSubject.next(false);
    }
  }

  // --- OPERACIONES HACIA ARRIBA (UPSTREAM) ---
  // Empujar ventas atrapadas al servidor de Supabase
  public async sincronizarVentasPendientes() {
    if (!this.isOnlineSubject.value || this.isSyncingSubject.value) return;

    const tenantId = this.tenantService.tenantId;
    if (!tenantId) return;

    this.isSyncingSubject.next(true);

    try {
        const pendientes = await this.db.ventasPendientes
            .where('tenant_id').equals(tenantId)
            .toArray();

        for (const venta of pendientes) {
            try {
                // Forzamos el envío usando el endpoint nativo de Supabase en VentasService
                await this.ventasService.crearVenta(venta.payload);
                
                // Si triunfa, la removemos de la cola offline
                if (venta.id) {
                    await this.db.ventasPendientes.delete(venta.id);
                }
            } catch (e: any) {
                console.warn(`No se pudo sincronizar la venta offline ID ${venta.id}:`, e);
                // Si falla 5 veces por algún error extraño (stock insuficiente severo, error 500), no borrar todavía pero guardar tracking
                if (venta.id && (venta.intentos || 0) < 5) {
                    await this.db.ventasPendientes.update(venta.id, {
                        intentos: (venta.intentos || 0) + 1,
                        error_message: e.message || 'Error desconocido'
                    });
                } else if(venta.id && (venta.intentos || 0) >= 5) {
                     // Si falló DEMASIADAS veces no se empujará para evitar trancar la cola (requeriría una resolución manual u override).
                     // Para MVP temporal, la dejaremos en BD con status de err forzosa.
                }
            }
        }
    } catch(err) {
        console.error('Crash in Offline Queue Loop', err);
    } finally {
        await this.actualizarContadorPendientes();
        this.isSyncingSubject.next(false);
    }
  }

  public trackVentaOffline(payload: any) {
      const tenantId = this.tenantService.getTenantIdOrThrow();
      const pendVenta: VentaPendiente = {
          tenant_id: tenantId,
          payload: payload,
          fecha: new Date().toISOString(),
          intentos: 0
      };

      return this.db.ventasPendientes.add(pendVenta);
  }

  // Método check público para saber si estamos offline
  public isOffline(): boolean {
     return !this.isOnlineSubject.value;
  }
}
