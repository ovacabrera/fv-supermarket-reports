# Plan: reportes en el celular sin seleccionar archivo

> Documento de traspaso para seguir el trabajo en otra sesión de chat.
> Marcado: `[x]` hecho y commiteado · `[ ]` pendiente.
> Última actualización: 2026-10-16.

## Objetivo

El usuario abre la app en el celular y **ve los reportes enseguida**, sin elegir ningún archivo.
Los datos salen de la última "foto" de la base del POS, ya procesada.

## Estado actual (2026-10-16)

- ✅ **Funciona de punta a punta desde la Mac**: `npm run publish` genera la foto y la sube a `https://panel-ventas-fv.pages.dev`, protegido con Cloudflare Access (código por mail, grupo "Familia").
- ✅ **Probado en iPhone**: abre los reportes sin elegir archivo, guarda la foto en el teléfono y muestra "Datos al …".
- ✅ **Rediseño publicado (Fase 8)**: reportes nuevos, pensados para el celular, probados en iPhone y Android el 2026-10-14.
- ✅ **En producción desde la PC del POS** (2026-10-16): instalada (P3) y publicando sola con el Programador de tareas a las **10, 14, 19 y 22 h** (P5). Probado con "Ejecutar" desde el Programador.
- ✅ **Usuarios con acceso** (P6, 2026-10-16) y **actualización automática verificada**: la ejecución de las 14:00 actualizó los datos sola.
- ✅ **Front y datos separados (Fase 11)**, en producción el 2026-10-16: la PC del POS sube solo los datos a Workers KV (en partes de 256 KB) y el front se publica aparte desde la Mac con `npm run deploy:front`. Falta ver que una publicación programada ande sola con el código nuevo.
- ⬜ Falta corregir los datos que distorsionan los reportes (P7, con los ajustes del cliente de la Fase 10).
- ⬜ **Repo de GitHub público**: por ahora se deja así, a propósito (ver P1).
- 🟡 **Fase 7 (leer también el `.log`)**: hecha en el repo y publicada el 2026-10-15 con las ventas del día incluidas. El 2026-10-16 se confirmó en la PC del POS que Node lee `fvposdb.log` con el POS abierto. Falta la verificación contra el checkpoint del día siguiente.
- 🟡 **IPC (Fase 9)**: hecha en el repo el 2026-10-15. Cada publicación baja del CSV oficial del INDEC el rubro **Alimentos y bebidas no alcohólicas** (nacional) y lo mete en la foto. Publicada el 2026-10-15. Falta ver en noviembre que tome sola el dato de octubre.
- ✅ **Reportes nuevos (Fases 12 a 17)**: publicados en producción el 2026-10-16. Hay una sección nueva, **Góndola**, con precios sin actualizar, inflación propia y faltantes probables. Además: comparación con otros períodos en Ventas, Pareto y pares en Productos, y mapa de calor en Histórico. La **Fase 18** (caja y anulaciones) se descartó: no hay datos.
- 🟡 **Consultor de precios (Fase 19)**: front en producción el 2026-10-16. Sección **Precios**: buscar por nombre o código y escanear con la cámara. Falta que la PC del POS haga `git pull` + `npm ci` y publique, y probar el escaneo en iPhone y Android.
- ⬜ Después: **Fase 5** (PWA, con la identidad visual nueva).
- ⬜ **Fase 10 (conectores)**: que los reportes anden con otros sistemas de punto de venta. Se elige la fuente al instalar (`FUENTE=facilvirtual-v1`, …) y cada conector arma la misma foto.

## Próximos pasos: puesta en producción

Objetivo: que los datos se publiquen solos desde la PC del POS, sin intervención, y que los usuarios entren con su mail.
Los pasos van en orden. Los marcados 🧑 los hace el usuario (necesitan la cuenta de Cloudflare o la PC del POS).

### P1. Dejar el repo listo para la PC del POS

- [x] `git push` a GitHub (`ovacabrera/fv-supermarket-reports`), hecho el 2026-10-14 (hasta `c7d3968`).
- [x] Revisado que no se subieron datos ni secretos: la base, `snapshot/`, `dist/`, `logs/` y `.env` están en `.gitignore`.
- [ ] 🧑 ⚠️ **El repo es PÚBLICO** (verificado el 2026-10-14). No tiene datos ni secretos, pero este plan incluye información del negocio (cantidad de órdenes, ticket mediano, uso de MercadoPago, montos de órdenes puntuales), la URL del panel y el nombre del equipo de Access. Los datos siguen protegidos por el login, pero se recomienda **hacerlo privado**: GitHub → repo → Settings → Danger Zone → *Change visibility* → Private.
  - Consecuencia: en P3, el `git clone` en la PC del POS va a pedir login de GitHub (Git for Windows abre el navegador la primera vez y guarda la credencial).
  - **Decisión (2026-10-16): por ahora sigue público.** La PC del POS lo clonó sin login. Si se pasa a privado, el próximo `git pull` en la PC del POS va a pedir login de GitHub.

### P2. 🧑 Token de API de Cloudflare (para la PC del POS)

En la PC del POS no conviene `wrangler login` (sesión personal que vence). Se usa un token limitado:

- [ ] dash.cloudflare.com → My Profile → **API Tokens** → Create Token → *Create Custom Token*.
  - Permisos: **Account → Cloudflare Pages → Edit** y, desde la Fase 11, **Account → Workers KV Storage → Edit**. Nada más.
  - Account Resources: solo esta cuenta.
  - Opcional: sin vencimiento, o con vencimiento anual y anotar la fecha para renovarlo.
- [ ] Anotar también el **Account ID** (Workers & Pages → columna derecha).
- [ ] Guardar el token en un lugar seguro (gestor de contraseñas). No se puede volver a ver en Cloudflare.

### P3. 🧑 Instalar en la PC del POS (Windows) ✅ (2026-10-16)

- [x] Instalar **Node.js LTS** (nodejs.org) y **Git for Windows**. Verificar con `git --version`, `node -v` (≥ v20, lo pide wrangler 4) y `npm -v`, en una consola abierta después de instalar.
- [x] Clonar el repo en una carpeta fija, por ejemplo `C:\fv-reportes`:
  `git clone https://github.com/ovacabrera/fv-supermarket-reports.git C:\fv-reportes`
  (con el repo privado, Git pide login de GitHub la primera vez; usar la cuenta dueña del repo).
- [x] En esa carpeta: `npm ci`. **Wrangler no se instala aparte**: es dependencia de desarrollo y `publish.mjs` usa la copia local con `npx wrangler`.
- [x] Crear `C:\fv-reportes\.env` a partir de `.env.example` (`copy .env.example .env` y `notepad .env`) con `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y `CF_PAGES_PROJECT=panel-ventas-fv`. Formato `NOMBRE=valor`, sin comillas ni espacios. Ojo con que el Bloc de notas no lo guarde como `.env.txt`.
  - Account ID: `npx wrangler whoami` en la Mac, o en la URL del panel (`dash.cloudflare.com/<account id>/…`).
  - Prueba sin publicar: `node scripts\publish.mjs --build --dry-run`.
- [x] Probar a mano: `scripts\publish-task.cmd --build`.
  - El primer intento falló en Windows: con `shell: true` el `--commit-message "Datos al …"` llegaba a wrangler partido en palabras (`Unknown arguments: al, …`). Arreglado en `3cf30ee` (`publish.mjs` cita los argumentos con espacios en Windows).
  - Debe terminar con `✓ Publicado en https://panel-ventas-fv.pages.dev/`.
  - En el celular, **↻ Actualizar**: "Datos al …" tiene que mostrar la fecha de la base del POS, en verde.
  - Si falla, mirar `C:\fv-reportes\logs\publish.log`.

