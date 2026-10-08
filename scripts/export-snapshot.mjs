// Genera el snapshot pre-procesado de la base del POS.
//
//   node scripts/export-snapshot.mjs [--db <ruta .script>] [--out <carpeta>]
//
// Escribe en la carpeta de salida (por defecto ./snapshot):
//   snapshot.json.gz  datos compactos (ver src/lib/snapshot.js)
//   meta.json         fecha de la foto, origen y cantidades (liviano, para chequear si hay datos nuevos)

import fs from "fs";
import path from "path";
import os from "os";
import zlib from "zlib";
import { fileURLToPath } from "url";
import { parseHSQLScript } from "../src/lib/parseHSQL.js";
import { encodeSnapshot } from "../src/lib/snapshot.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Misma ruta por defecto que server/src/server.cjs
const DEFAULT_DB = process.platform === "win32"
  ? "C:\\FacilVirtual\\data\\fvposdb.script"
  : path.join(os.homedir(), "Downloads", "fvposdb.script");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// Escribe a un temporal y renombra, para que nunca quede un archivo a medio escribir.
function writeAtomic(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

const mb = n => (n / 1e6).toFixed(1) + " MB";

const dbPath = path.resolve(arg("db", DEFAULT_DB));
const outDir = path.resolve(ROOT, arg("out", "snapshot"));

if (!fs.existsSync(dbPath)) {
  console.error(`✗ No se encontró la base: ${dbPath}`);
  process.exit(1);
}

const t0 = Date.now();
const stat = fs.statSync(dbPath);
console.log(`Leyendo ${dbPath} (${mb(stat.size)})…`);

const db = parseHSQLScript(fs.readFileSync(dbPath, "utf8"));
const t1 = Date.now();

const snap = encodeSnapshot(db, { file: path.basename(dbPath), size: stat.size, modified: stat.mtime.toISOString() });
const json = JSON.stringify(snap);
const gz = zlib.gzipSync(json, { level: 9 });
const t2 = Date.now();

fs.mkdirSync(outDir, { recursive: true });
writeAtomic(path.join(outDir, "snapshot.json.gz"), gz);

const meta = { version: snap.version, generatedAt: snap.generatedAt, source: snap.source, counts: snap.counts, bytes: gz.length };
writeAtomic(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));

console.log(`✓ Snapshot generado en ${outDir}`);
for (const [name, n] of Object.entries(snap.counts)) console.log(`    ${name.padEnd(16)} ${n.toLocaleString("es-AR")}`);
console.log(`  JSON ${mb(json.length)} → gzip ${mb(gz.length)}`);
console.log(`  parseo ${((t1 - t0) / 1000).toFixed(1)}s · codificación ${((t2 - t1) / 1000).toFixed(1)}s`);
