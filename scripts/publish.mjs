// Publica la última foto de la base en Workers KV. Lo corre la PC del POS (Programador de tareas).
// El front NO se publica acá: se publica aparte con scripts/deploy-front.mjs y lee los datos del KV
// por /data/* (functions/data/[[path]].js). Así una versión nueva del front nunca pisa los datos.
//
//   node scripts/publish.mjs [--db <ruta .script>] [--dry-run]
//
//   --db       ruta a la base (por defecto la misma que export-snapshot, o FV_DB_PATH).
//   --dry-run  genera la foto pero no la sube.
//
// Variables (en .env, ver .env.example): CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID. El token
// necesita "Workers KV Storage: Edit". Sin token se usa la sesión de `wrangler login` (más lento).
// El KV sale de wrangler.json. KV_PARTE_KB cambia el tamaño de las partes (256 por defecto).
//
// Seguridad: antes de subir datos verifica que <proyecto>.pages.dev responda con el login de
// Cloudflare Access. Si la URL está abierta (o no se puede comprobar), NO publica.
//
// Deja log en logs/publish.log y sale con código distinto de 0 si algo falla.

import fs from "fs";
import path from "path";
import { ROOT, arg, has, log, fail, run, loadEnv, config, requireAccess } from "./lib/cloudflare.mjs";

const OUT = path.join(ROOT, "snapshot");
const dryRun = has("dry-run");
// La red de la PC del POS corta las subidas grandes (4,3 MB de una vez falla; los pedidos chicos andan):
// la foto se sube en partes, que la función de /data/ vuelve a unir.
const PARTE = (Number(process.env.KV_PARTE_KB) || 256) * 1024;
// Las partes vencen solas: cada publicación usa un prefijo nuevo y no hace falta borrar las viejas.
const TTL_PARTES = 30 * 24 * 3600;

log("── Publicación de datos ─────────────────────");
loadEnv();
const { kvId, prodUrl } = config();
if (has("build")) log("⚠ --build ya no hace nada acá: el front se publica aparte con `npm run deploy:front`");

// 1. Chequeo de Access ANTES de generar/subir nada (en --dry-run solo avisa).
await requireAccess(prodUrl, { warnOnly: dryRun });

// 2. Foto en snapshot/ (escritura atómica, ver export-snapshot.mjs).
const db = arg("db", process.env.FV_DB_PATH);
run("node", ["scripts/export-snapshot.mjs", "--out", "snapshot", ...(db ? ["--db", db] : [])]);
const meta = JSON.parse(fs.readFileSync(path.join(OUT, "meta.json"), "utf8"));
log(`Snapshot: base modificada ${meta.source.modified} · ${(meta.bytes / 1e6).toFixed(1)} MB · IPC hasta ${meta.ipc?.hasta ?? "?"} (${meta.ipc?.origen ?? "?"})`);

if (dryRun) {
  log("--dry-run: no se suben los datos");
  process.exit(0);
}

// 3. Subida al KV.
const token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Con token: directo a la API de Cloudflare, con reintentos y la causa exacta en el log.
async function putApi(key, body, ttl) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${kvId}/values/${encodeURIComponent(key)}${ttl ? `?expiration_ttl=${ttl}` : ""}`;
  for (let intento = 1; ; intento++) {
    let error;
    try {
      const res = await fetch(url, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body, signal: AbortSignal.timeout(60000) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) return;
      error = `HTTP ${res.status}${json?.errors?.length ? ": " + json.errors.map(e => `${e.code} ${e.message}`).join("; ") : ""}`;
      // Token o permisos: reintentar no sirve.
      if (res.status === 401 || res.status === 403) fail(`KV ${key}: ${error}. ¿El token tiene "Workers KV Storage: Edit"?`);
    } catch (e) {
      error = `${e.name === "TimeoutError" ? "tiempo agotado (60 s)" : e.message}${e.cause ? ` (${e.cause.code || e.cause.message})` : ""}`;
    }
    if (intento >= 4) fail(`KV ${key}: ${error}. Se reintentó ${intento} veces.`);
    log(`⚠ KV ${key}: ${error}. Reintento ${intento} de 3…`);
    await sleep(2000 * intento);
  }
}

// Sin token (la Mac con `wrangler login`): con wrangler, desde un archivo temporal.
function putWrangler(key, body, ttl) {
  const tmp = path.join(OUT, "kv-parte.tmp");
  fs.writeFileSync(tmp, body);
  run("npx", ["wrangler", "kv", "key", "put", key, "--path", path.relative(ROOT, tmp), "--namespace-id", kvId, "--remote", ...(ttl ? ["--ttl", String(ttl)] : [])]);
  fs.rmSync(tmp, { force: true });
}

if (token && !account) fail("Falta CLOUDFLARE_ACCOUNT_ID en el .env");
const put = token ? putApi : putWrangler;

// Primero las partes y al final meta.json: el front mira meta.json para saber si hay una foto nueva,
// así nunca ve un meta que apunte a partes que todavía no subieron.
const gz = fs.readFileSync(path.join(OUT, "snapshot.json.gz"));
const prefijo = `partes/${meta.generatedAt.replace(/[^0-9A-Za-z]/g, "")}/`;
const cantidad = Math.ceil(gz.length / PARTE);
log(`Subiendo la foto en ${cantidad} partes de hasta ${PARTE / 1024} KB${token ? "" : " (con wrangler: más lento)"}…`);
const t0 = Date.now();
for (let i = 0; i < cantidad; i++) await put(prefijo + i, gz.subarray(i * PARTE, (i + 1) * PARTE), TTL_PARTES);
await put("meta.json", JSON.stringify({ ...meta, partes: { prefijo, cantidad } }, null, 2));
log(`✓ Datos publicados en ${((Date.now() - t0) / 1000).toFixed(0)} s (${prodUrl}data/)`);