### P4. Cuándo se actualiza `fvposdb.script` ✅ (respondido el 2026-10-15 con los logs del POS)

HSQLDB guarda los cambios recientes en `fvposdb.log` y recién los pasa a `fvposdb.script` en un *checkpoint*.

- [x] **FácilVirtual hace el checkpoint al arrancar** (alrededor de las 09:10), no al cerrar. En `logs\fvpos.log.<fecha>` aparece `checkpointClose start … checkpointClose end`, seguido de `Stopping HSQL server...` y `Starting HSQL server...`. Visto el 1, 3, 5, 11, 12, 13 y 15/10. Al cerrar no aparece ningún checkpoint.
  - Consecuencia: durante el día, y también a la noche después del cierre, el `.script` llega solo hasta el día anterior. **Las ventas del día están únicamente en `fvposdb.log`** hasta el próximo arranque.
- [x] Con la **Fase 7** el horario ya no depende de esto: se puede publicar cada hora con el POS abierto (ver P5). Sin la Fase 7, la única opción era publicar a la mañana, después de abrir el POS, con los datos del día anterior.

### P5. 🧑 Programar la publicación automática ✅ (2026-10-16)

Con el **Programador de tareas** (interfaz gráfica, para tener todas las opciones):

- [x] Crear tarea básica → nombre "FV Publicar reportes".
- [x] Desencadenador: **4 ejecuciones diarias, a las 10:00, 14:00, 19:00 y 22:00** (decidido el 2026-10-16). Con la Fase 7, cada publicación incluye las ventas del día hasta ese momento. Son ~120 deploys por mes, bien por debajo del límite de 500 del plan gratis.
  - Plan original, por si se quiere más frecuencia: diario a las 09:30, repetir cada 1 hora durante 13 horas (hasta las 22:30).
  - Son ~13 deploys por día (~400 por mes). El plan gratis de Cloudflare Pages tiene un límite de 500 *builds* por mes. No está confirmado si cuenta los deploys hechos con `wrangler`: revisarlo antes de subir la frecuencia.
  - Si la PC queda prendida después del cierre, sumar una ejecución a las 23:00 para tener el día completo.
- [ ] Acción: iniciar programa `C:\fv-reportes\scripts\publish-task.cmd`.
- [ ] En Propiedades:
  - General: "Ejecutar solo cuando el usuario haya iniciado sesión" (más simple, no pide contraseña) si la PC queda con sesión abierta. Si no, "Ejecutar tanto si el usuario inició sesión como si no".
  - Configuración: marcar **"Ejecutar la tarea lo antes posible si se omitió un inicio programado"** (por si la PC estaba apagada).
  - Configuración: "Detener la tarea si se ejecuta durante más de" 1 hora.
- [x] Probar con clic derecho → **Ejecutar**, y revisar `logs\publish.log`. Anduvo el 2026-10-16.
- [x] Confirmar en el celular que "Datos al …" se actualiza solo: la ejecución automática de las 14:00 del 2026-10-16 actualizó los datos sin problemas.

Alternativa por consola (sin las opciones de "lo antes posible"):
`schtasks /Create /TN "FV Publicar reportes" /SC DAILY /ST 09:30 /RI 60 /DU 13:00 /TR "C:\fv-reportes\scripts\publish-task.cmd"`

### P6. 🧑 Dar acceso a los usuarios ✅ (2026-10-16)

- [x] Agregar los mails (por ejemplo, el de tu papá) al **Access Group "Familia"** en Zero Trust. No hace falta volver a publicar. Hecho el 2026-10-16.
- [ ] En su celular: abrir `https://panel-ventas-fv.pages.dev`, poner su mail y el código que le llega.
- [ ] iPhone: Compartir → **Agregar a pantalla de inicio**. Ojo: el ícono agregado tiene sus propias cookies, así que pide el código de nuevo **adentro** del ícono. Hasta la Fase 5 se ve como una página web; después, como app.

### P7. Antes de compartir: corregir los datos que distorsionan los reportes

> Se va a resolver con el archivo de ajustes del cliente de la **Fase 10** (pasos 2 y 2b), sin parches en el código.

Ver "Pendientes de datos y bugs conocidos". Recomendado antes de que otros usen los números:

- [ ] **Orden 27571** ($7,8 billones): hoy la pestaña Ventas la suma en cualquier rango que la incluya (Histórico ya filtra órdenes > $10M). Excluir outliers en un solo lugar (parser o cálculo de métricas).
- [ ] **Fiambrería Ticket (25912)**: contar 1 unidad por línea, para que no infle las unidades.

### P8. Mantenimiento

- **Publicar una versión nueva del front** (desde la Fase 11): desde la Mac, `npm run deploy:front`. Para probar antes: `npm run deploy:front -- --preview` y abrir `https://preview.panel-ventas-fv.pages.dev` (lee los datos reales). No hace falta tocar la PC del POS.
- **Actualizar el código en la PC del POS**: solo si cambió algo de la publicación de datos (parser, snapshot, scripts): `git pull` y `npm ci` (si cambió `package-lock.json`).
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
- [x] **6. PC del POS (Windows)** (2026-10-16): ver **P3 a P5** en "Próximos pasos".
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

Objetivo: que la app siga abriendo rápido en el celular a medida que crecen los datos. No agrega nada visible; es una fase de reserva por si aparece lentitud.

- [ ] **Achicar el snapshot si crece mucho**: detalle completo solo de los últimos 13 meses y totales ya sumados por día para la pestaña Histórico.
  - Por qué: hoy `snapshot.json.gz` (~4,3 MB) trae todas las órdenes con sus líneas desde el primer día de la base. Crece todos los días, y con él la descarga en el celular (sobre todo con datos móviles), la decodificación al abrir (hoy ~1,3–1,6 s) y lo que ocupa en IndexedDB.
  - 13 meses alcanzan para comparar contra el mismo mes del año anterior. De los años más viejos el Histórico solo usa totales por día. Así el archivo deja de crecer sin límite.
- [ ] **Code-splitting**: hoy el bundle de Vite pesa más de 500 kB en un solo archivo (Vite ya avisa al compilar).
  - Partirlo en pedazos para que la primera pantalla cargue rápido y el resto (por ejemplo, los gráficos de pestañas que no se están mirando) se baje recién al abrirlo.

**Cuándo retomarla**: hoy no hace falta (Fase 4: cargas de 1–2 s, y en el iPhone anduvo bien). Conviene encararla si:

- la app tarda varios segundos en abrir en el celular;
- el `.gz` se acerca a 10–15 MB (el límite de Cloudflare Pages es 25 MiB por archivo);
- con la Fase 5 (PWA) hecha, la primera instalación se hace pesada.

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
- [x] 🧑 Probado en la PC del POS que Node puede leer `fvposdb.log` con el POS abierto (2026-10-16): la publicación de las 14:25 dio "Datos al" 14:14, posterior al checkpoint de la apertura. No hace falta copiar el `.log` antes de leerlo: el POS lo abre permitiendo lectura compartida (como el Explorador); 7-Zip falla solo porque sin `-ssw` no comparte escritura.
- [x] Horario de **P5** revisado: 10, 14, 19 y 22 h.

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

P7 (datos) → Fase 7 (`.log`) → Fase 8 (rediseño) → Fase 9 (IPC automático) → Fase 5 (PWA, con la identidad nueva) → Fase 11 (front y datos separados, hecha antes por urgencia) → Fase 10 (conectores; si aparece antes otro sistema, se adelanta). La Fase 8 conviene después de la 7 porque el cálculo de "Datos al …" y las fuentes de datos cambian.

