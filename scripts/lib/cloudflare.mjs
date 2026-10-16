// Lo común a publish.mjs (datos) y deploy-front.mjs (front): log, comandos, .env, chequeo de Access
// y configuración de wrangler.json.

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOG = path.join(ROOT, "logs", "publish.log");

export const has = name => process.argv.includes(`--${name}`);
export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

fs.mkdirSync(path.dirname(LOG), { recursive: true });
export function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + "\n");
}
export function fail(msg) {
  log(`✗ ${msg}`);
  process.exit(1);
}

// Corre un comando, copia su salida al log y falla si termina mal.
// Con shell (Windows) los argumentos se unen sin comillas: los que tienen espacios hay que citarlos.
const quote = a => (process.platform === "win32" && /[\s"]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a);

export function run(cmd, args, env) {
  args = args.map(quote);
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

export function loadEnv() {
  try { process.loadEnvFile(path.join(ROOT, ".env")); } catch { /* sin .env: se usan las variables del sistema */ }
  // Sin token se usa la sesión de `npx wrangler login` (cómodo en la Mac; en la PC del POS conviene el token).
  if (!process.env.CLOUDFLARE_API_TOKEN) log("Sin CLOUDFLARE_API_TOKEN: se usa la sesión de `wrangler login`");
}

// Proyecto de Pages y espacio de KV de los datos, desde wrangler.json (CF_PAGES_PROJECT tiene prioridad).
export function config() {
  const w = JSON.parse(fs.readFileSync(path.join(ROOT, "wrangler.json"), "utf8"));
  const project = process.env.CF_PAGES_PROJECT || w.name;
  const kvId = w.kv_namespaces?.find(k => k.binding === "DATOS")?.id;
  if (!project) fail("Falta el proyecto de Pages (CF_PAGES_PROJECT o name en wrangler.json)");
  if (!kvId) fail("Falta el KV de los datos (binding DATOS en wrangler.json)");
  return { project, kvId, prodUrl: `https://${project}.pages.dev/` };
}

// ¿La URL está detrás de Cloudflare Access? Access responde con un redirect a
// <equipo>.cloudflareaccess.com (o 401/403 con cabeceras cf-access).
export async function isProtected(url) {
  const res = await fetch(url, { redirect: "manual", cache: "no-store" });
  const loc = res.headers.get("location") || "";
  if (res.status >= 300 && res.status < 400 && /cloudflareaccess\.com/.test(loc)) return true;
  if ((res.status === 401 || res.status === 403) && [...res.headers.keys()].some(k => k.startsWith("cf-access"))) return true;
  return { status: res.status, location: loc };
}

// Falla (o solo avisa, con warnOnly) si la URL no está protegida por Access.
export async function requireAccess(url, { warnOnly = false } = {}) {
  const bad = warnOnly ? msg => log(`⚠ ${msg}`) : fail;
  try {
    const p = await isProtected(url);
    if (p !== true) bad(`${url} NO está protegido por Cloudflare Access (HTTP ${p.status}${p.location ? " → " + p.location : ""}). No se publica: los datos quedarían públicos.`);
    else log(`✓ Access activo en ${url}`);
  } catch (e) {
    bad(`No se pudo comprobar Access en ${url}: ${e.cause?.code || e.message}. No se publica.`);
  }
}
