export interface ConfiguracionFiscal {
    id: number;
    modo_fiscal: boolean;
    rnc_empresa?: string;
    nombre_empresa?: string;
    itbis_defecto: number;
    created_at?: string;
    updated_at?: string;
}

export interface SecuenciaNCF {
    id?: number;
    tipo_ncf: string; // 'B01', 'B02', etc.
    descripcion: string;
    prefijo: string;
    rango_inicial: number;
    rango_final: number;
    numero_actual: number;
    fecha_vencimiento: string;
    activo: boolean;
    ultima_actualizacion?: string;
}

export type TipoComprobante = 'B01' | 'B02' | 'B14' | 'B15' | 'B03' | 'B04';

export const TIPOS_COMPROBANTE = [
    { codigo: 'B01', descripcion: 'Factura de Crédito Fiscal (Valor Fiscal)' },
    { codigo: 'B02', descripcion: 'Factura de Consumidor Final (Sin Valor Fiscal)' },
    { codigo: 'B14', descripcion: 'Comprobante Régimen Especial' },
    { codigo: 'B15', descripcion: 'Comprobante Gubernamental' },
    { codigo: 'B04', descripcion: 'Nota de Crédito' },
    { codigo: 'B03', descripcion: 'Nota de Débito' }
];