---

## Fase 9: IPC del INDEC automático 🟡 (hecha y publicada; falta ver el dato de octubre)

Objetivo: que el ajuste por inflación (Histórico IPC y comparaciones "ajustado por IPC") use siempre el último dato oficial, sin editar código. Hoy `src/lib/ipc.js` tiene la variación mensual escrita a mano.

**Decisiones (2026-10-15):** única fuente, el **CSV oficial del INDEC**, sin fuente de respaldo. Índice por defecto: **Alimentos y bebidas no alcohólicas, región Nacional** (código `01`), más representativo para un supermercado que el nivel general. El front indica en las fuentes qué índice se usa.

### Fuente (verificada el 2026-10-15)

- **INDEC, CSV oficial**: `https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_divisiones.csv`
  - ~1,2 MB, separado por `;`, codificación **ISO-8859-1** (latin1), fin de línea CRLF, decimales con **coma** (`2,1`) y `NA` cuando no hay dato.
  - Columnas: `Codigo;Descripcion;Clasificador;Periodo;Indice_IPC;v_m_IPC;v_i_a_IPC;Region`. `Periodo` es `AAAAMM`, `v_m_IPC` es la variación mensual en %.
  - Filas que se usan: `Codigo = 01` (**Alimentos y bebidas no alcohólicas**) y `Region = Nacional`. Ojo: `Region` trae el `\r` del fin de línea CRLF. El nivel general es `Codigo = 0`.
  - Se actualizó el 13/10/2026 (`Last-Modified`) con el dato de septiembre (alimentos 2,0%, nivel general 1,9%). El nivel general coincide con los valores que estaban cargados a mano.
- Se descartó la API de Series de Tiempo (`apis.datos.gob.ar`): el 15/10 llegaba solo hasta julio de 2026.

### Tareas

- [x] **Arreglo inmediato** (2026-10-15): `src/lib/ipc.js` pasó a la serie de alimentos y bebidas (2023 a septiembre de 2026), copiada del CSV del 13/10. Cambian los montos "ajustados por IPC" del Histórico, porque antes se usaba el nivel general.
- [x] **Front**: el Histórico indica la fuente (`IPC_FUENTE` en `src/lib/ipc.js`) en "Últimos meses" y en el gráfico anual ("IPC del INDEC, rubro Alimentos y bebidas no alcohólicas (nacional), datos hasta …").
- [x] `src/lib/indec.js`: funciones puras, sin red ni `fs`.
  - `parseIpcCsv(text, { codigo = "01", region = "Nacional" })` → `{ [año]: [12 variaciones mensuales o null] }`, el mismo formato que `IPC`. Busca las columnas por nombre y recorta el `\r` de `Region`. Trae desde 2016.
  - `validarIpc(ipc, conocido)` → `{ errores, avisos }`.
- [x] `server/src/fetchIpc.mjs`: `obtenerIpc({ cachePath, timeoutMs, maxAgeMs })`, que usan `export-snapshot.mjs` y el server local. Baja el CSV con timeout de 20 s, lo decodifica como latin1 y lo parsea.
  - **Validación antes de usarlo** (errores: no se usa): al menos 12 meses, consecutivos y sin huecos, valores entre −5% y 30%, y que no termine antes que lo ya conocido. Si cambian datos ya conocidos, solo avisa.
  - Si falla la descarga o la validación, usa la última copia buena y sigue. **Publicar nunca falla por el IPC**: el aviso (`⚠ IPC: …`) queda en `publish.log`.
- [x] **Última copia buena** en `snapshot/ipc.json` (fuera del repo), con la fecha de descarga, la de la última revisión y el `Last-Modified` del INDEC. Si no hay ninguna, se usa el valor de `src/lib/ipc.js`.
  - Primero hace un `HEAD`: si el `Last-Modified` es el de la copia, no baja el archivo (~0,3 s por publicación).
  - `export-snapshot --no-ipc` no consulta al INDEC y usa la copia guardada.
- [x] **Snapshot**: `db.ipc` es un mapa más (`encodeSnapshot` lo toma solo, sin cambiar la versión). La foto y `meta.json` traen `ipc = { serie, hasta: "2026-09", origen: "indec" | "copia" | "codigo", descargado, lastModified }`. `publish.log` muestra "IPC hasta … (origen)".
- [x] **Front**: `ipcDe(db)` devuelve `db.ipc` si viene en la foto y, si no, `IPC` de `src/lib/ipc.js` (selector manual, fotos viejas guardadas en el celular). Lo usan `computeHistorico`, `computeAnual` (con `acumuladoFactor`) y la nota de fuente del Histórico (`ultimoIpc`). El último mes sale de los datos mismos, no de `meta.ipc`.
- [x] **Server local / Electron**: `/api/snapshot` hace lo mismo, con timeout de 5 s y consultando al INDEC como mucho cada 6 h. La copia va en `~/.fv-panel/ipc.json` (o `FV_IPC_CACHE`), porque dentro de Electron la carpeta de la app puede ser de solo lectura.
- [x] Verificación (2026-10-15):
  - `node scripts/test-ipc.mjs <csv>`: con el CSV del 13/10, da exactamente los valores de `src/lib/ipc.js` (2023 a septiembre de 2026).
  - Casos armados (sin red, con `fetch` falso): sin red y sin copia usa el código; con red baja y guarda; con el mismo `Last-Modified` solo hace el `HEAD`; sin red usa la copia; un archivo que no valida no pisa la copia.
  - `npm run snapshot` contra el INDEC real: "IPC … hasta 2026-09 (INDEC)". Con la foto decodificada, el Histórico da igual que con los valores del código. `/api/snapshot` del server local también trae el IPC.
- [x] Publicado el 2026-10-15 (`npm run publish -- --build`, con la copia de las 20:34): "IPC hasta 2026-09 (indec)".
- [ ] 🧑 Comprobar en el celular que el Histórico siga igual (los valores no cambian: el INDEC llega hasta septiembre, igual que lo cargado a mano).
- [ ] A mediados de noviembre: ver en `publish.log` que haya tomado solo el dato de octubre ("IPC hasta 2026-10").

## Fase 10: reportes independientes de la fuente de datos (conectores) ⬜

Objetivo: que los mismos reportes anden con **otros sistemas de punto de venta**, no solo con FácilVirtual. Al instalar se elige la fuente ("FácilVirtual v1", "ProgramaZ v3", …) y cada fuente tiene su propio **conector**. Todos los conectores entregan **la misma foto**: el front, las métricas, el snapshot y la publicación no se enteran de qué sistema vino.

```text
                 ┌─ conector facilvirtual-v1 (HSQLDB .script + .log) ─┐
base del POS ──► ├─ conector programaz-v3 (lo que use: SQL, CSV, API) ┤──► modelo común ──► ajustes del ──► validación ──► encodeSnapshot ──► foto ──► front
                 └─ …                                                 ┘                     cliente                                         (sin cambios)
```

Tres niveles, cada uno con lo suyo:
- **Conector** (código, uno por sistema): cómo leer e interpretar la base de ese sistema. Igual para todos los clientes que lo usan.
- **Ajustes del cliente** (archivo de texto, uno por instalación): parches sobre datos puntuales de ese negocio. Se edita sin compilar.
- **Reportes** (código, uno solo): solo conocen el modelo común.

### Qué es "independiente de la fuente"

