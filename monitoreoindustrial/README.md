# Hilos de Yecapixtla

ERP web estático para captura, consulta y análisis de mediciones de máquinas industriales.

## Uso local

Abre `index.html` en el navegador. Si `config.js` no tiene credenciales de Supabase, la app usa `localStorage`.

Credenciales iniciales:

- Usuario: `admin`
- Contraseña: `admin`

## Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta el contenido de `schema.sql` en el SQL Editor.
3. Copia la URL del proyecto y la llave anónima en `config.js`.

```js
window.APP_CONFIG = {
  supabaseUrl: "https://tu-proyecto.supabase.co",
  supabaseAnonKey: "tu-anon-key"
};
```

## Vercel

Sube esta carpeta como proyecto estático. No requiere comando de compilación ni framework.

## Roles

- `administrador`: CRUD de operadores, CRUD de mediciones, descarga Excel y estadísticas.
- `operador`: nueva medición y consulta de mediciones.
