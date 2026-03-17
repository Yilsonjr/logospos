import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class ImagenService {
  private readonly BUCKET_NAME = 'productos-imagenes';

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Subir imagen a Supabase Storage
   * @param file Archivo de imagen
   * @param productoId ID del producto (opcional, para nombrar el archivo)
   * @returns URL pública de la imagen
   */
  async subirImagen(file: File, productoId?: number): Promise<{ url: string; nombre: string }> {
    try {
      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const nombreArchivo = productoId 
        ? `producto_${productoId}_${timestamp}.${extension}`
        : `producto_${timestamp}.${extension}`;

      console.log('📤 Subiendo imagen:', nombreArchivo);

      // Subir archivo a Supabase Storage
      const { data, error } = await this.supabaseService.client.storage
        .from(this.BUCKET_NAME)
        .upload(nombreArchivo, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('❌ Error al subir imagen:', error);
        throw error;
      }

      // Obtener URL pública
      const { data: urlData } = this.supabaseService.client.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(nombreArchivo);

      console.log('✅ Imagen subida:', urlData.publicUrl);

      return {
        url: urlData.publicUrl,
        nombre: nombreArchivo
      };

    } catch (error) {
      console.error('💥 Error en subirImagen:', error);
      throw error;
    }
  }

  /**
   * Eliminar imagen de Supabase Storage
   * @param nombreArchivo Nombre del archivo a eliminar
   */
  async eliminarImagen(nombreArchivo: string): Promise<void> {
    try {
      console.log('🗑️ Eliminando imagen:', nombreArchivo);

      const { error } = await this.supabaseService.client.storage
        .from(this.BUCKET_NAME)
        .remove([nombreArchivo]);

      if (error) {
        console.error('❌ Error al eliminar imagen:', error);
        throw error;
      }

      console.log('✅ Imagen eliminada');

    } catch (error) {
      console.error('💥 Error en eliminarImagen:', error);
      throw error;
    }
  }

  /**
   * Actualizar imagen (elimina la anterior y sube la nueva)
   * @param file Nuevo archivo de imagen
   * @param imagenAnterior Nombre del archivo anterior a eliminar
   * @param productoId ID del producto
   */
  async actualizarImagen(
    file: File, 
    imagenAnterior: string | undefined, 
    productoId?: number
  ): Promise<{ url: string; nombre: string }> {
    try {
      // Eliminar imagen anterior si existe
      if (imagenAnterior) {
        await this.eliminarImagen(imagenAnterior);
      }

      // Subir nueva imagen
      return await this.subirImagen(file, productoId);

    } catch (error) {
      console.error('💥 Error en actualizarImagen:', error);
      throw error;
    }
  }

  /**
   * Validar archivo de imagen
   * @param file Archivo a validar
   * @returns true si es válido, mensaje de error si no
   */
  validarImagen(file: File): { valido: boolean; mensaje?: string } {
    // Validar tipo de archivo
    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
      return {
        valido: false,
        mensaje: 'Solo se permiten imágenes JPG, PNG o WebP'
      };
    }

    // Validar tamaño (máximo 5MB)
    const tamañoMaximo = 5 * 1024 * 1024; // 5MB en bytes
    if (file.size > tamañoMaximo) {
      return {
        valido: false,
        mensaje: 'La imagen no debe superar los 5MB'
      };
    }

    return { valido: true };
  }
}
