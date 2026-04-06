---
name: billing-expert
description: Especialista en ciclo de vida de facturas, notas de crédito y envíos externos.
---
# Instrucciones
1. Al generar una **Nota de Crédito**, busca la factura original por ID, extrae los ítems y genera un nuevo documento `type: 'credit_note'` referenciando el `original_invoice_id`.
2. Para **Factura Electrónica**, utiliza la lógica de validación de NCF (Número de Comprobante Fiscal) antes de proceder.
3. Al enviar por **WhatsApp**, utiliza el helper `whatsappService.sendMedia()` enviando el blob del PDF generado.