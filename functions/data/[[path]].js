// Pages Function: sirve /data/* desde Workers KV (binding DATOS, ver wrangler.json).
//
// Los datos y el front se publican por separado:
//   - la PC del POS sube meta.json y snapshot.json.gz al KV (scripts/publish.mjs), sin deploy de Pages;
//   - el front se publica cuando cambia (scripts/deploy-front.mjs) y siempre lee los datos actuales.
// Las URLs son las mismas que cuando los datos iban dentro del deploy: el front no cambia.
// Está en el mismo dominio, así que Cloudflare Access la protege igual que al resto del sitio.

// Solo estas claves; cualquier otra ruta de /data/ da 404.
const TIPOS = {
  "meta.json": "application/json; charset=utf-8",
  // Sin Content-Encoding: el front mira los primeros bytes (1f 8b) y lo descomprime él.
  "snapshot.json.gz": "application/octet-stream",
};

export async function onRequestGet({ params, env }) {
  const key = (params.path || []).join("/");
  const type = TIPOS[key];
  if (!type) return new Response("No encontrado", { status: 404 });
  if (!env.DATOS) return new Response("Falta el binding DATOS (ver wrangler.json)", { status: 500 });

  const value = await env.DATOS.get(key, "arrayBuffer");
  if (value === null) return new Response("Todavía no hay datos publicados", { status: 404 });

  // _headers no se aplica a las respuestas de una Function: las cabeceras van acá.
  return new Response(value, {
    headers: { "Content-Type": type, "Cache-Control": "no-cache", "X-Robots-Tag": "noindex" },
  });
}
