import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class ImagenService {
  // Buckets conocidos
  private readonly BUCKET_PRODUCTOS = 'productos-imagenes';
  private readonly BUCKET_LOGOS = 'logos-tenants';

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Subir imagen a Supabase Storage
   * @param file Archivo de imagen
   * @param prefix Prefijo para el nombre del archivo
   * @param bucket Bucket destino (por defecto productos)
   */
  async subirImagen(
    file: File, 
    prefix: string = 'img', 
    bucket: string = this.BUCKET_PRODUCTOS
  ): Promise<{ url: string; nombre: string }> {
    try {
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const nombreArchivo = `${prefix}_${timestamp}.${extension}`;

      const { data, error } = await this.supabaseService.client.storage
        .from(bucket)
        .upload(nombreArchivo, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: urlData } = this.supabaseService.client.storage
        .from(bucket)
        .getPublicUrl(nombreArchivo);

      return {
        url: urlData.publicUrl,
        nombre: nombreArchivo
      };
    } catch (error) {
      console.error('Error en subirImagen:', error);
      throw error;
    }
  }

  /**
   * Eliminar imagen de Supabase Storage
   */
  async eliminarImagen(nombreArchivo: string, bucket: string = this.BUCKET_PRODUCTOS): Promise<void> {
    try {
      const { error } = await this.supabaseService.client.storage
        .from(bucket)
        .remove([nombreArchivo]);

      if (error) throw error;
    } catch (error) {
      console.error('Error en eliminarImagen:', error);
      throw error;
    }
  }

  /**
   * Actualizar imagen
   */
  async actualizarImagen(
    file: File, 
    imagenAnterior: string | undefined, 
    prefix: string = 'img',
    bucket: string = this.BUCKET_PRODUCTOS
  ): Promise<{ url: string; nombre: string }> {
    if (imagenAnterior) {
      await this.eliminarImagen(imagenAnterior, bucket).catch(() => {});
    }
    return await this.subirImagen(file, prefix, bucket);
  }

  /**
   * Métodos específicos para facilitar el uso (Compatibilidad y Claridad)
   */
  
  async subirLogo(file: File, tenantId: string): Promise<{ url: string; nombre: string }> {
    return this.subirImagen(file, `logo_${tenantId}`, this.BUCKET_LOGOS);
  }

  async actualizarLogo(file: File, logoAnterior: string | undefined, tenantId: string): Promise<{ url: string; nombre: string }> {
    return this.actualizarImagen(file, logoAnterior, `logo_${tenantId}`, this.BUCKET_LOGOS);
  }

  validarImagen(file: File): { valido: boolean; mensaje?: string } {
    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
      return { valido: false, mensaje: 'Solo se permiten imágenes JPG, PNG o WebP' };
    }
    const tamañoMaximo = 5 * 1024 * 1024;
    if (file.size > tamañoMaximo) {
      return { valido: false, mensaje: 'La imagen no debe superar los 5MB' };
    }
    return { valido: true };
  }
}
