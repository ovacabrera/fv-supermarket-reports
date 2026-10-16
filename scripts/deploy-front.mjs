// Publica el front en Cloudflare Pages, sin datos: los datos los sube la PC del POS al KV
// (scripts/publish.mjs) y el front los lee por /data/* (functions/data/[[path]].js).
// Se puede correr desde cualquier máquina con el repo: no depende de tener la base del POS.
//
//   node scripts/deploy-front.mjs [--preview]
//
//   --preview  publica en la rama "preview" (https://preview.<proyecto>.pages.dev), sin tocar producción.
//              Lee los mismos datos del KV: sirve para probar un front nuevo con los datos reales.
//
// Variables: las mismas que publish.mjs (o la sesión de `wrangler login`). El token necesita
// "Cloudflare Pages: Edit".

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { ROOT, has, log, fail, run, loadEnv, config, requireAccess, isProtected } from "./lib/cloudflare.mjs";

const DIST = path.join(ROOT, "dist");
const branch = has("preview") ? "preview" : "main";

log(`── Publicación del front (${branch}) ──────────────`);
loadEnv();
const { project, prodUrl } = config();

// 1. Access antes de publicar nada.
await requireAccess(prodUrl);

// 2. Build limpio, sin datos adentro (los de antes de separar front y datos iban en dist/data).
run("npm", ["run", "build"]);
fs.rmSync(path.join(DIST, "data"), { recursive: true, force: true });

// 3. Deploy. Con wrangler.json en la raíz, wrangler sube también functions/ y el binding del KV.
let commit = "sin git";
try { commit = execFileSync("git", ["log", "-1", "--format=%h %s"], { cwd: ROOT, encoding: "utf8" }).trim().replace(/[%"]/g, ""); } catch { /* sin git: no importa */ }
const out = run("npx", [
  "wrangler", "pages", "deploy", "dist",
  "--project-name", project,
  "--branch", branch,
  "--commit-dirty=true",
  "--commit-message", `Front: ${commit}`,
]);

// 4. El deploy también queda en una URL propia (<hash>.<proyecto>.pages.dev): comprobar que tampoco esté abierta.
const deployUrl = out.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev/i)?.[0];
if (deployUrl) {
  const p = await isProtected(deployUrl).catch(e => ({ status: e.message }));
  if (p !== true) fail(`¡ATENCIÓN! ${deployUrl} NO está protegido (HTTP ${p.status}). Agregar *.${project}.pages.dev a la aplicación de Access.`);
  log(`✓ Access activo en ${deployUrl}`);
}
log(`✓ Front publicado en ${branch === "main" ? prodUrl : `https://preview.${project}.pages.dev/`}`);
