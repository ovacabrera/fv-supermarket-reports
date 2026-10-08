# Plan: reportes en el celular sin seleccionar archivo

> Documento de traspaso para seguir el trabajo en otra sesión de chat.
> Marcado: `[x]` hecho y commiteado · `[ ]` pendiente.
> Última actualización: 2026-10-08.

## Objetivo

El usuario abre la app en el celular y **ve los reportes enseguida**, sin elegir ningún archivo.
Los datos salen de la última "foto" de la base del POS, ya procesada.

## Contexto

- El POS (FácilVirtual) guarda todo en una base HSQLDB: `fvposdb.script`, un archivo de texto con `INSERT`s.
  - En Windows está en `C:\FacilVirtual\data\fvposdb.script`.
  - En la Mac de desarrollo se usa `~/Downloads/fvposdb.script`.
- Hoy funciona así:
  - `server/src/server.cjs` (Express, puerto 3001) sirve `dist/`, más `GET /api/db-info` y `GET /api/db` con el `.script` crudo.
  - El front (`src/pages/ventas-dashboard.jsx`) baja el archivo y lo procesa en el navegador.
  - Electron (`electron/main.cjs`) levanta el server y abre `http://localhost:3001`.
- Todos los días se hace una copia de la base en Google Drive. Ese backup **se mantiene**; no es el canal de datos de la app.
- Tamaños medidos el 2026-10-08:

| | Tamaño |
|---|---|
| `.script` crudo | 169 MB |
| Salida del parser como JSON tal cual | 90 MB (8 MB con gzip) |
| **Snapshot compacto (Fase 2)** | **21 MB JSON / 4,3 MB gzip** |

- Contenido: 148k órdenes, 644k líneas de venta, 149k pagos, 138k operaciones de caja, 34k productos.

## Arquitectura objetivo

```text
PC del POS (Windows)                          Internet (privado)                 Celular
fvposdb.script ──► npm run snapshot ──► snapshot.json.gz + meta.json ──► PWA (misma web)
                  (Programador de tareas:                                  abre → muestra la última
                   diario u horario)                                       foto guardada → busca una nueva
```

Decisión: publicar en **Cloudflare Pages protegido con Cloudflare Access**, no en Google Drive.

Por qué no Drive:
- La web solo puede bajar el archivo si se comparte como "cualquiera con el enlace", y eso deja públicos los datos de ventas.
- La alternativa es implementar el login de Google (OAuth) en la app.
- Además, los enlaces de descarga de Drive dan problemas de CORS.

Ventajas de Cloudflare:
- Es gratis y no hay problemas de CORS: la web y los datos se publican juntos.
- Access pide un login por email (código o Google) y la sesión dura semanas.

---

## Fase 1: separar el parser ✅

- [x] Mover `parseHSQLScript` de `ventas-dashboard.jsx` a **`src/lib/parseHSQL.js`**, como JS puro sin React ni DOM, para que funcione en el navegador y en Node.
- [x] El dashboard lo importa con `import { parseHSQLScript } from "../lib/parseHSQL.js"`.
- [x] Probado por el usuario en la app: los reportes funcionan. Commit `3b85721`.

## Fase 2: script de exportación del snapshot ✅

- [x] **`src/lib/snapshot.js`**:
  - `encodeSnapshot(db, source)` → objeto JSON compacto.
  - `decodeSnapshot(snap)` → `{ db, meta }`, con `db` **en la misma forma que devuelve `parseHSQLScript`**.
  - Es genérico: toma todas las tablas (arrays) y mapas (objetos) que devuelva el parser. Si se agregan campos al parser, entran solos.
  - Tipos de columna:
    - `v`: valores tal cual.
    - `c`: constante.
    - `d`: fecha.
    - `z`: enteros codificados como diferencia con la fila anterior.
  - Fechas: se guardan como **hora de pared** (la hora que muestra el POS, que no tiene zona horaria), codificada como segundos UTC. Se ven igual sin importar la zona horaria de la PC o del celular.
  - Los números con decimales se redondean a 4 decimales para quitar el ruido de punto flotante.
  - `SNAPSHOT_VERSION = 1`. `decodeSnapshot` falla si la versión no coincide.
- [x] **`scripts/export-snapshot.mjs`**, con `npm run snapshot [-- --db <ruta> --out <carpeta>]`:
  - Usa la misma ruta por defecto que el server.
  - Genera `snapshot/snapshot.json.gz` (gzip nivel 9) y `snapshot/meta.json` con `version`, `generatedAt`, `source{file,size,modified}`, `counts` y `bytes`.
  - Escribe a un temporal y después renombra, así nunca queda un archivo a medio escribir. Tarda unos 13 s.
