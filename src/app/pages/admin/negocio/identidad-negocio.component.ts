import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TenantService } from '../../../services/tenant.service';
import { SupabaseService } from '../../../services/supabase.service';
import { ImagenService } from '../../../services/imagen.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-identidad-negocio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './identidad-negocio.component.html',
  styleUrl: './identidad-negocio.component.css'
})
export class IdentidadNegocioComponent implements OnInit {
  negocio: any = {
    nombre: '',
    rnc: '',
    email: '',
    telefono: '',
    direccion: '',
    logo_url: ''
  };
  isLoading = true;
  isSaving = false;
  
  // Logo upload preview
  logoFile: File | null = null;
  logoPreview: string | null = null;

  constructor(
    private tenantService: TenantService,
    private supabaseService: SupabaseService,
    private imagenService: ImagenService
  ) {}

  ngOnInit() {
    this.cargarDatos();
  }

  async cargarDatos() {
    this.isLoading = true;
    try {
      const data = await this.tenantService.getTenantInfo(this.supabaseService.client);
      this.negocio = { ...this.negocio, ...data };
      this.logoPreview = this.negocio.logo_url;
    } catch (error) {
      console.error('Error al cargar datos del negocio:', error);
      Swal.fire('Error', 'No se pudieron cargar los datos del negocio', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const validation = this.imagenService.validarImagen(file);
      if (!validation.valido) {
        Swal.fire('Archivo inválido', validation.mensaje, 'warning');
        return;
      }

      this.logoFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => this.logoPreview = e.target.result;
      reader.readAsDataURL(file);
    }
  }

  async guardarCambios() {
    this.isSaving = true;
    try {
      let finalLogoUrl = this.negocio.logo_url;

      // 1. Upload logo if changed
      if (this.logoFile) {
        let oldFileName: string | undefined;
        if (this.negocio.logo_url) {
          const parts = this.negocio.logo_url.split('/');
          oldFileName = parts[parts.length - 1].split('?')[0];
        }

        const tenantId = this.tenantService.getTenantIdOrThrow();
        const uploadResult = await this.imagenService.actualizarLogo(this.logoFile, oldFileName, tenantId);
        finalLogoUrl = uploadResult.url;
      }

      // 2. Update tenant info
      const payload = {
        nombre: this.negocio.nombre,
        rnc: this.negocio.rnc,
        email: this.negocio.email,
        telefono: this.negocio.telefono,
        direccion: this.negocio.direccion,
        logo_url: finalLogoUrl
      };

      await this.tenantService.updateTenantInfo(this.supabaseService.client, payload);
      
      this.negocio.logo_url = finalLogoUrl;
      this.logoFile = null;

      Swal.fire({
        title: '¡Guardado!',
        text: 'La identidad del negocio se ha actualizado correctamente.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error al guardar cambios:', error);
      Swal.fire('Error', 'Hubo un problema al guardar los cambios', 'error');
    } finally {
      this.isSaving = false;
    }
  }
}
