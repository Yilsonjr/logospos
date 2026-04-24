import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AzulResponse {
    Success: boolean;
    AuthorizationCode?: string;
    CardNumber?: string;
    CardType?: string;
    ReceiptNumber?: string;
    Message: string;
    DateTime?: string;
    Amount?: number;
    InvoiceNumber?: string;
}

export interface AzulConfig {
    terminalUrl: string;
    terminalId?: string;
    merchantId?: string;
}

@Injectable({ providedIn: 'root' })
export class AzulService {
    private readonly CONFIG_KEY = 'logospos_azul_config';
    private config: AzulConfig = {
        terminalUrl: 'http://localhost:8080/azul'
    };

    constructor(private http: HttpClient) {
        this.cargarConfiguracion();
    }

    private cargarConfiguracion() {
        const saved = localStorage.getItem(this.CONFIG_KEY);
        if (saved) {
            try {
                this.config = JSON.parse(saved);
            } catch (e) {
                console.error('Error al cargar config de AZUL:', e);
            }
        }
    }

    getConfig(): AzulConfig {
        return { ...this.config };
    }

    guardarConfig(nuevaConfig: AzulConfig) {
        this.config = { ...nuevaConfig };
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(this.config));
    }

    /**
     * Procesa una venta en la terminal AZUL
     */
    async procesarPago(monto: number, impuesto: number, factura: string): Promise<AzulResponse> {
        const payload = {
            ProcessType: '01', // Venta
            Amount: monto.toFixed(2),
            Tax: impuesto.toFixed(2),
            InvoiceNumber: factura,
            TerminalID: this.config.terminalId,
            MerchantID: this.config.merchantId
        };

        try {
            const response: any = await firstValueFrom(this.http.post(this.config.terminalUrl, payload));
            
            return {
                Success: response.ResponseCode === '00',
                AuthorizationCode: response.AuthorizationCode,
                CardNumber: response.CardNumber,
                CardType: response.CardType,
                ReceiptNumber: response.ReceiptNumber,
                Message: response.Message || (response.ResponseCode === '00' ? 'APROBADO' : 'DECLINADO'),
                DateTime: new Date().toISOString(),
                Amount: monto,
                InvoiceNumber: factura
            };
        } catch (error) {
            console.error('Error de comunicación con terminal AZUL:', error);
            return {
                Success: false,
                Message: 'No se pudo conectar con la terminal. Verifique que el agente AZUL esté ejecutándose.'
            };
        }
    }

    /**
     * Solicita la reimpresión del último comprobante o uno específico
     */
    async reimprimir(referencia?: string): Promise<boolean> {
        const payload = {
            ProcessType: '05', // Reimpresión
            ReceiptNumber: referencia,
            TerminalID: this.config.terminalId
        };

        try {
            const response: any = await firstValueFrom(this.http.post(this.config.terminalUrl, payload));
            return response.ResponseCode === '00';
        } catch (error) {
            console.error('Error al reimprimir:', error);
            return false;
        }
    }

    /**
     * Obtiene el listado de transacciones del día desde el terminal (si el bridge lo permite)
     * O simula el historial basado en lo que el bridge devuelve.
     */
    async obtenerTransacciones(): Promise<AzulResponse[]> {
        // Nota: Muchos bridges locales solo devuelven la última o requieren una base de datos local.
        // Aquí implementaremos una llamada al bridge si soporta el listado, de lo contrario
        // se manejará vía base de datos del POS (tabla transacciones_terminal).
        try {
            const response: any = await firstValueFrom(this.http.get(`${this.config.terminalUrl}/history`));
            return response.map((r: any) => ({
                Success: r.ResponseCode === '00',
                AuthorizationCode: r.AuthorizationCode,
                CardNumber: r.CardNumber,
                CardType: r.CardType,
                ReceiptNumber: r.ReceiptNumber,
                Message: r.Message,
                DateTime: r.DateTime,
                Amount: parseFloat(r.Amount),
                InvoiceNumber: r.InvoiceNumber
            }));
        } catch (error) {
            return [];
        }
    }
}
