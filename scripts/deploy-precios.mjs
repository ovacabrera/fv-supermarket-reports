// Publica el consultor de precios público (sites/precios) en su propio proyecto de Pages, SIN Access.
// Los datos no van acá: la lista la sube la PC del POS al KV PRECIOS (scripts/publish.mjs) y la sirve
// sites/precios/functions/data/[[path]].js.
//
//   node scripts/deploy-precios.mjs
//
// Variables: las mismas que deploy-front.mjs (o la sesión de `wrangler login`).
//
// Seguridad: después del deploy comprueba que el sitio público NO sirva la foto de ventas
// (/data/snapshot.json.gz y /data/meta.json tienen que dar 404) y que el panel siga con Access.

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { ROOT, log, fail, run, loadEnv, config, configPrecios, requireAccess } from "./lib/cloudflare.mjs";

const SITIO = path.join(ROOT, "sites", "precios");
const DIST = path.join(SITIO, "dist");
const PRIVADOS = ["data/snapshot.json.gz", "data/meta.json"];

log("── Publicación del consultor de precios público ──");
loadEnv();
const { prodUrl } = config();
const publico = configPrecios();
if (!publico) fail("Falta sites/precios/wrangler.json");
const project = JSON.parse(fs.readFileSync(path.join(SITIO, "wrangler.json"), "utf8")).name;

// 1. Build solo de este sitio. No puede llevar datos adentro.
run("npx", ["vite", "build", "--config", "vite.precios.config.js"]);
if (fs.existsSync(path.join(DIST, "data"))) fail("sites/precios/dist/data no debería existir: los datos van por el KV");

// 2. Deploy desde sites/precios, para que wrangler tome su wrangler.json y su functions/ (no los del panel).
let commit = "sin git";
try { commit = execFileSync("git", ["log", "-1", "--format=%h %s"], { cwd: ROOT, encoding: "utf8" }).trim().replace(/[%"]/g, ""); } catch { /* sin git: no importa */ }
const out = run("npx", [
  "wrangler", "pages", "deploy", "dist",
  "--project-name", project,
  "--branch", "main",
  "--commit-dirty=true",
  "--commit-message", `Precios: ${commit}`,
], undefined, SITIO);
const deployUrl = out.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev/i)?.[0];

// 3. Barandas: el sitio público no sirve nada de la foto de ventas, y el panel sigue protegido.
for (const base of [publico.url, deployUrl].filter(Boolean)) {
  for (const p of PRIVADOS) {
    const res = await fetch(new URL(p, base.endsWith("/") ? base : base + "/"), { redirect: "manual", cache: "no-store" });
    if (res.status !== 404) fail(`¡ATENCIÓN! ${base}${p} respondió HTTP ${res.status}: el sitio público no debería servirlo`);
  }
}
log("✓ El sitio público no sirve la foto de ventas");
await requireAccess(prodUrl);

// 4. La lista de precios: si todavía no se subió, el sitio anda pero muestra el error de carga.
const lista = await fetch(new URL("data/precios.json", publico.url), { cache: "no-store" });
if (lista.ok) {
  const { items, generatedAt } = await lista.json();
  log(`✓ Lista de precios: ${items.length} artículos, foto del ${generatedAt}`);
} else {
  log(`⚠ ${publico.url}data/precios.json respondió HTTP ${lista.status}: falta subir la lista (npm run publish en la PC del POS)`);
}
log(`✓ Consultor de precios publicado en ${publico.url}`);
