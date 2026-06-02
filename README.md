# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Panel Ventas FV

Dashboard de reportes para FácilVirtual desarrollado con React, Express y Electron.

## Arquitectura

```text
Electron
   │
   ▼
Express (localhost:3001)
   ├── Frontend React (build Vite)
   ├── GET /api/db-info
   └── GET /api/db
           │
           ▼
      fvposdb.script
```

## Tecnologías

* React 19
* Vite
* Express
* Electron
* Electron Builder
* Recharts

## Estructura del proyecto

```text
ventas-dashboard-jsx/
├── electron/
│   └── main.cjs
│
├── server/
│   └── src/
│       └── server.cjs
│
├── src/
│   └── Frontend React
│
├── public/
├── dist/
├── package.json
└── vite.config.js
```

## Requisitos

* Node.js 20 o superior
* npm

## Instalación

```bash
npm install
```

## Desarrollo

### Iniciar frontend y backend

```bash
npm run start
```

Este comando inicia:

* Vite (Frontend React)
* Express (Backend)

### Solo frontend

```bash
npm run dev
```

### Solo backend

```bash
npm run server
```

### Ejecutar Electron

```bash
npm run electron
```

Electron inicia automáticamente el servidor Express y abre la aplicación de escritorio.

## Build de producción

Generar el frontend compilado:

```bash
npm run build
```

El resultado se almacena en:

```text
dist/
```

## Endpoints

### Información de la base de datos

```http
GET /api/db-info
```

Respuesta:

```json
{
  "found": true,
  "path": "...",
  "size": 12345,
  "modified": "2026-06-02T12:34:56.000Z"
}
```

### Contenido de la base de datos

```http
GET /api/db
```

Devuelve el contenido completo de `fvposdb.script`.

## Ubicación del archivo de datos

### Windows

```text
C:\FacilVirtual\data\fvposdb.script
```

### macOS / Linux

```text
~/Downloads/fvposdb.script
```

## Generación de ejecutable portable

### Compilar frontend

```bash
npm run build
```

### Generar ejecutable

```bash
npm run dist
```

El ejecutable se genera en:

```text
release/
```

Ejemplo:

```text
release/
└── Panel Ventas FV.exe
```

## Distribución

El ejecutable portable:

* No requiere instalación.
* No requiere Node.js.
* No requiere abrir navegador.
* Inicia automáticamente el servidor interno.
* Lee el archivo `fvposdb.script` desde la ubicación configurada.

## Scripts disponibles

```bash
npm run dev
npm run server
npm run start
npm run build
npm run preview
npm run electron
npm run dist
npm run lint
```
