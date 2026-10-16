# Plan: reportes en el celular sin seleccionar archivo

> Documento de traspaso para seguir el trabajo en otra sesión de chat.
> Marcado: `[x]` hecho y commiteado · `[ ]` pendiente.
> Última actualización: 2026-10-15.

## Objetivo

El usuario abre la app en el celular y **ve los reportes enseguida**, sin elegir ningún archivo.
Los datos salen de la última "foto" de la base del POS, ya procesada.

## Estado actual (2026-10-15)

- ✅ **Funciona de punta a punta desde la Mac**: `npm run publish` genera la foto y la sube a `https://panel-ventas-fv.pages.dev`, protegido con Cloudflare Access (código por mail, grupo "Familia").
- ✅ **Probado en iPhone**: abre los reportes sin elegir archivo, guarda la foto en el teléfono y muestra "Datos al …".
- ✅ **Rediseño publicado (Fase 8)**: reportes nuevos, pensados para el celular, probados en iPhone y Android el 2026-10-14.
- ⬜ **Falta la producción real**: que la **PC del POS** publique sola todos los días. Hoy los datos publicados son de una copia de la base del 15/10 a las 20:34, hecha a mano, y se ven en rojo como viejos cuando pasan más de 36 h.
- ⬜ **Repo de GitHub público**: pasarlo a privado (ver P1).
- 🟡 **Fase 7 (leer también el `.log`)**: hecha en el repo y publicada el 2026-10-15 con las ventas del día incluidas. Falta la verificación contra el checkpoint del día siguiente.
- ⬜ **IPC desactualizado**: está cargado a mano en `src/lib/ipc.js` y llega hasta abril de 2026. El INDEC ya publicó hasta septiembre. La **Fase 9** lo baja solo en cada publicación.
- ⬜ Después: **Fase 5** (PWA, con la identidad visual nueva).

## Próximos pasos: puesta en producción

Objetivo: que los datos se publiquen solos desde la PC del POS, sin intervención, y que los usuarios entren con su mail.
Los pasos van en orden. Los marcados 🧑 los hace el usuario (necesitan la cuenta de Cloudflare o la PC del POS).

### P1. Dejar el repo listo para la PC del POS

- [x] `git push` a GitHub (`ovacabrera/fv-supermarket-reports`), hecho el 2026-10-14 (hasta `c7d3968`).
- [x] Revisado que no se subieron datos ni secretos: la base, `snapshot/`, `dist/`, `logs/` y `.env` están en `.gitignore`.
- [ ] 🧑 ⚠️ **El repo es PÚBLICO** (verificado el 2026-10-14). No tiene datos ni secretos, pero este plan incluye información del negocio (cantidad de órdenes, ticket mediano, uso de MercadoPago, montos de órdenes puntuales), la URL del panel y el nombre del equipo de Access. Los datos siguen protegidos por el login, pero se recomienda **hacerlo privado**: GitHub → repo → Settings → Danger Zone → *Change visibility* → Private.
  - Consecuencia: en P3, el `git clone` en la PC del POS va a pedir login de GitHub (Git for Windows abre el navegador la primera vez y guarda la credencial).

### P2. 🧑 Token de API de Cloudflare (para la PC del POS)

En la PC del POS no conviene `wrangler login` (sesión personal que vence). Se usa un token limitado:

- [ ] dash.cloudflare.com → My Profile → **API Tokens** → Create Token → *Create Custom Token*.
  - Permisos: **Account → Cloudflare Pages → Edit**. Nada más.
  - Account Resources: solo esta cuenta.
  - Opcional: sin vencimiento, o con vencimiento anual y anotar la fecha para renovarlo.
- [ ] Anotar también el **Account ID** (Workers & Pages → columna derecha).
- [ ] Guardar el token en un lugar seguro (gestor de contraseñas). No se puede volver a ver en Cloudflare.

### P3. 🧑 Instalar en la PC del POS (Windows)

- [ ] Instalar **Node.js LTS** (nodejs.org) y **Git for Windows**.
- [ ] Clonar el repo en una carpeta fija, por ejemplo `C:\fv-reportes`:
  `git clone https://github.com/ovacabrera/fv-supermarket-reports.git C:\fv-reportes`
  (con el repo privado, Git pide login de GitHub la primera vez; usar la cuenta dueña del repo).
- [ ] En esa carpeta: `npm ci`.
- [ ] Crear `C:\fv-reportes\.env` a partir de `.env.example` con `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y `CF_PAGES_PROJECT=panel-ventas-fv`.
- [ ] Probar a mano: `scripts\publish-task.cmd --build`.
  - Debe terminar con `✓ Publicado en https://panel-ventas-fv.pages.dev/`.
  - En el celular, **↻ Actualizar**: "Datos al …" tiene que mostrar la fecha de la base del POS, en verde.
  - Si falla, mirar `C:\fv-reportes\logs\publish.log`.

