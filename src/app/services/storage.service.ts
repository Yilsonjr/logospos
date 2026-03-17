import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly BUCKET_NAME = 'productos-imagenes';

  constructor(private supabase: SupabaseService) { }

  /**
   * Subir imagen de producto
   */
  async subirImagenProducto(file: File, productoId?: number): Promise<{ url: string; nombre: string }> {
    try {
      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const nombreArchivo = productoId
        ? `producto-${productoId}-${timestamp}.${extension}`
        : `producto-temp-${timestamp}.${extension}`;

      // Subir archivo
      const { data, error } = await this.supabase.client.storage
        .from(this.BUCKET_NAME)
        .upload(nombreArchivo, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw new Error(`Error al subir imagen: ${error.message}`);
      }

      // Obtener URL pública
      const { data: urlData } = this.supabase.client.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(nombreArchivo);

      return {
        url: urlData.publicUrl,
        nombre: nombreArchivo
      };

    } catch (error: any) {
      console.error('Error en subirImagenProducto:', error);
      throw new Error(error.message || 'Error al subir la imagen');
    }
  }

  /**
   * Eliminar imagen de producto
   */
  async eliminarImagenProducto(nombreArchivo: string): Promise<void> {
    try {
      const { error } = await this.supabase.client.storage
        .from(this.BUCKET_NAME)
        .remove([nombreArchivo]);

      if (error) {
        throw new Error(`Error al eliminar imagen: ${error.message}`);
      }

    } catch (error: any) {
      console.error('Error en eliminarImagenProducto:', error);
      throw new Error(error.message || 'Error al eliminar la imagen');
    }
  }

  /**
   * Actualizar imagen de producto (elimina la anterior y sube la nueva)
   */
  async actualizarImagenProducto(
    file: File,
    productoId: number,
    imagenAnterior?: string
  ): Promise<{ url: string; nombre: string }> {
    try {
      // Eliminar imagen anterior si existe
      if (imagenAnterior) {
        await this.eliminarImagenProducto(imagenAnterior);
      }

      // Subir nueva imagen
      return await this.subirImagenProducto(file, productoId);

    } catch (error: any) {
      console.error('Error en actualizarImagenProducto:', error);
      throw new Error(error.message || 'Error al actualizar la imagen');
    }
  }

  /**
   * Validar archivo de imagen
   */
  validarImagen(file: File): { valido: boolean; error?: string } {
    // Validar tipo de archivo
    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
      return {
        valido: false,
        error: 'Solo se permiten archivos JPG, PNG y WebP'
      };
    }

    // Validar tamaño (máximo 5MB)
    const tamañoMaximo = 5 * 1024 * 1024; // 5MB en bytes
    if (file.size > tamañoMaximo) {
      return {
        valido: false,
        error: 'La imagen no puede superar los 5MB'
      };
    }

    return { valido: true };
  }


}