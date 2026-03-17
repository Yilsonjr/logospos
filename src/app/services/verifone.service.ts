import { Injectable } from '@angular/core';

export interface VerifoneResponse {
    aprobado: boolean;
    autorizacion?: string;
    recibo?: string;
    ultimos4?: string;
    marca?: string;
    mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class VerifoneService {

    /**
     * Simula el procesamiento de un pago en una terminal Verifone.
     * En el futuro, este servicio conectará con una Edge Function 
     * que maneje pasarelas reales (Azul, Cardnet, Carnet, etc).
     */
    async procesarPago(monto: number): Promise<VerifoneResponse> {
        return new Promise((resolve) => {
            // Simular delay de comunicación con el dispositivo (2.5 segundos)
            setTimeout(() => {
                // Simular éxito de la transacción
                const marcas = ['VISA', 'MASTERCARD', 'AMEX'];
                const marcaAsignada = marcas[Math.floor(Math.random() * marcas.length)];

                resolve({
                    aprobado: true,
                    autorizacion: Math.floor(100000 + Math.random() * 900000).toString(),
                    recibo: '000' + Math.floor(100 + Math.random() * 900).toString(),
                    ultimos4: Math.floor(1000 + Math.random() * 9000).toString(),
                    marca: marcaAsignada,
                    mensaje: 'APROBADO'
                });
            }, 2500);
        });
    }
}