### P4. Cuándo se actualiza `fvposdb.script` ✅ (respondido el 2026-10-15 con los logs del POS)

HSQLDB guarda los cambios recientes en `fvposdb.log` y recién los pasa a `fvposdb.script` en un *checkpoint*.

- [x] **FácilVirtual hace el checkpoint al arrancar** (alrededor de las 09:10), no al cerrar. En `logs\fvpos.log.<fecha>` aparece `checkpointClose start … checkpointClose end`, seguido de `Stopping HSQL server...` y `Starting HSQL server...`. Visto el 1, 3, 5, 11, 12, 13 y 15/10. Al cerrar no aparece ningún checkpoint.
  - Consecuencia: durante el día, y también a la noche después del cierre, el `.script` llega solo hasta el día anterior. **Las ventas del día están únicamente en `fvposdb.log`** hasta el próximo arranque.
- [x] Con la **Fase 7** el horario ya no depende de esto: se puede publicar cada hora con el POS abierto (ver P5). Sin la Fase 7, la única opción era publicar a la mañana, después de abrir el POS, con los datos del día anterior.

### P5. 🧑 Programar la publicación automática

Con el **Programador de tareas** (interfaz gráfica, para tener todas las opciones):

- [ ] Crear tarea básica → nombre "FV Publicar reportes".
- [ ] Desencadenador: **diario a las 09:30, repetir cada 1 hora durante 13 horas** (hasta las 22:30). Con la Fase 7, cada publicación incluye las ventas del día hasta ese momento.
  - Son ~13 deploys por día (~400 por mes). El plan gratis de Cloudflare Pages tiene un límite de 500 *builds* por mes. No está confirmado si cuenta los deploys hechos con `wrangler`: revisarlo antes de subir la frecuencia.
  - Si la PC queda prendida después del cierre, sumar una ejecución a las 23:00 para tener el día completo.
- [ ] Acción: iniciar programa `C:\fv-reportes\scripts\publish-task.cmd`.
- [ ] En Propiedades:
  - General: "Ejecutar solo cuando el usuario haya iniciado sesión" (más simple, no pide contraseña) si la PC queda con sesión abierta. Si no, "Ejecutar tanto si el usuario inició sesión como si no".
  - Configuración: marcar **"Ejecutar la tarea lo antes posible si se omitió un inicio programado"** (por si la PC estaba apagada).
  - Configuración: "Detener la tarea si se ejecuta durante más de" 1 hora.
- [ ] Probar con clic derecho → **Ejecutar**, y revisar `logs\publish.log`.
- [ ] Al día siguiente, confirmar en el celular que "Datos al …" muestra la fecha nueva.

Alternativa por consola (sin las opciones de "lo antes posible"):
`schtasks /Create /TN "FV Publicar reportes" /SC DAILY /ST 09:30 /RI 60 /DU 13:00 /TR "C:\fv-reportes\scripts\publish-task.cmd"`

### P6. 🧑 Dar acceso a los usuarios

- [ ] Agregar los mails (por ejemplo, el de tu papá) al **Access Group "Familia"** en Zero Trust. No hace falta volver a publicar.
- [ ] En su celular: abrir `https://panel-ventas-fv.pages.dev`, poner su mail y el código que le llega.
- [ ] iPhone: Compartir → **Agregar a pantalla de inicio**. Ojo: el ícono agregado tiene sus propias cookies, así que pide el código de nuevo **adentro** del ícono. Hasta la Fase 5 se ve como una página web; después, como app.

### P7. Antes de compartir: corregir los datos que distorsionan los reportes

Ver "Pendientes de datos y bugs conocidos". Recomendado antes de que otros usen los números:

- [ ] **Orden 27571** ($7,8 billones): hoy la pestaña Ventas la suma en cualquier rango que la incluya (Histórico ya filtra órdenes > $10M). Excluir outliers en un solo lugar (parser o cálculo de métricas).
- [ ] **Fiambrería Ticket (25912)**: contar 1 unidad por línea, para que no infle las unidades.

### P8. Mantenimiento

- **Actualizar el código** en la PC del POS después de un cambio: `git pull`, `npm ci` (si cambió `package-lock.json`) y `scripts\publish-task.cmd --build`. Sin `--build` se sigue publicando el front viejo con datos nuevos.
- **Si deja de actualizar**: el celular muestra "Datos al …" en rojo después de 36 h. Revisar `logs\publish.log` en la PC del POS.
- **Token**: si vence o se revoca, el log muestra un error de autenticación de wrangler. Crear uno nuevo (P2) y actualizar `.env`.
- **Usuarios**: ver "Gestión de usuarios" en la Fase 3.
- Opcional a futuro: aviso automático si la publicación falla (por ejemplo, un mail o una notificación), para no depender de ver el rojo en el celular.

