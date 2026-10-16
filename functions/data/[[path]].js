// Pages Function: sirve /data/* desde Workers KV (binding DATOS, ver wrangler.json).
//
// Los datos y el front se publican por separado:
//   - la PC del POS sube meta.json y la foto al KV (scripts/publish.mjs), sin deploy de Pages;
//   - el front se publica cuando cambia (scripts/deploy-front.mjs) y siempre lee los datos actuales.
// Las URLs son las mismas que cuando los datos iban dentro del deploy: el front no cambia.
// Está en el mismo dominio, así que Cloudflare Access la protege igual que al resto del sitio.
//
// La foto se sube en partes (la red de la PC del POS corta las subidas grandes): meta.json trae
// `partes: { prefijo, cantidad }` y acá se vuelven a unir. Cada publicación usa un prefijo nuevo y
// las partes vencen solas, así que un meta.json viejo (el KV tarda hasta ~1 min en propagarse)
// siempre apunta a partes que existen.

const HEADERS = { "Cache-Control": "no-cache", "X-Robots-Tag": "noindex" };
const respond = (body, type, status = 200) =>
  new Response(body, { status, headers: { ...HEADERS, "Content-Type": type } });
const text = (msg, status) => respond(msg, "text/plain; charset=utf-8", status);

async function snapshot(kv) {
  const meta = await kv.get("meta.json", "json");
  // Sin partes: la foto entera en una sola clave (como se subía al principio).
  if (!meta?.partes) return kv.get("snapshot.json.gz", "arrayBuffer");

  const { prefijo, cantidad } = meta.partes;
  const partes = await Promise.all(Array.from({ length: cantidad }, (_, i) => kv.get(prefijo + i, "arrayBuffer")));
  if (partes.some(p => p === null)) throw new Error("faltan partes de la foto");
  const out = new Uint8Array(partes.reduce((n, p) => n + p.byteLength, 0));
  let pos = 0;
  for (const p of partes) { out.set(new Uint8Array(p), pos); pos += p.byteLength; }
  if (meta.bytes && out.byteLength !== meta.bytes) throw new Error(`la foto mide ${out.byteLength} bytes y debería medir ${meta.bytes}`);
  return out;
}

export async function onRequestGet({ params, env }) {
  const key = (params.path || []).join("/");
  if (!env.DATOS) return text("Falta el binding DATOS (ver wrangler.json)", 500);

  if (key === "meta.json") {
    const meta = await env.DATOS.get("meta.json", "arrayBuffer");
    return meta === null ? text("Todavía no hay datos publicados", 404) : respond(meta, "application/json; charset=utf-8");
  }
  if (key === "snapshot.json.gz") {
    try {
      const gz = await snapshot(env.DATOS);
      // Sin Content-Encoding: el front mira los primeros bytes (1f 8b) y lo descomprime él.
      return gz === null ? text("Todavía no hay datos publicados", 404) : respond(gz, "application/octet-stream");
    } catch (e) {
      return text(`Foto incompleta (${e.message}). Probá de nuevo en un rato.`, 503);
    }
  }
  return text("No encontrado", 404);
}
