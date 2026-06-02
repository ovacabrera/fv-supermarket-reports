# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


# Desarrollo

## Requisitos

* Node.js 20 o superior
* npm

## Instalación

```bash
npm install
```

## Ejecutar el proyecto

Para iniciar simultáneamente el frontend (Vite) y el backend (Express):

```bash
npm run start
```

Esto levantará:

* Frontend React/Vite
* Backend Node.js/Express

## Comandos disponibles

### Desarrollo completo

```bash
npm run start
```

Inicia frontend y backend en paralelo.

### Solo frontend

```bash
npm run dev
```

### Solo backend

```bash
npm run server
```

### Generar build de producción

```bash
npm run build
```

### Previsualizar build generado

```bash
npm run preview
```

### Ejecutar ESLint

```bash
npm run lint
```

## Estructura principal

```text
src/                    Frontend React
server/
└── src/
    └── server.cjs      Backend Express
```

## Endpoints del backend

### Información de la base de datos

```http
GET /api/db-info
```

Devuelve:

* existencia del archivo
* ruta detectada
* tamaño
* fecha de modificación

### Contenido de la base de datos

```http
GET /api/db
```

Devuelve el contenido completo del archivo `fvposdb.script`.

## Ubicación automática del archivo de datos

### Windows

```text
C:\FacilVirtual\data\fvposdb.script
```

### macOS / Linux

```text
~/Downloads/fvposdb.script
```

## Notas

El proyecto utiliza `"type": "module"` en `package.json`.

El backend se implementa en `server.cjs` (CommonJS) para mantener compatibilidad con `require()` sin necesidad de migrar el código a ES Modules.