---

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

## Fase 3: publicación automática 🟡 (falta la PC del POS: P2–P5)

### Hecho en el repo

- [x] `wrangler` como devDependency.
- [x] **`scripts/publish.mjs`** (`npm run publish -- [--build] [--db <ruta>] [--dry-run]`):
  1. Lee `.env` (`CF_PAGES_PROJECT`, opcional `FV_DB_PATH`; `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` si no hay `wrangler login`). Ver `.env.example`.
  2. **Chequeo de seguridad:** pide `https://<proyecto>.pages.dev/` y exige el redirect a `*.cloudflareaccess.com` (o 401/403 con cabeceras `cf-access`). Si la URL está abierta o no responde, **no publica**. En `--dry-run` solo avisa.
  3. Rearma el front solo con `--build` o si falta `dist/index.html`. Copia `public/_headers` siempre.
  4. `export-snapshot.mjs --out dist/data`.
  5. `wrangler pages deploy dist --branch main`.
  6. Repite el chequeo sobre la URL propia del deploy (`<hash>.<proyecto>.pages.dev`) y falla si está abierta.
  - Log en `logs/publish.log` (ignorado por git). Sale con código ≠ 0 si algo falla.
  - Probado: se niega con proyecto inexistente y con un `pages.dev` público; `--dry-run` genera `dist/data` (4,3 MB).
- [x] **`public/_headers`**: `no-cache` para `/`, `/index.html` y `/data/*`; cache inmutable para `/assets/*`; `noindex` y `no-referrer` en todo.
- [x] **`scripts/publish-task.cmd`**: wrapper para el Programador de tareas.
- [x] `electron-builder` excluye `dist/data/**` para que el instalador no lleve los datos.

### Pendiente (lo hace el usuario, en este orden)

**El orden importa: Access tiene que estar activo antes del primer deploy.** El script lo verifica igual.

- [x] **1. Login de wrangler** en la Mac: `npx wrangler login`.
- [x] **2. Crear el proyecto** sin subir nada: `npx wrangler pages project create panel-ventas-fv --production-branch main`. Si el nombre está tomado, usar otro y ponerlo en `CF_PAGES_PROJECT`.
- [x] **3. Cloudflare Access** (equipo `hidden-darkness-abda`) (one.dash.cloudflare.com, plan Free de Zero Trust, hasta 50 usuarios; la primera vez pide elegir un nombre de equipo y puede pedir tarjeta aunque sea gratis):
  - Access → Applications → Add → **Self-hosted**.
  - Dominios: `panel-ventas-fv.pages.dev` **y** `*.panel-ventas-fv.pages.dev` (los deploys y previews).
  - Session duration: 1 mes.
  - Crear un **Access Group "Familia"** con los emails permitidos y una política *Allow → Include → Group: Familia*.
  - Login: **One-time PIN**. **No viene activo**: el único método por defecto es "Cloudflare" (cuenta de Cloudflare) con redirección automática. Hay que agregarlo en Integrations → Identity providers → Add new → One-time PIN, y en la aplicación → Login methods marcar solo One-time PIN y desactivar *Instant Auth*.
  - Opcional: **Google** en el mismo lugar. Redirect URI para Google Cloud: `https://hidden-darkness-abda.cloudflareaccess.com/cdn-cgi/access/callback`.
  - Después del código, un **522** significa que el proyecto todavía no tiene deploy.
  - Comprobar: abrir la URL en una ventana privada → debe aparecer la pantalla de login de Cloudflare.
- [ ] **4. Token de API** (solo para la PC del POS; en la Mac alcanza con `wrangler login`): ver **P2** en "Próximos pasos".
- [x] **5. Primera publicación** desde la Mac (2026-10-14): `npm run publish -- --build`. Verificado: sin login, `/`, `/data/*` y la URL del deploy responden 302 al login de Access.
  - El front todavía no lee `/data` (Fase 4): en el celular se ve el selector de archivo.
- [ ] **6. PC del POS (Windows)**: ver **P3 a P5** en "Próximos pasos".
- [x] **7. Verificar cómo sirve Pages el `.gz`** (resuelto en la Fase 4: el front detecta los dos casos) (necesita una sesión de Access; se hace en la Fase 4 desde el navegador): si llega con `Content-Encoding: gzip`, el navegador ya lo descomprime. El front debe mirar los primeros bytes (`1f 8b` = todavía comprimido) antes de usar `DecompressionStream`. Límite de Pages: 25 MiB por archivo; hoy 4,3 MB.

