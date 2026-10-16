// Publica el front + la última foto de la base en Cloudflare Pages (protegido con Cloudflare Access).
//
//   node scripts/publish.mjs [--build] [--db <ruta .script>] [--dry-run]
//
//   --build    rearma el front (vite build). Sin esto solo se rearma si dist/ no existe.
//   --db       ruta a la base (por defecto la misma que export-snapshot, o FV_DB_PATH).
//   --dry-run  hace todo menos el deploy.
//
// Variables (en .env, ver .env.example): CF_PAGES_PROJECT y, para correr sin `wrangler login`,
// CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID.
//
// Seguridad: antes de subir datos verifica que <proyecto>.pages.dev responda con el login de
// Cloudflare Access. Si la URL está abierta (o no se puede comprobar), NO publica.
//
// Deja log en logs/publish.log y sale con código distinto de 0 si algo falla.

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const LOG = path.join(ROOT, "logs", "publish.log");

const has = name => process.argv.includes(`--${name}`);
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

fs.mkdirSync(path.dirname(LOG), { recursive: true });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + "\n");
}
function fail(msg) {
  log(`✗ ${msg}`);
  process.exit(1);
}

// Corre un comando, copia su salida al log y falla si termina mal.
function run(cmd, args, env) {
  log(`$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: process.platform === "win32", // npx es npx.cmd en Windows
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  if (out) fs.appendFileSync(LOG, out + "\n");
  if (r.status !== 0) fail(`${cmd} terminó con código ${r.status ?? r.error?.message}\n${out.split("\n").slice(-15).join("\n")}`);
  return out;
}

// ¿La URL está detrás de Cloudflare Access? Access responde con un redirect a
// <equipo>.cloudflareaccess.com (o 401/403 con cabeceras cf-access).
async function isProtected(url) {
  const res = await fetch(url, { redirect: "manual", cache: "no-store" });
  const loc = res.headers.get("location") || "";
  if (res.status >= 300 && res.status < 400 && /cloudflareaccess\.com/.test(loc)) return true;
  if ((res.status === 401 || res.status === 403) && [...res.headers.keys()].some(k => k.startsWith("cf-access"))) return true;
  return { status: res.status, location: loc };
}

try { process.loadEnvFile(path.join(ROOT, ".env")); } catch { /* sin .env: se usan las variables del sistema */ }

const project = process.env.CF_PAGES_PROJECT;
const dryRun = has("dry-run");

log("── Publicación ──────────────────────────────");
if (!project) fail("Falta CF_PAGES_PROJECT (ver .env.example)");
// Sin token se usa la sesión de `npx wrangler login` (cómodo en la Mac; en la PC del POS conviene el token).
if (!dryRun && !process.env.CLOUDFLARE_API_TOKEN) log("Sin CLOUDFLARE_API_TOKEN: se usa la sesión de `wrangler login`");

// 1. Chequeo de Access ANTES de generar/subir nada (en --dry-run solo avisa).
const prodUrl = `https://${project}.pages.dev/`;
const accessError = dryRun ? msg => log(`⚠ ${msg}`) : fail;
try {
  const p = await isProtected(prodUrl);
  if (p !== true) accessError(`${prodUrl} NO está protegido por Cloudflare Access (HTTP ${p.status}${p.location ? " → " + p.location : ""}). No se publica: los datos quedarían públicos.`);
  else log(`✓ Access activo en ${prodUrl}`);
} catch (e) {
  accessError(`No se pudo comprobar Access en ${prodUrl}: ${e.cause?.code || e.message}. No se publica.`);
}

// 2. Front: se rearma solo si se pide o si no existe.
if (has("build") || !fs.existsSync(path.join(DIST, "index.html"))) run("npm", ["run", "build"]);
else log("Front: se reutiliza dist/ (usar --build para rearmarlo)");
// _headers se copia siempre, por si cambió y no se rearmó el front.
fs.copyFileSync(path.join(ROOT, "public", "_headers"), path.join(DIST, "_headers"));

// 3. Datos: snapshot directo a dist/data (escritura atómica, ver export-snapshot.mjs).
const db = arg("db", process.env.FV_DB_PATH);
run("node", ["scripts/export-snapshot.mjs", "--out", "dist/data", ...(db ? ["--db", db] : [])]);
const meta = JSON.parse(fs.readFileSync(path.join(DIST, "data", "meta.json"), "utf8"));
log(`Snapshot: base modificada ${meta.source.modified} · ${(meta.bytes / 1e6).toFixed(1)} MB · IPC hasta ${meta.ipc?.hasta ?? "?"} (${meta.ipc?.origen ?? "?"})`);

// 4. Deploy.
if (dryRun) {
  log("--dry-run: no se hace el deploy");
  process.exit(0);
}
const out = run("npx", [
  "wrangler", "pages", "deploy", "dist",
  "--project-name", project,
  "--branch", "main",
  "--commit-dirty=true",
  "--commit-message", `Datos al ${meta.source.modified}`,
]);

// 5. El deploy también queda en una URL propia (<hash>.<proyecto>.pages.dev): comprobar que tampoco esté abierta.
const deployUrl = out.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev/i)?.[0];
if (deployUrl) {
  const p = await isProtected(deployUrl).catch(e => ({ status: e.message }));
  if (p !== true) fail(`¡ATENCIÓN! ${deployUrl} NO está protegido (HTTP ${p.status}). Agregar *.${project}.pages.dev a la aplicación de Access.`);
  log(`✓ Access activo en ${deployUrl}`);
}
log(`✓ Publicado en ${prodUrl}`);