- **El modelo común es el contrato.** Hoy ya existe en la práctica: es lo que devuelve `parseHSQL` (`orders`, `orderLines`, `orderPayments`, `employees`, `categories`, `products`, `paymentTypes`, `cashOperations`). `snapshot.js` y `metrics.js` solo usan eso. Falta escribirlo, versionarlo y validarlo.
- **Todo lo propio de un sistema vive en su conector**: cómo leer los archivos, nombres de tablas y columnas, estados de venta, cómo se registran los pagos y las anulaciones.
- **Todo parche sobre datos puntuales vive en los ajustes del cliente**, nunca en el código: dos clientes con el mismo conector pueden necesitar parches distintos.
- **Hoy hay detalles de FácilVirtual y de este cliente fuera del parser** que hay que mover:
  - `metrics.js`: `FIAMBR_PROD_ID = 25912` (producto "Fiambrería Ticket") y `MAX_ORDEN_RAZONABLE` (órdenes con códigos de barras cargados como cantidad). Son **de este cliente**: van a su archivo de ajustes.
  - Los ids de `paymentTypes` (1–6 medios fijos, 100+ crédito, 200+ débito) son una convención del parser de FV. El reporte necesita saber el **tipo** de medio (efectivo, crédito, débito, …), no el número.
  - `App.jsx`: el selector manual pide `fvposdb.script` / `fvposdb.log` con textos fijos.
  - `server.cjs` y `export-snapshot.mjs`: ruta por defecto `C:\FacilVirtual\data\fvposdb.script`.
  - `readPosDb.mjs`: la lectura consistente `.script` + `.log` es de HSQLDB.

### Diseño propuesto

**Cada conector** es una carpeta con dos partes separadas:
- `read(config)`: solo Node. Lee la fuente (archivos, una base SQL, una API, un export CSV) y devuelve los datos crudos más `source` (tamaño, fecha de modificación → "Datos al …").
- `parse(raw, info)`: JS puro, sin `fs`. Crudo → modelo común. Al ser puro, sirve también en el navegador para el selector manual.
- Datos del conector: `id` (`facilvirtual-v1`), nombre para mostrar, versión, configuración por defecto (ruta, etc.), archivos que acepta el selector manual y qué partes del modelo trae (por ejemplo, un sistema sin operaciones de caja).

**Estructura de carpetas** (tentativa):
```text
src/sources/
  contract.js            modelo común: descripción, versión y validateDb(db)
  index.js               registro de conectores (solo parse; seguro para el navegador)
  facilvirtual-v1/
    parse.js             lo que hoy es src/lib/parseHSQL.js
    read.mjs             lo que hoy es server/src/readPosDb.mjs (solo Node)
    index.js             id, nombre, defaults, archivos del selector
  _plantilla/            esqueleto comentado para arrancar un conector nuevo
server/src/sources.mjs   registro con read (solo Node)
```

**Configuración al instalar**, en el `.env` de la PC del POS:
```ini
FUENTE=facilvirtual-v1
# Opciones propias de la fuente (cada conector define las suyas):
FUENTE_RUTA=C:\FacilVirtual\data\fvposdb.script
```
- Sin `FUENTE`, se usa `facilvirtual-v1`. **La PC del POS actual sigue andando después del `git pull` sin tocar el `.env`.** `FV_DB_PATH` sigue funcionando como sinónimo de `FUENTE_RUTA`.
- Una fuente desconocida o mal configurada hace fallar la publicación con un mensaje claro en `publish.log` (no publica una foto vacía).

**La foto** agrega en `meta.source` qué conector la generó: `fuente: { id, version }`, y en `meta.ajustes` cuántos se aplicaron.

### Ajustes del cliente (archivo de texto)

Ejemplo en el repo: **`config/ajustes.ejemplo.jsonc`** (hecho el 2026-10-16). Cada instalación lo copia como `config/ajustes.jsonc`, que está en `.gitignore`: los ids y montos de un cliente no se suben al repo público. Otra ruta con `AJUSTES=<ruta>` en el `.env`.

- **Formato JSONC** (JSON con comentarios `//`): se edita con el Bloc de notas, el ejemplo se explica solo con comentarios y Node lo lee sin dependencias nuevas. Se descartó YAML porque los errores de sangría son fáciles de cometer y difíciles de ver en el Bloc de notas.
- El archivo declara `cliente` y `conector`. Si `conector` no coincide con `FUENTE`, no publica (los ids de un sistema no valen en otro).
- Cada ajuste tiene `tipo`, `motivo` (obligatorio), `fecha` (opcional) y `activo: false` para apagarlo sin borrarlo. Se aplican en el orden escrito.
- **Tipos del ejemplo**:
  - Órdenes: `omitir_orden` (lista de ids, con sus líneas, pagos y caja), `omitir_ordenes_mayores_a`, `fijar_total_orden` (`lineas`: `proporcional` o `sin_tocar`), `cambiar_medio_pago`, `omitir_periodo`.
  - Productos y rubros: `producto_por_importe` (1 unidad por línea, fuera de los rankings, con rubro propio), `mover_producto_a_rubro`.
  - Nombres: `renombrar` (`cajero`, `rubro`, `producto`, `medio_pago`).
- **Trabajan sobre el modelo común**, no sobre la base: el mismo motor de ajustes sirve para todos los conectores.
- **Log de cada publicación**: qué ajuste se aplicó y a cuántas filas; ⚠ si uno no encontró nada (por ejemplo, una orden que no existe); error con número de línea si el archivo está mal escrito. Un tipo desconocido o un campo faltante frena la publicación: mejor no publicar que publicar con un parche ignorado en silencio.
- **Este cliente** arranca con: `omitir_orden` 27571, `omitir_ordenes_mayores_a` 10.000.000 y `producto_por_importe` 25912 "Fiambrería Ticket". Con eso se resuelve **P7** sin tocar código.
- Respaldo del archivo: como no está en git, guardar una copia junto al `.env` en el gestor de contraseñas o en el backup del negocio. Más adelante se puede pasar a un repo privado de configuraciones.

### Inyección de dependencias

El armado de la foto queda como una función que **recibe** sus piezas en vez de importarlas fijas:

```js
// src/lib/buildSnapshot.js (puro: sin fs, sirve en Node y en el navegador)
buildSnapshot({ conector, raw, ajustes, ipc }, info) → { snap, info }
//   conector.parse(raw, info) → modelo común → aplicarAjustes(db, ajustes, info) → validateDb(db) → encodeSnapshot
```

- **Quién arma las piezas**: `export-snapshot.mjs`, `publish.mjs`, `server.cjs` y Electron resuelven la configuración (`FUENTE`, `FUENTE_RUTA`, `AJUSTES`), cargan el conector y el archivo, hacen el `read` y llaman a `buildSnapshot`. Es el único lugar que conoce rutas y `.env`.
- **El selector manual del front** usa el mismo `buildSnapshot`, con el conector elegido y sin ajustes (o con un archivo de ajustes elegido junto con la base).
- **Pruebas**: se le pasa un conector falso con datos armados y una lista de ajustes en memoria. Cada tipo de ajuste se prueba sin base real.

### Tareas

- [ ] **1. Escribir el contrato** (`src/sources/contract.js`): cada tabla, sus campos, tipos y significado. Decidir:
  - Qué es una venta (solo las completadas; las anuladas no entran).
  - Montos netos de vuelto. Fechas como hora local del negocio, sin zona horaria (como hoy).
  - `paymentTypes` con tipo de medio: `{ id: { name, kind } }`, `kind` ∈ efectivo, crédito, débito, cuenta corriente, cheque, tickets, transferencia, otro.
  - Cómo se marcan los casos especiales que hoy están en `metrics.js`: un campo genérico en la línea (por ejemplo `porImporte: true`), que pone el ajuste `producto_por_importe`. Los reportes leen ese campo, nunca un id.
  - Qué partes son opcionales (`cashOperations`, `employees`, …) y que el front oculte lo que la fuente no trae.
  - `validateDb(db)`: tipos y campos obligatorios, ids de líneas y pagos que apuntan a órdenes existentes, fechas válidas. Errores = no publica; rarezas = advertencias en `publish.log`.