### Gestión de usuarios (después)

- Lista de emails: Zero Trust → Access → **Access Groups → "Familia"** (o en la política de la aplicación). El cambio aplica al instante, sin redeploy.
- Cada persona entra con **su propio** email; el código le llega a su casilla. El dueño de la cuenta no recibe nada.
- Quitar a alguien **no corta su sesión** activa: además ir a **My Team → Users → Revoke session**.
- Ver quién entró: **Logs → Access**.
- iPhone: la PWA instalada tiene cookies aparte de Safari, hay que loguearse dentro de la app instalada (el PIN funciona bien ahí).

## Fase 4: el front carga el snapshot ✅

- [x] **`src/lib/loadSnapshot.js`**:
  - `readCachedSnapshot()`: la última foto guardada en **IndexedDB** (base `fv-panel`, store `snapshot`, clave `current`). Guarda el `.gz` tal cual (4,3 MB) y la `meta`; al abrir lo vuelve a decodificar. Cualquier error de IndexedDB se ignora.
  - `fetchMeta()`: `./data/meta.json` con `cache: "no-store"`. Devuelve `null` si no hay snapshot en ese origen (dev, Electron, sin red, sesión de Access vencida), si no es JSON o si la versión no coincide.
  - `fetchSnapshot(meta)`: baja `./data/snapshot.json.gz?v=<generatedAt>`, decodifica y guarda en IndexedDB.
  - **gzip:** mira los primeros bytes (`1f 8b`). Si llega comprimido usa `DecompressionStream("gzip")`; si el navegador ya lo descomprimió, lo lee como texto. Con `wrangler pages dev` llega como `application/gzip` sin `Content-Encoding`, o sea comprimido.
- [x] **Orden de fuentes en `App`** (cambió respecto del plan original: el server local va primero porque lee la base en vivo):
  1. Server local `/api/db-info` → `/api/db` (Electron, LAN). Se descarta si la respuesta no es JSON (en Cloudflare responde el `index.html`).
  2. Snapshot: muestra al instante lo guardado en IndexedDB y después revisa `meta.json`. Si cambió `generatedAt`, baja la foto nueva.
  3. Selector manual.
- [x] `SERVER`: en desarrollo `http://<host>:3001`; en producción, rutas relativas (mismo origen).
- [x] Botón **↻ Actualizar**: en modo snapshot busca una foto nueva; en modo en vivo vuelve a leer la base.
- [x] **"Datos al dd/mm hh:mm"** en el encabezado (visible también en el celular), con `meta.source.modified`. En rojo con "hace N días" si tiene más de 36 h. Si no pudo revisar `meta.json`: "no se pudo buscar datos nuevos · Recargar" (recargar la página dispara el login de Access si la sesión venció).
- [x] Probado en Chrome headless (CDP, ventana de 390 px) contra `wrangler pages dev`:
  - Primera carga (descarga + decodificación): ~1,6 s en la Mac.
  - Segunda carga desde IndexedDB: ~1,3 s.
  - Sin `/data` disponible: muestra lo guardado con el aviso.
  - Modo en vivo con `server.cjs`: 6,5 s (antes 26 s).
- [x] Publicado en Cloudflare el 2026-10-14.
- [x] **Probado en iPhone real** por el usuario (2026-10-14): carga sin elegir archivo. Commit `09a9f88`.
- [ ] Opcional: endpoint `GET /api/snapshot` en `server.cjs`, para que Electron use el formato compacto.
- [ ] Opcional: decodificar en un Web Worker si en el celular tarda más de 2 s.

## Fase 5: PWA instalable ⬜

- [ ] `vite-plugin-pwa`:
  - Manifest con nombre "Panel Ventas FV", `display: standalone`, `theme_color` `#0f1117` e íconos de 192 y 512.
  - Agregar `apple-touch-icon`.
- [ ] El service worker precachea **solo el app shell**. `/data/*` usa `NetworkFirst` o queda fuera del service worker, porque los datos ya los maneja IndexedDB.
- [ ] Probar "Compartir → Agregar a pantalla de inicio" en iPhone y "Instalar app" en Android.

## Fase 6: optimizaciones (si hace falta) ⬜

- [ ] Si el snapshot crece mucho: detalle completo solo de los últimos 13 meses y totales ya sumados por día para la pestaña Histórico.
- [ ] Code-splitting: hoy el bundle de Vite pesa más de 500 kB.

## Fase 7: el parser lee `.script` + `.log` (datos al momento) 🟡 (hecha y publicada; falta la verificación con el checkpoint)

