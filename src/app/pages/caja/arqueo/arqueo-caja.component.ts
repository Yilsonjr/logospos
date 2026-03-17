import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { Caja, DENOMINACIONES } from '../../../models/caja.model';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-arqueo-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './arqueo-caja.component.html',
  styleUrl: './arqueo-caja.component.css'
})
export class ArqueoCajaComponent implements OnInit, OnDestroy {
  cajaActual: Caja | null = null;
  denominaciones = DENOMINACIONES;
  
  arqueo: { [key: string]: number } = {
    billetes_2000: 0, billetes_1000: 0, billetes_500: 0,
    billetes_200: 0, billetes_100: 0, billetes_50: 0,
    monedas_25: 0, monedas_10: 0, monedas_5: 0, monedas_1: 0
  };
  
  totalBilletes: number = 0;
  totalMonedas: number = 0;
  totalContado: number = 0;
  montoEsperado: number = 0;
  diferencia: number = 0;
  
  ventasEfectivo: number = 0;
  totalEntradas: number = 0;
  totalSalidas: number = 0;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private cajaService: CajaService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.cargarDatos();
    
    // Recargar cuando se navega al arqueo
    const navSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(async (event: any) => {
      if (event.url.includes('/caja/arqueo')) {
        await this.cargarDatos();
      }
    });
    
    this.subscriptions.push(navSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async cargarDatos() {
    try {
      // Forzar verificación fresca de la base de datos (sin cache)
      this.cajaActual = await this.cajaService.verificarCajaAbierta(true);
      
      // Forzar detección de cambios
      this.cdr.detectChanges();
      
      if (!this.cajaActual) {
        await Swal.fire({
          title: 'Sin Caja Abierta',
          text: 'No hay una caja abierta para realizar arqueo',
          icon: 'warning',
          confirmButtonText: 'Aceptar'
        });
        this.router.navigate(['/caja/apertura']);
        return;
      }

      // Cargar ventas del día
      const ventas = await this.cajaService.calcularVentasDelDia(this.cajaActual.id!);
      this.ventasEfectivo = ventas.efectivo;

      // Cargar movimientos
      const movimientos = await this.cajaService.obtenerMovimientos(this.cajaActual.id!);
      this.totalEntradas = movimientos
        .filter(m => m.tipo === 'entrada')
        .reduce((sum, m) => sum + m.monto, 0);
      this.totalSalidas = movimientos
        .filter(m => m.tipo === 'salida')
        .reduce((sum, m) => sum + m.monto, 0);

      // Calcular monto esperado
      this.calcularMontoEsperado();
      
      // Forzar detección de cambios final
      this.cdr.detectChanges();
      
    } catch (error) {
      console.error('Error al cargar datos de arqueo:', error);
      this.cajaActual = null;
      this.cdr.detectChanges();
    }
  }

  calcularMontoEsperado() {
    if (!this.cajaActual) return;
    this.montoEsperado = this.cajaActual.monto_inicial + 
                         this.ventasEfectivo + 
                         this.totalEntradas - 
                         this.totalSalidas;
  }

  calcularArqueo() {
    this.totalBilletes = 
      (this.arqueo['billetes_2000'] * 2000) +
      (this.arqueo['billetes_1000'] * 1000) +
      (this.arqueo['billetes_500'] * 500) +
      (this.arqueo['billetes_200'] * 200) +
      (this.arqueo['billetes_100'] * 100) +
      (this.arqueo['billetes_50'] * 50);

    this.totalMonedas = 
      (this.arqueo['monedas_25'] * 25) +
      (this.arqueo['monedas_10'] * 10) +
      (this.arqueo['monedas_5'] * 5) +
      (this.arqueo['monedas_1'] * 1);

    this.totalContado = this.totalBilletes + this.totalMonedas;
    this.diferencia = this.totalContado - this.montoEsperado;
    
    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  limpiarArqueo() {
    Object.keys(this.arqueo).forEach(key => {
      (this.arqueo as any)[key] = 0;
    });
    this.calcularArqueo();
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(valor);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  imprimirArqueo() {
    window.print();
  }
}