- [ ] **2. Motor de ajustes** (`src/lib/ajustes.js`): leer JSONC con errores por número de línea, validar el archivo (tipos, campos, `conector`), aplicar cada tipo del ejemplo y armar el informe para el log. Pruebas por tipo de ajuste.
  - [x] Archivo de ejemplo `config/ajustes.ejemplo.jsonc` y `.gitignore` para `config/*.jsonc` (2026-10-16).
- [ ] **2b. Sacar lo de este cliente de `metrics.js`** (25912 y el tope de $10M) y crear su `config/ajustes.jsonc` con 27571, el tope y 25912. Cierra **P7**.
  - Prueba: los reportes dan igual que hoy, salvo la orden 27571, que deja de sumar en Ventas.
- [ ] **2c. `buildSnapshot`** con inyección de dependencias (ver arriba).
- [ ] **3. Pasar FácilVirtual a conector** (`facilvirtual-v1`) **sin cambiar ningún resultado**.
  - Prueba clave: con la copia del 15/10 a las 20:34, la foto decodificada tiene que dar **igual** antes y después del cambio (o con diferencias explicadas solo por lo decidido en 1).
  - `test-parse-log.mjs` y `verify-log.mjs` siguen pasando.
- [ ] **4. Registro y configuración**: `FUENTE` / `FUENTE_RUTA` / `AJUSTES` en `export-snapshot.mjs`, `publish.mjs`, `server.cjs` (`/api/snapshot`, `/api/db-info`) y Electron.
- [ ] **5. Selector manual del front**: los archivos que acepta y los textos salen del conector elegido.
- [ ] **6. Versión de la foto**: si el contrato cambia la forma de los datos (por ejemplo `paymentTypes`), subir `SNAPSHOT_VERSION` y comprobar que el celular con una foto vieja guardada no se rompa.
- [ ] **7. Plantilla y guía "Cómo agregar una fuente"** (en este plan o en el README): pasos, qué datos de muestra conseguir y cómo probarlo.
  - Prueba común para todo conector: con sus datos de muestra, `parse` → `validateDb` sin errores, y `encodeSnapshot` → `decodeSnapshot` sin pérdida.
- [ ] **8. Primer conector nuevo**, cuando haya un sistema real: conseguir una copia de su base (o un export) y la documentación de su estructura, y armar el conector con esa muestra.
- [ ] 🧑 Después de publicar los pasos 2 a 6: `git pull` en la PC del POS, copiar ahí `config\ajustes.jsonc`, correr `node scripts\publish.mjs --dry-run` (revisar el informe de ajustes) y después `scripts\publish-task.cmd`. Comprobar que "Datos al …" y los reportes sigan iguales, salvo lo corregido.

### Fuera de esta fase (anotado para después)

- Nombres atados a FácilVirtual en el proyecto: repo `fv-supermarket-reports`, proyecto de Pages `panel-ventas-fv`.
- Varias instalaciones o negocios: cada uno con su PC, su `.env`, su proyecto de Pages y su grupo de Access. Esta fase no cubre un panel con varios negocios a la vez.

## Fase 11: front y datos separados (Workers KV) ✅ (en producción el 2026-10-16; falta ver una publicación programada)

Problema: Cloudflare Pages reemplaza el sitio entero en cada deploy, así que los datos tenían que ir en el mismo paquete que el front. Una versión nueva del front solo podía salir de la PC del POS (la única con la base actual); desde otra máquina se publicaban datos viejos. Además, cada actualización de datos contaba como deploy.

```text
PC del POS ── npm run publish ──► Workers KV "panel-ventas-fv-datos" (meta.json, snapshot.json.gz)
                                                  │
Mac ── npm run deploy:front ──► Pages + functions/data/[[path]].js ──► /data/* ──► celular
```

### Hecho (2026-10-16)

- [x] KV **`panel-ventas-fv-datos`** creado en la cuenta (id en `wrangler.json`, no es secreto).
- [x] **`wrangler.json`**: configuración del proyecto de Pages con el binding `DATOS` al KV. Con este archivo, cada `wrangler pages deploy` sube también `functions/` y el binding (el binding queda definido por el archivo, no por el panel).
- [x] **`functions/data/[[path]].js`**: sirve `meta.json` y `snapshot.json.gz` desde el KV, en las mismas URLs de antes. **El front no cambió.** Cualquier otra ruta de `/data/` da 404; sin datos, 404 "Todavía no hay datos publicados". Las cabeceras van en la función (`_headers` no se aplica a las Functions). Sigue detrás de Access porque está en el mismo dominio.
- [x] **`scripts/publish.mjs`** (PC del POS): chequeo de Access → foto en `snapshot/` → `wrangler kv key put` de `snapshot.json.gz` y **después** `meta.json` (el front mira `meta.json`; así nunca ve uno que apunte a una foto que todavía no subió). Ya no arma ni publica el front; `--build` se ignora con un aviso. El Programador de tareas no cambia.
- [x] **`scripts/deploy-front.mjs`** (`npm run deploy:front [-- --preview]`): chequeo de Access → `vite build` → borra `dist/data` → `wrangler pages deploy` → comprueba que la URL del deploy esté protegida. `--preview` publica en `preview.panel-ventas-fv.pages.dev` sin tocar producción.
- [x] Lo común de los dos scripts en `scripts/lib/cloudflare.mjs`.
- [x] **La foto se sube en partes de 256 KB** (2026-10-16). En la PC del POS, `wrangler kv key put` de la foto entera (4,3 MB) fallaba con `fetch failed`, y una clave chica andaba: algo en esa red corta las subidas grandes. (El deploy de Pages andaba porque sube archivos chicos.)
  - `publish.mjs` sube las partes a `partes/<generatedAt>/0..n` (vencen solas a los 30 días) y al final `meta.json` con `partes: { prefijo, cantidad }`. La función las une y comprueba el tamaño contra `meta.bytes`; si falta una parte responde 503 y el celular sigue con su copia guardada. Cada publicación usa un prefijo nuevo, así que un `meta.json` viejo (el KV tarda ~1 min en propagarse) apunta a partes que siguen existiendo.
  - Con `CLOUDFLARE_API_TOKEN` sube directo a la API de Cloudflare, con 3 reintentos por parte y la causa exacta del error en `publish.log` (17 partes en ~18 s). Sin token (la Mac), con wrangler (~50 s). `KV_PARTE_KB` en el `.env` cambia el tamaño de las partes.
  - Verificado: la función con un KV simulado (en partes, formato viejo de una sola clave, parte faltante → 503, vacío → 404); subida real por la API y por wrangler, y las partes bajadas del KV y unidas dan la foto idéntica (mismo SHA-1). Preview actualizado con la función nueva.
- [x] Verificado:
  - Subida al KV de la copia del 15/10 desde la Mac y bajada: el `.gz` vuelve idéntico (mismo SHA-1).
  - Función en local (`wrangler pages dev` con KV local): `meta.json` 200 como JSON, la foto idéntica, otra ruta 404.
  - Deploy en **preview** con la función: la API de Cloudflare muestra el binding `DATOS` en preview. Producción todavía no lo tiene (lo toma con su primer `deploy:front`).

### Pase a producción (en este orden)

