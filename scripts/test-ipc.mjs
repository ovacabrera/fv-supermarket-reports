// Prueba del IPC del INDEC: lectura del CSV, validación y respaldo cuando falla la descarga.
//
//   node scripts/test-ipc.mjs [<ruta a serie_ipc_divisiones.csv>]
//
// Con un CSV real, comprueba además que dé exactamente los valores de src/lib/ipc.js.
// No usa la red: fetch se reemplaza por respuestas armadas.

import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { parseIpcCsv, validarIpc, ipcHasta } from "../src/lib/indec.js";
import { IPC, ipcDe, ultimoIpc } from "../src/lib/ipc.js";
import { obtenerIpc } from "../server/src/fetchIpc.mjs";

// CSV armado: latin1, CRLF, coma decimal, NA y el \r pegado a Region.
const fila = (cod, per, vm, region = "Nacional") => `${cod};Alimentos y bebidas no alcohólicas;Nivel general y divisiones COICOP;${per};100;${vm};NA;${region}`;
function csvDe(desde, valores, extra = []) {
  const filas = ["Codigo;Descripcion;Clasificador;Periodo;Indice_IPC;v_m_IPC;v_i_a_IPC;Region"];
  let [y, m] = desde;
  for (const v of valores) {
    filas.push(fila("01", `${y}${String(m).padStart(2, "0")}`, v));
    filas.push(fila("0", `${y}${String(m).padStart(2, "0")}`, "9,9"));
    filas.push(fila("01", `${y}${String(m).padStart(2, "0")}`, "8,8", "GBA"));
    if (++m > 12) { m = 1; y++; }
  }
  return [...filas, ...extra].join("\r\n") + "\r\n";
}
const latin1 = text => Buffer.from(text, "latin1");

// ── parseIpcCsv ──
const valores = ["NA", ...Array.from({ length: 14 }, (_, i) => `${i % 3},${i}`)];
const p = parseIpcCsv(csvDe([2024, 12], valores));
assert.deepEqual(Object.keys(p), ["2024", "2025", "2026"]);
assert.equal(p[2024][11], null);                // NA
assert.equal(p[2025][0], 0);                    // "0,0"
assert.equal(p[2025][1], 1.1);                  // coma decimal
assert.equal(p[2026][1], 1.13);
assert.equal(p[2026][2], null);                 // sin publicar
assert.equal(ipcHasta(p), "2026-02");
assert.equal(parseIpcCsv(csvDe([2025, 1], ["1,0"]), { codigo: "0" })[2025][0], 9.9);
assert.throws(() => parseIpcCsv("Codigo;Periodo\r\n01;202501"), /columna/);

// ── validarIpc ──
assert.deepEqual(validarIpc(p).errores, []);
assert.match(validarIpc({ 2025: [1, 1, null, 1, 1, 1, 1, 1, 1, 1, 1, 1], 2026: [1, null, null, null, null, null, null, null, null, null, null, null] }).errores.join(), /falta el dato/);
assert.match(validarIpc({ 2025: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 45] }).errores.join(), /fuera de rango/);
assert.match(validarIpc({ 2025: [1, 2, null, null, null, null, null, null, null, null, null, null] }).errores.join(), /solo 2 meses/);
const conocido = { 2025: [...p[2025]], 2026: [...p[2026].slice(0, 2), 5, ...Array(9).fill(null)] };
assert.match(validarIpc(p, conocido).errores.join(), /antes que lo ya conocido/);
const revisado = { ...p, 2025: p[2025].map((v, i) => i === 3 ? v + 0.1 : v) };
assert.deepEqual(validarIpc(revisado, p).errores, []);
assert.match(validarIpc(revisado, p).avisos.join(), /cambió datos ya conocidos/);

// ── ipcDe / ultimoIpc ──
assert.equal(ipcDe({}), IPC);
assert.equal(ipcDe({ ipc: {} }), IPC);
assert.equal(ipcDe({ ipc: p }), p);
assert.deepEqual(ultimoIpc(p), { year: 2026, month: 1 });

