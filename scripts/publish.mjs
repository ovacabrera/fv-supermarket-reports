// Publica la última foto de la base en Workers KV. Lo corre la PC del POS (Programador de tareas).
// El front NO se publica acá: se publica aparte con scripts/deploy-front.mjs y lee los datos del KV
// por /data/* (functions/data/[[path]].js). Así una versión nueva del front nunca pisa los datos.
//
//   node scripts/publish.mjs [--db <ruta .script>] [--dry-run]
//
//   --db       ruta a la base (por defecto la misma que export-snapshot, o FV_DB_PATH).
//   --dry-run  genera la foto pero no la sube.
//
// Variables (en .env, ver .env.example): CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID para correr
// sin `wrangler login`. El token necesita "Workers KV Storage: Edit". El KV sale de wrangler.json.
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

// 3. Subida al KV. Primero la foto y después meta.json: el front mira meta.json para saber si hay
// una foto nueva, así nunca ve un meta que apunte a una foto que todavía no está.
const put = file => run("npx", ["wrangler", "kv", "key", "put", file, "--path", path.join("snapshot", file), "--namespace-id", kvId, "--remote"]);
put("snapshot.json.gz");
put("meta.json");

log(`✓ Datos publicados (${prodUrl}data/)`);