Objetivo: que la foto incluya **todas las ventas hasta el momento de publicar**, sin depender de cuándo FácilVirtual hace el checkpoint (lo hace al arrancar, ver P4). Con esto se puede publicar cada hora.

### Cómo guarda HSQLDB (verificado en el `.script` el 2026-10-14)

- Es **HSQLDB 2.x** y las 28 tablas son `CREATE MEMORY TABLE`: todos los datos están en `fvposdb.script` + `fvposdb.log`. No hay archivo `.data` que leer.
- `fvposdb.script`: el estado completo en el **último checkpoint**.
- `fvposdb.log`: las sentencias SQL ejecutadas **después** de ese checkpoint, en orden.
- El checkpoint (pasa el `.log` al `.script` y vacía el `.log`) ocurre al **abrir** la base (FácilVirtual lo hace en cada arranque) o cuando el `.log` supera **50 MB** (`SET FILES LOG SIZE 50`). `SET FILES WRITE DELAY 500 MILLIS`: el `.log` se escribe con hasta medio segundo de demora.

### Formato del `.log` (confirmado con un `.log` real del 2026-10-15: 1.549 líneas, 76 ventas)

- Una sentencia por línea, fin de línea **CRLF**, ninguna en varias líneas. El archivo termina con salto de línea.
- `INSERT INTO <tabla> VALUES(...)`: igual que en el `.script`, con los mismos escapes `\u00e1`.
- `DELETE FROM <tabla> WHERE <pk>=<valor>`. Todas las tablas que usa el reporte tienen la PK en la primera columna.
- Un `UPDATE` se registra como `DELETE` + `INSERT` de la fila completa. Así aparecen productos, precios, `APP_CONFIG` y `WORKSTATION_CONFIG` (el saldo de caja, en cada venta).
- **Prefijo de sesión `/*C5*/` solo cuando cambia la sesión**: las líneas sin prefijo son de la última sesión nombrada. Ese día trabajaron dos sesiones (C5 y C6) alternándose.
- `COMMIT` explícito al final de cada transacción (408 ese día). No hubo `ROLLBACK`.
- Las ventas entran como `INSERT` de `FVPOS_ORDER` + `FVPOS_ORDER_LINE` + `FVPOS_CASH_OPERATION`. Las órdenes del `.log` siguen sin huecos a la última del `.script` (148981 → 148982).
- ❓ No hubo ninguna anulación ni modificación de venta: falta ver cómo aparecen (ver pendientes).
- La copia del `.log` se puede hacer a mano con el POS abierto (Explorador o `copy`). El backup con 7-Zip lo descarta porque está en uso.

### Tareas

- [x] Conseguir un `.log` real: copia del 2026-10-15 a las 20:34 (en la Mac, `~/Downloads/fvposdb.tmp/`).
- [x] Confirmar el formato con la muestra (ver arriba).
- [x] **Refactor del parser** (`src/lib/parseHSQL.js`): capa 1, sentencias → filas crudas por tabla indexadas por PK; capa 2, el `.log` aplicado en orden; capa 3, `orders`, `orderLines`, etc. (la lógica de antes).
  - Nueva API: `parseHSQL({ script, log }, info?)`. `info` devuelve lo aplicado del `.log` y las advertencias. `parseHSQLScript(text)` sigue andando.
  - Con solo el `.script` da **idéntico** al parser anterior (comparado en las bases del 13/10 y del 15/10), un 10% más lento (~4 s).
  - Una fila modificada vuelve a su lugar por PK, como en el `.script`.
