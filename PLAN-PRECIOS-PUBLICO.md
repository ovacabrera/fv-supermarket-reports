# Plan: consultor de precios público

> Documento de traspaso para seguir el trabajo en otra sesión de chat.
> Marcado: `[x]` hecho · `[ ]` pendiente · 🧑 lo hace el usuario (cuenta de Cloudflare o PC del POS).
> Última actualización: 2026-10-30.

## Objetivo

Que los clientes escaneen un artículo en el súper con su celular y vean el precio, en una URL abierta
(sin login), separada del panel de reportes.

## Decisiones

- **Datos aislados (opción A, 2026-10-30).** El sitio público baja solo `precios.json`: código, nombre,
  precio y rubro de los artículos activos con precio. Nunca la foto de ventas. Se eligió un archivo
  entero (≈180 KB gzip, ~9.400 artículos) en vez de una API por consulta: anda con mala señal y reutiliza
  la búsqueda actual. Los precios ya están a la vista en la góndola.
- **Sin** fecha del último cambio de precio, última venta ni "se cobró distinto": eso queda en el panel.
- **Otro proyecto de Pages y otro KV.** Access protege todo `panel-ventas-fv.pages.dev`, así que el sitio
  público es un proyecto aparte con su propio espacio de KV (`PRECIOS`). Su función no tiene acceso a
  la foto privada aunque haya un error de código.

## Fases

### Fase 1 — Datos aislados

- [x] `src/lib/preciosPublicos.js`: arma la lista con los campos elegidos uno por uno (un campo nuevo
  del parser no se filtra solo) y la valida (campos permitidos, tamaño máximo).
- [x] Día de la última venta (`venta`, sin el precio cobrado), agregado el 2026-10-30 a pedido del usuario:
  no es sensible y sirve para filtrar la búsqueda por nombre (≈205 KB gzip).
- [x] `export-snapshot.mjs` escribe `snapshot/precios.json.gz`.
- [x] `publish.mjs` la valida y la sube al KV `PRECIOS`, después de la foto privada. Si no existe
  `sites/precios/wrangler.json`, avisa y no la sube.

### Fase 2 — Sitio público ✅ (2026-10-30)

- [x] KV `PRECIOS` (`2ef94086643547f8bf7dcd74b213b937`) y proyecto de Pages `precios-fv`, sin Access, creados con wrangler.
- [x] `sites/precios/wrangler.json` (solo el binding `PRECIOS`) y `sites/precios/functions/data/[[path]].js`,
  que sirve **solo** `/data/precios.json` (gzip, caché de borde de 5 min). Cualquier otra ruta de `/data/` da 404.

### Fase 3 — Front para clientes ✅ (2026-10-30)

- [x] `sites/precios/src/` (entrada propia de Vite, `vite.precios.config.js`): reutiliza `Escaner.jsx`, `buscar()`
  y la etiqueta de góndola. No importa nada de ventas (65 KB gzip sin el lector de códigos).
- [x] Escanear como acción principal, precio grande; buscar por nombre como opción. Sin rubro si es "Sin Clasificar".
- [x] Etiquetas de balanza (EAN-13 que empieza con 2): "El precio está impreso en la misma etiqueta".
- [x] UPC-A: busca el código con y sin el 0 de adelante.
- [x] Por nombre solo aparecen los artículos vendidos en los últimos 6 meses (2.598 de 9.488 al 29-10): los que no
  rotan pueden tener el precio viejo. Por código se busca en todos.
- [x] Al elegir un resultado se esconde la lista y aparece "Volver a los N resultados".
- [x] `npm run dev:precios`: lo levanta en local con `snapshot/precios.json.gz`.
- [ ] 🧑 Nombre y logo del súper (hoy dice "Consultor de precios").

### Fase 4 — Deploy con barandas ✅ (2026-10-30)

- [x] `npm run deploy:precios` (`scripts/deploy-precios.mjs`): build solo de ese sitio y deploy a `precios-fv` desde `sites/precios`.
- [x] Después del deploy: `/data/snapshot.json.gz` y `/data/meta.json` tienen que dar 404 en el sitio público
  (y en la URL del deploy), y el panel tiene que seguir con Access. Si no, falla.
- [x] Primera publicación el 2026-10-30 en https://precios-fv.pages.dev/ con la lista armada desde la foto de
  producción del 29-10 a las 19 h (9.488 artículos, 173 KB), subida a mano desde la Mac.

### Fase 5 — En producción y en el local

- [x] Commit `61e34c7`, push y `git pull` en la PC del POS (2026-10-30).
- [x] Primera publicación desde la PC del POS el 2026-10-30 a las 11:22: la lista pública se actualizó sola
  (9.489 artículos). El KV tardó ~3 minutos en mostrarla.
- [ ] 🧑 Probar en iPhone y Android con la wifi y los datos móviles del súper (escaneo real con la cámara).
- [x] Cartel A4 con QR a https://precios-fv.pages.dev/: `docs/cartel-precios.pdf` (2026-10-30). El QR se verificó
  con zxing. Si se cambia la URL (dominio propio), hay que rehacerlo.
- [ ] 🧑 Imprimirlo y pegarlo (probar el QR desde 1–2 m con un celular antes de pegar todos).

### Fase 6 — Imágenes (experimento, sin prioridad)

- [x] Medición (2026-10-30) con los 500 artículos más vendidos en 6 meses (63% de las líneas de venta), en Open Food
  Facts y, si no estaba, Open Beauty Facts y Open Products Facts:
  - **64% tiene foto** (318 de 500), parejo en todo el ranking; ponderado por ventas, 63%. Casi todas de Open Food Facts.
  - Por rubro: bebidas sin alcohol 23/25, galletitas y golosinas 20/21, lácteos 6/6, almacén 42/67;
    limpieza 1/13 y cigarrillos 2/22 casi no tienen.
  - Calidad: en una muestra de 20, todas eran del producto correcto, pero son fotos sacadas con celular
    (manos, mesas, góndola) y alguna es del dorso del paquete. Sirven para reconocer el producto, no para un catálogo.
  - El servidor corta con HTTP 429 si se consulta rápido (~100 consultas por minuto): no sirve resolver los 9.400
    artículos en cada publicación.
- [x] En producción el 2026-10-30: el celular del cliente pide la foto a Open Food Facts recién al mostrar la ficha
  (una consulta por artículo, guardada mientras la página está abierta), la muestra debajo del buscador (donde va la lista de resultados) en un
  recuadro blanco y cita "Foto: Open Food Facts" con enlace al producto (CC-BY-SA). Sin foto, o si falla o tarda
  más de 6 s, la ficha queda igual que antes.
- Ojo: el celular del cliente se conecta a Open Food Facts, que ve qué código se consultó.
- Descartado: fotos de sitios de otros supermercados (términos de uso) y Google Images (pago, derechos).