// ── obtenerIpc, con fetch armado ──
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "test-ipc-"));
const cachePath = path.join(dir, "ipc.json");
const realFetch = globalThis.fetch;
let pedidos = [];
function fakeFetch({ csv, lastModified = "Tue, 13 Oct 2026 19:02:43 GMT", falla = false }) {
  globalThis.fetch = async (url, opts = {}) => {
    pedidos.push(opts.method || "GET");
    if (falla) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    return new Response(opts.method === "HEAD" ? null : latin1(csv), { status: 200, headers: { "last-modified": lastModified } });
  };
}

try {
  // Sin red y sin copia: el valor del código, con aviso.
  fakeFetch({ falla: true });
  let r = await obtenerIpc({ cachePath });
  assert.equal(r.ipc, IPC);
  assert.equal(r.meta.origen, "codigo");
  assert.match(r.avisos.join(), /ENOTFOUND/);
  assert.equal(fs.existsSync(cachePath), false);

  // Con red: baja, valida contra el código (meses nuevos, sin choques) y guarda la copia.
  const real = { ...IPC, 2026: [...IPC[2026].slice(0, 9), 2.4, null, null] };
  const csvReal = csvDe([2023, 1], Object.values(real).flat().filter(v => v != null).map(v => String(v).replace(".", ",")));
  fakeFetch({ csv: csvReal });
  pedidos = [];
  r = await obtenerIpc({ cachePath });
  assert.deepEqual(pedidos, ["HEAD", "GET"]);
  assert.equal(r.meta.origen, "indec");
  assert.equal(r.meta.hasta, "2026-10");
  assert.deepEqual(r.avisos, []);
  assert.equal(JSON.parse(fs.readFileSync(cachePath, "utf8")).lastModified, "Tue, 13 Oct 2026 19:02:43 GMT");

  // Mismo Last-Modified: solo el HEAD.
  pedidos = [];
  r = await obtenerIpc({ cachePath });
  assert.deepEqual(pedidos, ["HEAD"]);
  assert.equal(r.meta.hasta, "2026-10");

  // maxAgeMs: no consulta.
  pedidos = [];
  r = await obtenerIpc({ cachePath, maxAgeMs: 3600_000 });
  assert.deepEqual(pedidos, []);
  assert.equal(r.meta.hasta, "2026-10");

  // Sin red con copia: la copia.
  fakeFetch({ falla: true });
  r = await obtenerIpc({ cachePath });
  assert.equal(r.meta.origen, "copia");
  assert.equal(r.meta.hasta, "2026-10");

  // Archivo nuevo que no pasa la validación (valor absurdo): la copia, con aviso, y la copia no se pisa.
  fakeFetch({ csv: csvReal.replace(/;2,4;/, ";240;"), lastModified: "Fri, 13 Nov 2026 19:00:00 GMT" });
  r = await obtenerIpc({ cachePath });
  assert.equal(r.meta.origen, "copia");
  assert.match(r.avisos.join(), /no pasó la validación/);
  assert.equal(JSON.parse(fs.readFileSync(cachePath, "utf8")).lastModified, "Tue, 13 Oct 2026 19:02:43 GMT");
} finally {
  globalThis.fetch = realFetch;
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── CSV real (opcional): tiene que coincidir con src/lib/ipc.js ──
const csvPath = process.argv[2];
if (csvPath) {
  const real = parseIpcCsv(new TextDecoder("latin1").decode(fs.readFileSync(csvPath)));
  for (const [y, meses] of Object.entries(IPC))
    meses.forEach((v, m) => { if (v != null) assert.equal(real[y][m], v, `${y}-${m + 1}`); });
  assert.deepEqual(validarIpc(real, IPC).errores, []);
  console.log(`✓ CSV real: coincide con src/lib/ipc.js (datos hasta ${ipcHasta(real)})`);
}

console.log("✓ IPC del INDEC: todos los casos pasan");