- [x] **Transacciones**: las sentencias de cada sesión se guardan hasta su `COMMIT`. `ROLLBACK` las descarta, y lo que queda sin `COMMIT` al final no se aplica (`ROLLBACK TO SAVEPOINT` descarta la transacción entera y avisa).
- [x] **Última línea a medio escribir**: si el archivo no termina en salto de línea, la última línea se ignora.
- [x] **Lectura consistente** (`server/src/readPosDb.mjs`): lee los dos archivos y vuelve a mirarlos. Si el `.script` cambió o el `.log` se achicó (hubo un checkpoint en el medio), reintenta hasta 3 veces. Que el `.log` crezca mientras se lee es normal. Solo lectura.
- [x] **`export-snapshot.mjs`**: con `--db <ruta>.script` busca `<ruta>.log` al lado; si no existe, sigue solo con el `.script`. Opción `--no-log`. `meta.source` agrega `script: { size, modified }` y `log: { size, modified }`.
- [x] **"Datos al …"**: `meta.source.modified` pasa a ser la escritura más nueva entre el `.script` y el `.log`. Con la muestra da 20:34, la hora de la última venta.
- [x] **Electron / server local**: `/api/db` (mandaba el `.script` crudo) se reemplazó por `GET /api/snapshot`, que arma la foto en Node con `.script` + `.log`, en el mismo formato que la publicada. `/api/db-info` informa también el `.log`. `FV_DB_PATH` permite usar otra ruta. El build de Electron incluye `src/lib/`.
- [x] **Selector manual**: acepta el `.script` solo o junto con el `.log` (selección múltiple o arrastrando los dos).
- [x] Pruebas: `scripts/test-parse-log.mjs` cubre los casos que la muestra no trae (rollback, sesiones intercaladas, modificación y anulación, sin `COMMIT`, línea cortada).
- [x] Publicado el 2026-10-15 con la copia de las 20:34: 76 ventas del día ($1.082.081) que el `.script` solo no tenía.
- [ ] 🧑 **Verificación con datos reales** (`scripts/verify-log.mjs`, la prueba clave):
  1. Estado A: la copia del 15/10 a las 20:34 (`.script` + `.log`), ya está.
  2. Estado B: el 16/10, **después de que arranque el POS** (~09:15), copiar el `fvposdb.script` nuevo (el checkpoint ya pasó el `.log` al `.script`). Si se puede, hacer antes **una anulación y una modificación de prueba** el día de la copia A, anotando la hora.
  3. `node scripts/verify-log.mjs <A>/fvposdb.script <B>/fvposdb.script`: tiene que dar ✓ en órdenes, líneas, pagos y caja hasta la última orden de A.
- [ ] 🧑 Probar en la PC del POS que Node puede leer `fvposdb.log` con el POS abierto (7-Zip falla con ese archivo; el Explorador puede copiarlo). Si falla, `publish.log` lo muestra.
- [x] Horario de **P5** revisado: cada hora de 9:30 a 22:30.

## Fase 8: rediseño del look & feel y de la estructura de los reportes ✅ (publicado y probado en iPhone y Android el 2026-10-14)

Objetivo: que los reportes se vean profesionales, se lean bien en el celular (uso principal) y estén ordenados por la pregunta que responden, no por el tipo de gráfico.

### Herramienta

- Usar la skill **`frontend-design`** de `anthropics/skills` (`anthropics/skills@frontend-design`).
  - [x] Instalarla en el proyecto (`.claude/skills/`), por ejemplo con `npx skills add anthropics/skills@frontend-design`, y commitearla para que esté disponible en cualquier sesión.
  - Para los gráficos, complementar con la skill **`dataviz`** (paleta, ejes, tooltips y modo claro/oscuro consistentes).

### Tareas

- [x] **Relevamiento** (se hizo sobre el código: cada métrica se mantuvo y se reubicó por sección): capturas actuales (celular y escritorio) de Ventas e Histórico IPC; lista de cada métrica y gráfico, qué pregunta responde y si se usa.
- [x] **Arquitectura de información**: se eligió reordenar lo existente sin métricas nuevas, en 4 secciones: **Ventas** (total, por hora/día, cajeros, cuánto gasta cada cliente), **Productos** (rubros, más vendidos, candidatos 3x2), **Pagos** e **Histórico** (últimos meses + año por año). Resumen comparativo y Caja quedan para después. Propuesta original:
  - **Resumen**: hoy / ayer / semana / mes, comparados con el período anterior y el mismo período del año pasado (en pesos y ajustado por IPC).
  - **Ventas**: evolución por día y por hora, ticket promedio y mediana, cantidad de operaciones.
  - **Productos y categorías**: top por importe y por unidades, categorías, candidatos a promociones.
  - **Medios de pago**: efectivo vs MercadoPago, evolución.
  - **Caja**: aperturas y cierres, retiros, diferencias (requiere revisar las 818 ventas con monto distinto; ver pendientes de datos).
  - **Histórico IPC**: lo actual, mejorado.
- [x] **Sistema de diseño** (dirección "etiqueta de góndola": la venta total es una etiqueta de precio amarilla, Barlow / Barlow Condensed, tokens en `src/index.css`, colores de gráficos en `src/lib/theme.js` validados con la skill dataviz): tokens de color, tipografía, espaciado y radios en un solo lugar; modo oscuro (actual) y claro; reemplazar los estilos inline repetidos.
- [x] **Mobile first**: navegación inferior con pestañas en el celular, barra lateral en escritorio; selector de período cómodo con el pulgar; tarjetas de KPI legibles a 390 px.
- [x] **Estructura del código**: partir `ventas-dashboard.jsx` (~1.700 líneas) en:
  - `src/lib/metrics.js`: cálculos puros (sin React), testeables.
  - `src/components/`: tarjetas, gráficos, filtros, navegación.
  - `src/pages/`: una página por sección.
  - Corregir de paso los 11 errores de lint viejos. (Hecho: `npm run lint` sin errores.)