Hasta el paso 3, producción sigue con el último deploy de la PC del POS (front + datos en el paquete), sin cortes.

- [x] 🧑 **0. Probar preview en el celular**: abrir `https://preview.panel-ventas-fv.pages.dev` (pide el código de Access de nuevo, es otro subdominio). Tiene que mostrar los reportes con "Datos al 15/10 20:34" (la foto de prueba que subió la Mac al KV).
- [x] 🧑 **1. Token de la PC del POS**: dash.cloudflare.com → My Profile → API Tokens → el token de la PC del POS → *Edit* → agregar **Account → Workers KV Storage → Edit** → guardar. El valor del token no cambia, el `.env` queda igual. (Si Cloudflare obliga a crear uno nuevo, reemplazarlo en el `.env`.)
- [x] 🧑 **2. PC del POS**: `git pull` y después `scripts\publish-task.cmd`. En `logs\publish.log` tiene que terminar con `✓ Datos publicados`. Esto pisa en el KV la foto de prueba con la del día.
  - Si falla con `HTTP 403` o un error de autenticación, falta el permiso del paso 1.
  - El primer intento (2026-10-16) falló con `fetch failed` al subir la foto entera: arreglado subiéndola en partes (ver arriba). Hay que volver a hacer `git pull`.
- [x] **3. Front a producción**: `npm run deploy:front`. Hecho el 2026-10-16: primero a las 20:46 desde otra sesión (con la función de una sola clave) y a las 21:00 con la función de partes (`b1937ed`). Producción ya lee del KV; hasta que la PC del POS publique con el código nuevo, muestra la foto de prueba del 15/10.
- [x] 🧑 **4. Comprobar en el celular** (2026-10-16, todo bien): ↻ Actualizar en `https://panel-ventas-fv.pages.dev` → "Datos al …" con la hora de la publicación del paso 2, y "Este mes" con "1 oct – 16 oct".
- [ ] 🧑 **5. Esperar una publicación programada** (10, 14, 19 o 22 h) y confirmar que "Datos al …" se actualiza solo.

### Notas

- Workers KV, plan gratis: hasta 25 MiB por valor (la foto pesa ~4,3 MB), 1.000 escrituras y 100.000 lecturas por día (usamos ~8 escrituras). Una foto nueva puede tardar hasta ~1 minuto en verse en todos lados.
- Se descartó R2 porque activarlo puede pedir una tarjeta aunque no se cobre.
- Fase 10: con varios clientes, cada instalación necesita su propio proyecto de Pages y su KV. `wrangler.json` tiene el de este cliente; habrá que sacarlo a la configuración de la instalación.

## Reportes nuevos (Fases 12 a 18): qué datos hay, sin compras ni stock

Propuestos el 2026-10-16. El negocio **no carga compras ni maneja stock**, así que todo sale de las ventas. Antes de diseñarlos se revisó la base real (copia del 15/10, 148.893 órdenes):

| Dato | Qué hay | Sirve para |
|---|---|---|
| Precio cobrado en cada línea, con fecha | `PRICE` × `QTY` de `FVPOS_ORDER_LINE` (en el snapshot: `subtotal / qty`) | Fase 12 |
| Costo en las líneas (`COST_PRICE`) | Igual al precio en el 93% de las líneas: **no hay costos reales**. `FVPOS_PRODUCT` tiene costo y precio en 0. | Nada: no se pueden calcular márgenes |
| Ventas por artículo y día | Sí, completo | Fases 13, 15 y 16 |
| Hora de cada venta | Sí | Fases 14 y 17 |
| Estado de las órdenes | 148.891 `COMPLETED` y **2 `CANCELLED`** en 6 años (las dos con totales absurdos) | Fase 18: no alcanza |
| Operaciones de caja | 18 aperturas, 14 cierres y 14 retiros en 6 años: la caja se cierra cada varios meses | Fase 18: no alcanza |
| Clientes, descuentos, ofertas, notas de crédito | 1 cliente (consumidor final), 0 descuentos, 0 líneas en oferta, 0 notas de crédito, 0 cantidades negativas | Nada por ahora |

Ubicación en el front:
- **Sección nueva "Góndola"** (no usa el período): precios sin actualizar e inflación propia (Fase 12) y faltantes probables (Fase 13).
- **Ventas**: comparación con otros períodos (Fase 17).
- **Productos**: Pareto ABC (Fase 16) y artículos que se compran juntos (Fase 15).
- **Histórico**: mapa de calor día × hora (Fase 14).

Reglas comunes:
- Cálculos puros en `src/lib/` (sin React), como `metrics.js`. **No cambia el snapshot ni el parser**: todo sale de `orders` y `orderLines`.
- Se excluye el producto 25912 "Fiambrería Ticket" (PRICE = 1, la cantidad es el importe) y las órdenes de más de $10M (`MAX_ORDEN_RAZONABLE`). Cuando se haga la Fase 10, pasan a leer el campo genérico de los ajustes del cliente.

## Fase 12: precios sin actualizar e inflación propia ✅ (2026-10-16)

Objetivo: avisar qué artículos se siguen cobrando a un precio viejo mientras la inflación sube. Sin compras cargadas, es la forma de **perder margen sin darse cuenta**.

- [x] `src/lib/gondola.js` → `computePrecios(db, hoy)`:
  - **Precio actual** de cada artículo: el de su última venta (`subtotal / qty`, redondeado a centavos).
  - **Desde cuándo**: la primera venta de la racha final con ese precio (tolerancia ±1%, para el redondeo de los artículos por peso).
  - **Inflación desde entonces**: IPC acumulado de alimentos desde el mes siguiente al cambio hasta el último dato del INDEC. "Precio con inflación" = precio × ese factor.
  - ~~Solo los 150 artículos que más facturaron en los últimos 90 días, vendidos en los últimos 30.~~ Cambiado el 2026-10-16, a pedido del usuario: los artículos **cambian de código de barras** cuando el fabricante saca una etiqueta nueva, y el viejo deja de venderse con el precio sin actualizar. Además, el tope de 150 dejaba afuera a los de baja rotación.
  - **Grupos por rotación** (todos los artículos vendidos en las últimas 13 semanas):
    - **Alta rotación**: se vendió en 8 o más de las 13 semanas y se sigue vendiendo. Orden: más inflación acumulada primero.
    - **Baja rotación**: menos semanas y se sigue vendiendo. Orden: lo que facturaron. Por inflación ganaban los vendidos una sola vez con un precio de 2023.
    - **Sin ventas**: no sale hace más de 14 días y más de 3 veces su intervalo promedio entre ventas, o hace más de 45 días. Falta, cambió de código o no viene más: su precio viejo ya no se cobra. Orden: lo que facturaban.
  - En alta y baja entran los que tienen **45 días o más sin cambio de precio**.
  - **Detectar el reemplazo por el nombre** (un artículo nuevo con nombre parecido que empezó a venderse cerca de la última venta del viejo): probado con los 16 de alta rotación que dejaron de salir, **ninguno tenía un reemplazo así**. En esta base se ven faltantes y cambios de marca (Azúcar Marolio → Azumen / Ledesma), no códigos nuevos con el mismo nombre. No se implementó.
