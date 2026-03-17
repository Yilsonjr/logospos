import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.SUPABASE_URL,
      environment.SUPABASE_KEY
    );
  }

  // Getter para acceder al cliente de Supabase
  get client() {
    return this.supabase;
  }

  // Método para probar la conexión
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('productos')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Error de conexión:', error);
        return false;
      }
      
      console.log('✅ Conexión exitosa a Supabase');
      return true;
    } catch (error) {
      console.error('❌ Error al conectar con Supabase:', error);
      return false;
    }
  }
}