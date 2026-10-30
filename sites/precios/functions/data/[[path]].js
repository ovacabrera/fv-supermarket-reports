// Pages Function del consultor de precios público: sirve /data/precios.json desde su propio KV
// (binding PRECIOS, ver wrangler.json de esta carpeta). Este sitio NO tiene Access y NO tiene acceso
// al KV de la foto de ventas: solo a la lista de precios que sube scripts/publish.mjs.

const HEADERS = { "X-Robots-Tag": "noindex" };
const text = (msg, status) => new Response(msg, { status, headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestGet({ params, env }) {
  const key = (params.path || []).join("/");
  if (key !== "precios.json") return text("No encontrado", 404);
  if (!env.PRECIOS) return text("Falta el binding PRECIOS (ver wrangler.json)", 500);

  // cacheTtl: el borde de Cloudflare guarda la lectura unos minutos (la lista cambia 4 veces por día).
  const gz = await env.PRECIOS.get("precios.json.gz", { type: "arrayBuffer", cacheTtl: 300 });
  if (gz === null) return text("Todavía no hay precios publicados", 404);
  // Se guarda comprimida: va tal cual con Content-Encoding y el navegador la descomprime solo.
  return new Response(gz, {
    encodeBody: "manual",
    headers: {
      ...HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Encoding": "gzip",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}