- [x] **Inflación de la góndola**: canasta de los 100 artículos que más facturaron en los últimos 12 meses. Por mes se toma la mediana del precio de cada artículo, se compara con el mes base (hace 12 meses) y se pondera por lo que facturó cada uno. Se compara con el IPC de alimentos acumulado en los mismos meses. Gráfico: dos líneas, una sola escala (% acumulado desde el mes base).
- [x] Front: sección **Góndola** (`src/pages/GondolaPage.jsx`), con su ícono y su lugar en la navegación.
- [x] (2026-10-16, a pedido del usuario) **Botón de copiar** pegado al final de cada nombre de artículo (al costado de la fila no se entendía qué copiaba) en los reportes de Góndola (`src/components/CopyButton.jsx`), para buscarlo en el POS y corregir la base sin tipearlo. Usa `navigator.clipboard` y, en http de la red local, `execCommand`. En precios, "Se vendió X de 13 semanas · $" se reemplazó por **la fecha de la última venta** ("hoy", "ayer" o "mié 14 oct · hace 2 días").
- [x] Verificación con la copia del 15/10 (ver "Verificación de las Fases 12 a 17").

## Fase 13: faltantes probables ✅ (2026-10-16)

Objetivo: sin stock, detectar por las ventas los artículos que **probablemente se terminaron** (o se sacaron de la góndola), para armar el pedido.

- [x] `computeFaltantes(db, hoy)` en `src/lib/gondola.js`:
  - **Días abiertos**: los días con al menos una venta en el negocio.
  - **Frecuencia** de cada artículo: en qué parte de los días abiertos de las 8 semanas anteriores (sin la última) se vendió. Entran los que se vendieron en al menos la mitad.
  - **Días sin venta**: días abiertos completos desde su última venta (el día de hoy no cuenta, porque está en curso).
  - **Aviso** si la probabilidad de no vender esos días por azar, `(1 − frecuencia) ^ días`, es menor al 2% y pasaron 2 días o más. Por ejemplo, un artículo que se vende 9 de cada 10 días salta a los 2 días; uno que se vende la mitad de los días, a los 6.
  - Orden: lo que se deja de facturar por día primero.
- [x] Front: en Góndola, "Probablemente faltan", con "Se vendía 9 de cada 10 días · última venta: mié 30/9 · $2k por día" y "hace N días".

## Fase 14: mapa de calor día × hora ✅ (2026-10-16)

Objetivo: ver cuándo hay más clientes, para decidir cuántas cajas abrir y cuándo reponer.

- [x] `computeMapaCalor(db, hasta)` en `src/lib/metrics.js`: **compras promedio por hora**, para cada día de la semana, en las 8 semanas completas hasta el último día con datos. Se divide por la cantidad de ese día de la semana con ventas (un feriado cerrado no baja el promedio). El tooltip suma lo vendido promedio.
- [x] Horas que se muestran: las que tienen al menos una compra por semana, en el bloque continuo con más compras (un corte de hasta 3 horas, como la siesta, queda adentro). Las ventas sueltas de madrugada quedan afuera.
- [x] Front: en Histórico, "Cuándo viene la gente": tabla de celdas (lunes a domingo × horas) con un solo color, de claro a oscuro (dataviz: secuencial). Cada celda tiene su número en el tooltip y en `aria-label`.

## Fase 15: artículos que se compran juntos ✅ (2026-10-16)

Objetivo: ideas para combos y para ubicar productos cerca en la góndola.

- [x] `computeJuntos(db, filtered)` en `src/lib/productos.js`: pares de artículos en la misma compra. Para cada par: compras en las que aparecen juntos y **cuántas veces más de lo esperado al azar** (lift = P(A y B) / (P(A) × P(B))).
  - Entran los pares con 1,5 veces o más y al menos 5 compras juntos (o el 0,2% de las compras, lo que sea mayor). Se muestran los 10 con más compras juntos.
  - Hacen falta al menos 200 compras en el período. Si hay menos, se pide elegir un período más largo.
  - Las compras de más de 40 artículos distintos no cuentan, para que el cálculo no se dispare.
- [x] Front: en Productos, "Se compran juntos".

## Fase 16: Pareto de artículos (ABC) ✅ (2026-10-16)

Objetivo: saber qué artículos hacen la mayor parte de la venta, los que nunca pueden faltar.

- [x] `computePareto(db, filtered)` en `src/lib/productos.js`: artículos ordenados por lo que facturaron. **A**: hasta el 80% de la venta, **B**: del 80% al 95%, **C**: el resto.
- [x] Front: en Productos, "Los que hacen la venta". Muestra cuántos artículos son A y qué parte del total de artículos vendidos representan, con barras de "parte de los artículos" contra "parte de la venta" y la lista de los A.

## Fase 17: comparación con otros períodos ✅ (2026-10-16)

Objetivo: saber si un día o una semana fue buena, comparada con algo justo.

- [x] `computeComparacion(db, period, hasta)` en `src/lib/metrics.js`:
  - **Semanas antes**: el mismo rango corrido una semana, o las semanas que hagan falta para que no se pise con el elegido. Coinciden los días de la semana (un lunes contra un lunes).
  - **Hace un año**: el mismo rango 364 días antes (52 semanas, mismo día de la semana), **ajustado por el IPC** de los 12 meses.
  - Si el período termina en el día de los datos y ese día está en curso, a ese día en la comparación se lo corta a la hora de la última venta. Así "hoy hasta las 11" se compara con "el jueves pasado hasta las 11".
  - Se respeta la franja horaria elegida.
- [x] Front: en Ventas, debajo de la venta total, "Comparado con": las dos filas con su rango de fechas, el importe y la variación.

## Fase 18: control de caja y anulaciones por cajero ⛔ (descartada con los datos actuales, 2026-10-16)

Era la idea de prevención de pérdidas: arqueo por turno (caja inicial + efectivo − retiros) y anulaciones por cajero. **Con cómo se usa hoy el POS no hay datos para hacerlo**:
- **Caja**: en 6 años hubo 18 aperturas y 14 cierres. Las del 2026 son el 03/06 (retiro de $638M, lo acumulado desde octubre de 2024), el 07/06 y el 08/06. Un arqueo por turno necesita una apertura y un cierre por día o por turno.
- **Anulaciones**: hay solo 2 órdenes `CANCELLED`, ambas de 2025 y con totales absurdos. Las ventas que se cancelan antes de cobrar no quedan registradas, o el POS las borra.

Qué tendría que cambiar para retomarla:
- [ ] 🧑 Que los cajeros **abran y cierren la caja todos los días** (o en cada turno) en el POS, cargando la caja inicial y el retiro del cierre.
- [ ] Confirmar cómo deja el POS en el `.log` una venta anulada después de cobrada (ver "Pendientes de datos": anular una venta de prueba).
- [ ] Con 2 o 3 semanas de cierres diarios, rehacer el diseño: por cierre, efectivo esperado (caja inicial + ventas en efectivo + cobros − retiros) contra lo retirado. Resolver antes las 818 ventas con pagos mixtos donde la caja no coincide con el total.

## Fase 19: consultor de precios 🟡 (front en producción el 2026-10-16; falta publicar los datos desde la PC del POS)

Se consulta el precio de un artículo desde el celular: escaneando el código de barras o escribiendo parte del nombre.

