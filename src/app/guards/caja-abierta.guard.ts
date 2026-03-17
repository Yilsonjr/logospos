import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CajaService } from '../services/caja.service';
import Swal from 'sweetalert2';

export const cajaAbiertaGuard = async () => {
  const cajaService = inject(CajaService);
  const router = inject(Router);

  try {
    const caja = await cajaService.verificarCajaAbierta();
    
    if (!caja) {
      const result = await Swal.fire({
        title: 'Caja Cerrada',
        text: 'Debes abrir la caja antes de acceder al punto de venta',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Abrir Caja Ahora',
        cancelButtonText: 'Ir al Dashboard'
      });

      if (result.isConfirmed) {
        router.navigate(['/caja/apertura']);
      } else {
        router.navigate(['/dashboard']);
      }
      
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error al verificar caja:', error);
    router.navigate(['/dashboard']);
    return false;
  }
};