- [x] `snapshot/` agregado a `.gitignore`.
- [x] Verificación de ida y vuelta: parser → snapshot → decode, comparado campo por campo sobre la base real → **0 diferencias**, también con `TZ=America/New_York`. Rearmar todo tarda 0,75 s en la Mac.
- [x] Commit `d6d5e1d`.

## Correcciones al parser (hechas durante la Fase 2) ✅

Commit `9628dda`.

- [x] **`FVPOS_CASH_OPERATION` leía columnas equivocadas.** `operationDate` salía como `Invalid Date` en todas las filas y `operationNotes` traía una fecha.
  - Ahora usa los índices del `CREATE TABLE`: `0` id, `1` IS_ACTIVE, `2` AMOUNT, `3` CASH_NUMBER, `5` DESCRIPTION, `8` OPERATION_DATE, `10` TYPE, `13` ORDER_ID.
  - Campos: `{ id, operationTypeId, operationDate, operationAmount, operationNotes, cashNumber, orderId, isActive }`.
  - Valores de TYPE observados en los datos:
    - **1 = ingreso**: Venta, Caja inicial, Cobro a cliente.
    - **2 = egreso**: Retiro de dinero.
    - **3 = apertura o cierre de caja**, con monto 0.
- [x] **El gráfico "Ventas por forma de pago" nunca funcionó.** Buscaba `FVPOS_ORDER_PAYMENT` y `FVPOS_PAYMENT_TYPE`, que no existen en la base.
  - Los pagos son columnas de `FVPOS_ORDER`. Ahora `orderPayments` se arma desde las **`PAYMENT_NET_*_AMT`**: 27 efectivo, 28 cheque, 29 crédito, 30 débito, 31 cuenta corriente, 32 tickets.
  - Las columnas sin `NET` son lo que entregó el cliente e incluyen el vuelto.
  - Ids de `paymentTypes`:
    - `1–6`: medios fijos.
    - `100 + CARD_ID`: tarjetas de crédito, con nombre desde `FVPOS_CREDIT_CARD` (`CREDIT_CARD_ID`, columna 48).
    - `200 + CARD_ID`: tarjetas de débito, con nombre desde `FVPOS_DEBIT_CARD` (columna 50).
  - En la práctica solo se usan Efectivo (138k órdenes) y "MercadoPago" (crédito id 12, 10,7k órdenes).
  - Texto del fallback del gráfico actualizado en el dashboard.
- [x] ~~El `qty` de `orderLines` estaba invertido~~ → **no era un bug**. PRICE (6) y QTY (8) coinciden con el `CREATE TABLE`. Ver el punto del producto 25912 en "Pendientes de datos".

---

## Fase 3: publicación automática ⬜

- [ ] Crear el proyecto en **Cloudflare Pages** con deploy directo por `wrangler`, sin Git.
- [ ] Configurar **Cloudflare Access** (Zero Trust, plan gratis): una aplicación sobre el dominio `*.pages.dev`, con una política de emails permitidos y login por código o Google.
  - Proteger también los deploys de preview.
- [ ] Script de publicación, por ejemplo `scripts/publish.mjs` o `npm run publish`:
  1. `npm run build`
  2. `npm run snapshot -- --out dist/data`, para que queden `dist/data/snapshot.json.gz` y `dist/data/meta.json`.
  3. `npx wrangler pages deploy dist --project-name <nombre>`, con token en una variable de entorno (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) y **nunca en el repo**.
- [ ] Para no rebuildear el front en cada publicación de datos: hacer el build una vez y en cada corrida copiar solo los datos nuevos a `dist/data/` antes del deploy.
- [ ] **Programador de tareas de Windows** en la PC del POS: correr la publicación todos los días (por ejemplo 23:30, después del cierre), o cada hora en horario comercial. Que guarde un log en un archivo.
- [ ] Revisar cómo Pages sirve el `.gz`. El front debe descomprimir solo con `DecompressionStream("gzip")` y no depender de `Content-Encoding`. Si Pages agrega `Content-Encoding: gzip`, renombrar el archivo a `snapshot.bin`.
  - Límite de Pages: 25 MiB por archivo. Hoy el snapshot pesa 4,3 MB.
- [ ] Agregar `_headers` en `dist`: `Cache-Control: no-cache` para `/data/*` y `/index.html`, y cache largo para `/assets/*`.

## Fase 4: el front carga el snapshot ⬜

Archivos clave:
- `src/pages/ventas-dashboard.jsx`:
  - `const SERVER` (línea ~20)
  - `loadFromServer` (~1292)
  - Carga manual con `parseHSQLScript(await file.text())` (~1343)
  - `DBStatusBanner` (~1197)