- [x] **Sin cambios en los números**: comparado con 5 rangos fijos (día, semana, mes, mes con franja horaria, año), histograma, resumen mensual y anual: idénticos. Después se corrigió `toYMD` (usaba UTC): las ventas después de las 21 h caían en el día siguiente en "ventas por día" y "mejor día" (la semana mostraba 8 barras y septiembre 31). Los totales no cambian. Requisito original: antes de refactorizar, guardar las métricas de 3 o 4 rangos fijos (un día, una semana, un mes, un año) y compararlas después. Tienen que dar igual, salvo las correcciones de datos de P7.
- [x] **Rendimiento**: code-splitting por página (`React.lazy`; Recharts queda en su propio chunk). En los teléfonos de prueba anduvo bien; un Web Worker queda solo si se nota lento con más datos.
- [ ] Coordinar con la **Fase 5 (PWA)**: íconos, `theme_color` y pantalla de inicio con la misma identidad visual.
- [x] Probar en iPhone y en Android antes de publicar; publicar con `npm run publish -- --build`. Publicado el 2026-10-14 (con la base del 13/10, usando la sesión de `wrangler login` de la Mac) y probado en ambos: todo funciona bien.

### Orden sugerido

P7 (datos) → Fase 7 (`.log`) → Fase 8 (rediseño) → Fase 9 (IPC automático) → Fase 5 (PWA, con la identidad nueva). La Fase 8 conviene después de la 7 porque el cálculo de "Datos al …" y las fuentes de datos cambian.

---

## Fase 9: IPC del INDEC automático ⬜

Objetivo: que el ajuste por inflación (Histórico IPC y comparaciones "ajustado por IPC") use siempre el último dato oficial, sin editar código. Hoy `src/lib/ipc.js` tiene la variación mensual escrita a mano y quedó en abril de 2026.

### Fuentes (verificadas el 2026-10-15)

- **INDEC, CSV oficial** (recomendada): `https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_divisiones.csv`
  - ~1,2 MB, separado por `;`, codificación **ISO-8859-1** (latin1), fin de línea CRLF, decimales con **coma** (`2,1`) y `NA` cuando no hay dato.
  - Columnas: `Codigo;Descripcion;Clasificador;Periodo;Indice_IPC;v_m_IPC;v_i_a_IPC;Region`. `Periodo` es `AAAAMM`, `v_m_IPC` es la variación mensual en %.
  - Filas que interesan: `Codigo = 0` (nivel general) y `Region = Nacional`. También está `Codigo = 01` (**Alimentos y bebidas no alcohólicas**), más representativo para un supermercado.
  - Se actualizó el 13/10/2026 (`Last-Modified`) con el dato de septiembre (1,9%). Coincide con los valores cargados a mano en 2025–2026.
- **API de Series de Tiempo** (`apis.datos.gob.ar`, serie `148.3_INIVELNAL_DICI_M_26`, `representation_mode=percent_change`): JSON cómodo, pero **atrasada**: el 15/10 llegaba solo hasta julio de 2026. Queda como respaldo.

### Tareas

- [ ] **Arreglo inmediato** (sin esperar esta fase): completar a mano en `src/lib/ipc.js` mayo a septiembre de 2026: 2,1 · 1,9 · 2,1 · 1,7 · 1,9.
- [ ] `src/lib/indec.js`: función pura `parseIpcCsv(text)` → `{ [año]: [12 variaciones mensuales o null] }` (mismo formato que hoy `IPC`), con la serie elegida (nivel general y, opcional, alimentos). Sin red ni `fs`, para poder probarla.
- [ ] `scripts/fetch-ipc.mjs` (o adentro de `export-snapshot.mjs`): baja el CSV con timeout (~20 s), lo decodifica como latin1 y lo parsea.
  - **Validación antes de usarlo**: meses consecutivos sin huecos, valores entre −5% y 30%, y que coincida con lo ya conocido (los datos viejos no deberían cambiar; si cambian, avisar en el log).
  - Si falla la descarga o la validación: usar la última copia buena y seguir. **Publicar nunca falla por el IPC**; solo avisa en `publish.log`.
- [ ] **Última copia buena**: guardarla en `snapshot/ipc.json` (fuera del repo) con la fecha de descarga y el `Last-Modified` del INDEC. Si no hay ninguna, usar el valor de `src/lib/ipc.js`.
  - El INDEC publica una vez por mes (a mediados de mes): con un `HEAD` y el `Last-Modified` se evita bajar el archivo en cada publicación horaria.