- [x] **Datos**: `FVPOS_PRODUCT.SELLING_PRICE` está siempre en 0. El precio de venta está en **`FVPOS_PRODUCT_PRICE`**, con una fila por artículo y lista (`PRICE_LIST_ID` 1 = Minorista, 2 = Mayorista). `PREVIOUS_SELLING_PRICE` viene siempre en 0. No hay ofertas cargadas (`IN_OFFER`) y todos los artículos activos se venden por unidad.
- [x] **Parser**: lee también `FVPOS_PRODUCT_PRICE`, así que el `.log` actualiza los precios del día. Arma la tabla nueva **`catalog`** con `{ productId, barcode, categoryId, price, priceDate }`, solo con los artículos no dados de baja (`IS_DISCONTINUED`): 9.537 artículos, 9.446 con precio. `products` sigue teniendo todos. El snapshot es genérico, así que no cambió de versión. La foto crece unos 100 KB en gzip.
- [x] **`src/lib/precios.js`**: índice y búsqueda. Por código exacto o por parte del código (4 o más dígitos), y por palabras del nombre en cualquier orden, sin importar tildes ni mayúsculas. Agrega el último precio cobrado (de las ventas) y marca **"Se cobró distinto"** cuando la última venta es posterior al último cambio de precio y no coincide (±1%).
- [x] **Página Precios** (sin período): buscador, ficha del artículo como etiqueta de góndola (precio, desde cuándo, código, categoría, última venta) y lista de resultados. En la compu el cursor arranca en el buscador, así que un lector de códigos USB escribe ahí directo. Con una foto vieja (sin `catalog`) muestra "Falta el catálogo de precios".
- [x] **Escáner** (`src/components/Escaner.jsx`): cámara trasera a pantalla completa. Usa el `BarcodeDetector` del navegador (Chrome en Android) y, si no está, **`barcode-detector`** (zxing en WebAssembly) para iPhone y escritorio. El `.wasm` (~1 MB) va con el front y se baja recién al abrir la cámara. La cámara solo anda con https: en la red local (http) muestra un aviso.
- [x] Verificado: test del parser (`scripts/test-parse-log.mjs`, con precios en el `.script` y el `.log`, la lista Mayorista y los dados de baja), lint, build, y en Chrome sin pantalla con la foto real (celular claro y oscuro, escritorio, código exacto, no encontrado, foto vieja). El escáner abre con una cámara simulada usando zxing (el wasm se sirve como `application/wasm`).
- [ ] **Publicar los datos con el parser nuevo**: en la PC del POS, `git pull` y `npm ci` (hay una dependencia nueva). La próxima publicación programada ya trae el catálogo.
- [ ] Probar el escaneo en iPhone y en Android con productos reales.
- Pendiente para más adelante: los códigos de balanza (empiezan con 2 y traen el peso o el importe) no se buscan. Hoy hay un solo artículo por kilo.

## Verificación de las Fases 12 a 17

Hecha el 2026-10-16 con la copia del 15/10 a las 20:34 (`.script` + `.log`). Con la foto completa, cada cálculo tarda menos de 250 ms en Node.

- [x] **Precios (12)**, con los grupos por rotación: **212 de alta rotación** con precio viejo (104 se actualizaron en los últimos 45 días), 723 de baja rotación y 515 sin ventas (arriba: Aceite Cocinero 900 ml, Kinder Sorpresa, Pepsi 2,25 retornable). En alta rotación, arriba de todo: Arroz Tío Carlos 1 kg y Arroz Luchetti 500 g, con el mismo precio desde febrero de 2024 (+138%). Con la versión anterior (top 150): Arvejas Molto, $700 desde el 19/04/2024 (+103% de inflación desde entonces); Manteca SyS x100, $1.600 desde el 08/07/2024 (+82%); Tostadas de arroz Leiva, $1.400 desde el 25/10/2024 (+70%).
- [x] **Inflación propia (12)**: septiembre de 2025 a septiembre de 2026, con 100 artículos: **tus precios +28,2%, IPC de alimentos +35,2%**.
- [x] **Faltantes (13)**: con fecha 15/10 aparecen Papel Higienol x4 (se vendía la mitad de los días, sin ventas desde el 30/09) y Azúcar Marolio 1 kg (desde el 01/10). Con fecha 16/10 se suma Azúcar Azumen 1 kg.
- [x] **Mapa de calor (14)**: del 21/08 al 15/10, de 9 a 22 h. Pico: domingo de 12 a 13 h (23 compras promedio). Se ve el corte de la siesta (15 a 17 h) y que el domingo a la tarde está cerrado.
- [x] **Comparación (17)**: el 15/10 hasta las 20:34 da −30,6% contra el 08/10 a la misma hora y +2,2% contra el 16/10/2025 ajustado. Del 1 al 15/10 da +19,1% contra el 10 al 24/09 y −12,8% contra el año anterior ajustado (factor 1,322, con el IPC hasta septiembre).
- [x] **Pareto (16)**: del 1 al 15/10, 387 de 941 artículos (41%) hacen el 80% de la venta.
- [x] **Juntos (15)**: el 15/10 (63 compras) pide un período más largo. En lo que va de 2026: Talca x3L + Ternuva tinto, 119 compras juntos (8,8 veces más que por casualidad).
- [x] `npm run lint` sin errores y `vite build` bien. Capturas a 500 px de ancho (modo oscuro) de Ventas, Productos, Góndola e Histórico con el server local: sin cortes ni superposiciones. La navegación de abajo pasa a 5 pestañas.
- [x] Publicar el front: probado en preview y publicado en producción el 2026-10-16 con `npm run deploy:front`. Los datos no cambian: no hace falta tocar la PC del POS.
- [ ] 🧑 Probar en iPhone y Android: el mapa de calor con el dedo y las 5 pestañas en un Android de 360 px.

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
  - Arreglo: agregar `-ssw -x!fvposdb.lck` al comando de 7-Zip (`-ssw` comprime también los archivos abiertos para escritura; el `.lck` no hace falta y restaurado puede hacer creer que la base está en uso), o copiar primero `data\` a una carpeta temporal y comprimir la copia (lo que se hizo a mano el 15/10).
  - No programar el backup cerca de las 09:10 (checkpoint de la apertura): podría tomar el `.script` y el `.log` de momentos distintos.
  - Comprobar después con `7z l <archivo>.7z` que contenga `fvposdb.log` con tamaño > 0.
- [x] **Front: "Este mes" toma el mes entero, no hasta hoy.** Arreglado el 2026-10-16: va del 1 a hoy (el 16/10 dice "1 oct – 16 oct · 16 días"). El día 1 coincide con "Hoy" y se marca ese chip. Hoy, 16/10, el atajo filtra del 1 al 31 de octubre y dice "31 días", aunque solo hay datos hasta el 16. Confunde (los promedios por día y el texto del período se leen como mes completo). Debe ir **del 1 al día de hoy** y decir "16 días".
  - Dónde: `src/lib/period.js:12`, `dateTo` del preset `mes` → `today` en vez del último día del mes.
  - Revisar que el chip "Este mes" siga quedando marcado (se compara por `dateFrom`/`dateTo`) y que no haya otros atajos con el mismo problema.
  - Reportado el 2026-10-16.
- [x] Lint: `ventas-dashboard.jsx` tenía 11 errores de antes de este plan (variables sin usar, "Cannot create components during render"). No se tocaron. El de "setState dentro de un effect" desapareció al reescribir la carga en la Fase 4.

## Cómo verificar cambios en el parser o el snapshot

```bash
npm run snapshot        # debe terminar con "✓ Snapshot generado" y mostrar las cantidades
node scripts/test-parse-log.mjs   # casos del .log armados a mano
node scripts/test-ipc.mjs         # IPC del INDEC (con la ruta a un CSV real, compara con src/lib/ipc.js)
npm run build
npx eslint src/lib scripts
```

Prueba de ida y vuelta (no está en el repo; se puede recrear como `scripts/verify-snapshot.mjs`):
1. Correr `parseHSQLScript` sobre la base.
2. Leer `snapshot/snapshot.json.gz` y pasarlo por `decodeSnapshot`.
3. Comparar cada campo de cada fila: fechas por `getTime()` y números con tolerancia de 1e-4.
4. Debe dar 0 diferencias. Repetir con `TZ=America/New_York`.