- `server/src/server.cjs`

Tareas:
- [ ] Nuevo `src/lib/loadSnapshot.js`:
  1. `fetch("./data/meta.json", { cache: "no-store" })`.
  2. Comparar `generatedAt` con la copia guardada en el teléfono.
  3. Si hay una más nueva, bajar `./data/snapshot.json.gz`, descomprimir con `DecompressionStream("gzip")`, hacer `JSON.parse` y llamar a `decodeSnapshot`.
- [ ] Guardar el JSON del snapshot en **IndexedDB** (envuelto en try/catch). Al abrir:
  - Mostrar al instante la copia guardada.
  - Después revisar `meta.json` y actualizar si cambió (stale-while-revalidate).
  - Sin señal, mostrar lo guardado.
- [ ] Orden de fuentes de datos en `App`:
  1. Snapshot (`./data/`).
  2. Server local `/api/db`, para Electron o la LAN.
  3. Selector manual, como último recurso.
- [ ] La URL del server local no debe romper en Cloudflare: `SERVER` hoy fuerza el puerto 3001. Usar rutas relativas o `import.meta.env`.
- [ ] Mostrar **"Datos al: dd/mm hh:mm"** usando `meta.generatedAt` o `source.modified` (fecha de la base), y avisar si la foto tiene más de 36 h.
- [ ] Opcional: un endpoint `GET /api/snapshot` en `server.cjs` (usando `import()` dinámico de `src/lib/*.js`, porque el server es CJS), para que Electron también use el formato compacto y el front tenga un solo formato.
- [ ] Opcional: decodificar en un Web Worker si en el celular tarda más de 2 s.
- [ ] Probar en un iPhone real (Safari soporta `DecompressionStream` desde la versión 16.4).

## Fase 5: PWA instalable ⬜

- [ ] `vite-plugin-pwa`:
  - Manifest con nombre "Panel Ventas FV", `display: standalone`, `theme_color` `#0f1117` e íconos de 192 y 512.
  - Agregar `apple-touch-icon`.
- [ ] El service worker precachea **solo el app shell**. `/data/*` usa `NetworkFirst` o queda fuera del service worker, porque los datos ya los maneja IndexedDB.
- [ ] Probar "Compartir → Agregar a pantalla de inicio" en iPhone y "Instalar app" en Android.

## Fase 6: optimizaciones (si hace falta) ⬜

- [ ] Si el snapshot crece mucho: detalle completo solo de los últimos 13 meses y totales ya sumados por día para la pestaña Histórico.
- [ ] Code-splitting: hoy el bundle de Vite pesa más de 500 kB.

---

## Pendientes de datos y bugs conocidos

- [ ] **Orden con un total absurdo:** `ORDER_ID 27571`, del 2022-02-19 12:29, con total **$7.792.798.007.387** y pagada en efectivo. La siguiente más grande es de $237M y la mediana de $3.356. Probablemente se cargó un código de barras como cantidad. Distorsiona los totales de cualquier período que la incluya.
  - Opciones: excluirla en el parser, marcar outliers, o corregirla en el POS.
- [ ] **Producto 25912 "Fiambrería Ticket":** se carga con PRICE = 1 y QTY = importe de la balanza (4.087 líneas). El subtotal da bien, pero infla las **unidades**: Top 10 por cantidad, total de unidades y unidades por mes.
  - Opción: contar 1 unidad por línea cuando PRICE = 1.
- [ ] **818 ventas en caja** donde `operationAmount` es distinto del total de la orden. Seguramente son pagos mixtos (parte efectivo, parte MercadoPago). Revisarlas antes de armar un reporte de caja.
- [ ] **4 órdenes** donde la suma de pagos no coincide con el total: ids 120062, 120119, 120196 y 120288 (pagos menores al total).
- [ ] Lint: `ventas-dashboard.jsx` tiene 12 errores de antes de este plan (variables sin usar, "Cannot create components during render", setState dentro de un effect). No se tocaron.

## Cómo verificar cambios en el parser o el snapshot

```bash
npm run snapshot        # debe terminar con "✓ Snapshot generado" y mostrar las cantidades
npm run build
npx eslint src/lib scripts
```

Prueba de ida y vuelta (no está en el repo; se puede recrear como `scripts/verify-snapshot.mjs`):
1. Correr `parseHSQLScript` sobre la base.
2. Leer `snapshot/snapshot.json.gz` y pasarlo por `decodeSnapshot`.
3. Comparar cada campo de cada fila: fechas por `getTime()` y números con tolerancia de 1e-4.
4. Debe dar 0 diferencias. Repetir con `TZ=America/New_York`.
