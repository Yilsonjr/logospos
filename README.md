# 🚀 LogosPOS

**LogosPOS** es un sistema de Punto de Venta (POS) moderno, robusto y escalable, diseñado para optimizar la gestión de comercios, licorerías y centros de entretenimiento. Desarrollado con tecnologías de vanguardia, ofrece una experiencia de usuario fluida con una interfaz premium basada en *glassmorphism* y lógica de negocio avanzada.

---

## ✨ Características Principales

### 🛒 Gestión de Ventas (Punto de Venta)
- **POS Rápido:** Escaneo de códigos de barras y búsqueda instantánea.
- **Pagos Flexibles:** Soporte para múltiples métodos de pago (Efectivo, Tarjeta, Transferencia, Crédito).
- **Descuentos y Ofertas:** Aplicación de descuentos globales o por artículo.
- **Impresión Profesional:** Soporte para tickets de 80mm, 58mm y facturas A4.

### 📦 Inventario Inteligente
- **Control de Stock:** Notificaciones de stock bajo y fuera de stock.
- **Categorización Avanzada:** Organización dinámica por categorías y proveedores.
- **Paginación y Filtros:** Gestión eficiente de inventarios extensos (5,000+ productos).
- **Kardex:** Historial detallado de movimientos de entrada y salida.

### 💰 Finanzas y Cuentas por Cobrar (CxC)
- **Agrupación por Cliente:** Vista simplificada que agrupa deudas por cliente en lugar de facturas aisladas.
- **Abono FIFO (First In, First Out):** Algoritmo inteligente que distribuye abonos automáticos a las facturas más antiguas.
- **Simulación en Tiempo Real:** Preview visual de cómo se aplicará un abono antes de confirmarlo.

### 📊 Reportes y Auditoría
- **Dashboard en Vivo:** Gráficos de ventas, márgenes de ganancia y tendencias.
- **Reportes DGII:** Exportación de datos para cumplimiento fiscal.
- **Auditoría de Acciones:** Registro detallado de actividad por usuario.

---

## 🛠️ Stack Tecnológico

- **Frontend:** [Angular](https://angular.io/) (v19+) con Signals y Control Flow.
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/).
- **Base de Datos:** [Supabase](https://supabase.com/) (PostgreSQL) con Realtime.
- **Estilos:** Vanilla CSS con Variables CSS dinámicas y Estética Premium (Glassmorphism).
- **Pruebas:** Vitest.

---

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js (versión 18 o superior)
- Angular CLI

### Instalación

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/USUARIO/Logos-POS.git
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configure sus variables de entorno en un archivo `.env` o directamente en el servicio de Supabase.

4. Iniciar el servidor de desarrollo:
   ```bash
   ng serve
   ```
   Navegar a `http://localhost:4200/`.

---

## 📦 Estructura del Proyecto

```text
src/
 ├── app/
 │    ├── pages/        # Módulos principales (Ventas, Inventario, CxC, etc.)
 │    ├── services/     # Lógica de negocio e integración con Supabase
 │    ├── models/       # Interfaces y tipos de datos
 │    ├── shared/       # Componentes reutilizables (Navbar, Modales)
 │    └── guards/       # Protección de rutas y permisos
 ├── assets/            # Imágenes y recursos estáticos
 └── index.html         # Punto de entrada
```

---

## 📄 Licencia

Este proyecto es propiedad privada de **Logos Soft**. Todos los derechos reservados.

---
*Desarrollado con ❤️ para maximizar la eficiencia de tu negocio.*
