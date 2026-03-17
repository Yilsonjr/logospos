# Gestión de Imágenes de Fondo (Login)

El nuevo sistema de Login utiliza una **lista de imágenes dinámicas** que cambian aleatoriamente cada vez que se carga la página. 

Puedes gestionar qué imágenes aparecen modificando un simple archivo.

## 1. Dónde cambiar las imágenes
Ve al archivo: `src/app/pages/auth/login/login.component.ts`

Busca la sección:
```typescript
  // Imágenes de fondo dinámicas
  backgroundImages = [
    'https://images.unsplash.com/...', 
    'https://images.unsplash.com/...',
    // ...
  ];
```

## 2. Opciones de Uso

### Opción A: Usar enlaces de Internet (Fácil)
Simplemente pega el enlace directo de la imagen dentro de las comillas.
Recomendamos usar [Unsplash](https://unsplash.com) para imágenes de alta calidad gratuitas.

### Opción B: Usar tus propias fotos (Recomendado)
Para usar fotos locales de tu negocio (sin depender de internet):

1.  Crea una carpeta llamada `images` dentro de `src/assets`.
2.  Guarda tus fotos ahí (ej. `mi-local.jpg`).
3.  En el código, cambia el enlace por la ruta local:

```typescript
  backgroundImages = [
    'assets/images/mi-local.jpg',
    'assets/images/barra.jpg',
    'assets/images/entrada.jpg'
  ];
```

## 3. Consejos de Diseño
*   Usa imágenes horizontales de al menos **1920px de ancho**.
*   El sistema oscurece automáticamente la imagen para que el texto se lea bien.
*   Evita imágenes con mucho texto integrado.