- [ ] **Snapshot**: agregar `ipc` a la foto (un mapa más, `encodeSnapshot` lo toma solo) y `meta.ipc = { hasta: "2026-09", descargado, fuente }`.
- [ ] **Front**: `acumuladoFactor` y `ultimoIpc` usan `db.ipc` si viene en la foto, y si no, `IPC` de `src/lib/ipc.js`. La nota de fuente muestra "IPC INDEC hasta sep 2026".
- [ ] **Server local / Electron**: `/api/snapshot` hace lo mismo (con internet, el dato nuevo; sin internet, la última copia guardada o el valor del código).
- [ ] Opcional: elegir el índice en Histórico (**nivel general** o **alimentos y bebidas**). Decidir antes con el usuario cuál usar por defecto.
- [ ] Verificación: `parseIpcCsv` sobre el CSV del 13/10 tiene que dar los mismos valores que `src/lib/ipc.js` para 2023–abril 2026, y los de mayo a septiembre de arriba. Probar también sin red (corta la descarga): la publicación termina bien y usa la copia guardada.

## Pendientes de datos y bugs conocidos

- [ ] **Orden con un total absurdo:** `ORDER_ID 27571`, del 2022-02-19 12:29, con total **$7.792.798.007.387** y pagada en efectivo. La siguiente más grande es de $237M y la mediana de $3.356. Probablemente se cargó un código de barras como cantidad. Distorsiona los totales de cualquier período que la incluya.
  - Opciones: excluirla en el parser, marcar outliers, o corregirla en el POS.
- [ ] **Producto 25912 "Fiambrería Ticket":** se carga con PRICE = 1 y QTY = importe de la balanza (4.087 líneas). El subtotal da bien, pero infla las **unidades**: Top 10 por cantidad, total de unidades y unidades por mes.
  - Opción: contar 1 unidad por línea cuando PRICE = 1.
- [ ] **818 ventas en caja** donde `operationAmount` es distinto del total de la orden. Seguramente son pagos mixtos (parte efectivo, parte MercadoPago). Revisarlas antes de armar un reporte de caja.
- [ ] **4 órdenes** donde la suma de pagos no coincide con el total: ids 120062, 120119, 120196 y 120288 (pagos menores al total).
- [ ] **Cómo aparecen en el `.log` las anulaciones y modificaciones de ventas.** En la muestra del 15/10 no hubo ninguna: solo `INSERT` de órdenes y ningún `DELETE` sobre `FVPOS_ORDER`, `FVPOS_ORDER_LINE` ni `FVPOS_CASH_OPERATION`. Se supone `DELETE` + `INSERT` con otro `STATUS` (el parser ya lo soporta y está probado con datos armados), pero falta confirmarlo con un caso real. Puede ser también un `DELETE` de líneas o de la operación de caja, o un `DELETE` sin PK (`… AND …`). Este último no se aplica y aparece como ⚠ en la salida de `export-snapshot`.
  - Cómo: anular y modificar una venta de prueba con el POS abierto, anotar la hora y copiar el `.log`. Buscar `ORDER_ID=<id>` en el archivo.
- [ ] 📝 **Nota personal, fuera del plan: el backup diario no incluye `fvposdb.log`.** El 7-Zip del backup descarta `fvposdb.log` y `fvposdb.lck` porque el POS los tiene abiertos. Cada backup hecho con el POS abierto pierde lo vendido desde el último arranque hasta la hora del backup: si hubiera que restaurarlo, faltarían esas ventas. La app no depende de este backup.
  - Arreglo: agregar `-ssw` al comando de 7-Zip (comprime también los archivos abiertos para escritura), o copiar primero `data\` a una carpeta temporal y comprimir la copia (lo que se hizo a mano el 15/10). El `.lck` no hace falta.
  - Comprobar después que el `.7z` contenga `fvposdb.log`.
- [x] Lint: `ventas-dashboard.jsx` tenía 11 errores de antes de este plan (variables sin usar, "Cannot create components during render"). No se tocaron. El de "setState dentro de un effect" desapareció al reescribir la carga en la Fase 4.

## Cómo verificar cambios en el parser o el snapshot

```bash
npm run snapshot        # debe terminar con "✓ Snapshot generado" y mostrar las cantidades
node scripts/test-parse-log.mjs   # casos del .log armados a mano
npm run build
npx eslint src/lib scripts
```

Prueba de ida y vuelta (no está en el repo; se puede recrear como `scripts/verify-snapshot.mjs`):
1. Correr `parseHSQLScript` sobre la base.
2. Leer `snapshot/snapshot.json.gz` y pasarlo por `decodeSnapshot`.
3. Comparar cada campo de cada fila: fechas por `getTime()` y números con tolerancia de 1e-4.
4. Debe dar 0 diferencias. Repetir con `TZ=America/New_York`.
