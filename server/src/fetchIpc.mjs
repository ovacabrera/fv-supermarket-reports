// Baja el IPC del INDEC (CSV oficial) y guarda la última copia buena.
//
// Nunca falla: si no hay red, el INDEC no responde o el archivo no pasa la validación,
// devuelve la última copia guardada o, si no hay ninguna, la serie de src/lib/ipc.js.
// Lo que pasó queda en `avisos` (export-snapshot lo muestra y termina en publish.log).
//
// El INDEC publica una vez por mes: con un HEAD se compara el Last-Modified con el de la
// copia guardada y solo se baja el archivo (~1,2 MB) cuando cambió.

import fs from "fs";
import path from "path";
import { IPC } from "../../src/lib/ipc.js";
import { IPC_CSV_URL, parseIpcCsv, validarIpc, ipcHasta } from "../../src/lib/indec.js";

export const IPC_SERIE = "Alimentos y bebidas no alcohólicas (nacional)";

function leerCopia(cachePath) {
  try {
    const c = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    return c && c.ipc && typeof c.ipc === "object" ? c : null;
  } catch { return null; }
}

function guardarCopia(cachePath, copia) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const tmp = cachePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(copia, null, 2));
  fs.renameSync(tmp, cachePath);
}

const resultado = (ipc, origen, copia, avisos) => ({
  ipc,
  meta: {
    serie: IPC_SERIE,
    hasta: ipcHasta(ipc),
    origen, // "indec" (bajado o revisado ahora), "copia" (la guardada, sin consultar o sin poder consultar) o "codigo"
    descargado: copia?.descargado ?? null,
    lastModified: copia?.lastModified ?? null,
  },
  avisos,
});

// opciones:
//   cachePath  dónde guardar la última copia buena (fuera del repo, p. ej. snapshot/ipc.json)
//   timeoutMs  para cada pedido al INDEC
//   maxAgeMs   si la copia se revisó hace menos que esto, no se consulta al INDEC
export async function obtenerIpc({ cachePath, timeoutMs = 20_000, maxAgeMs = 0 } = {}) {
  const avisos = [];
  const copia = cachePath ? leerCopia(cachePath) : null;
  const respaldo = () => copia ? resultado(copia.ipc, "copia", copia, avisos) : resultado(IPC, "codigo", null, avisos);
  const guardar = c => {
    if (!cachePath) return;
    try { guardarCopia(cachePath, c); } catch (e) { avisos.push(`IPC: no se pudo guardar la copia en ${cachePath}: ${e.message}`); }
  };

  if (copia && maxAgeMs > 0 && Date.now() - Date.parse(copia.revisado) < maxAgeMs) return resultado(copia.ipc, "copia", copia, avisos);

  try {
    const head = await fetch(IPC_CSV_URL, { method: "HEAD", signal: AbortSignal.timeout(timeoutMs) });
    const lastModified = head.ok ? head.headers.get("last-modified") : null;
    if (copia && lastModified && copia.lastModified === lastModified) {
      guardar({ ...copia, revisado: new Date().toISOString() });
      return resultado(copia.ipc, "indec", copia, avisos);
    }

    const res = await fetch(IPC_CSV_URL, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = new TextDecoder("latin1").decode(await res.arrayBuffer());
    const ipc = parseIpcCsv(text);
    const { errores, avisos: avisosValidacion } = validarIpc(ipc, copia?.ipc ?? IPC);
    avisos.push(...avisosValidacion.map(a => `IPC: ${a}`));
    if (errores.length) {
      avisos.push(`IPC: el CSV del INDEC no pasó la validación (${errores.join("; ")}). Se usa ${copia ? "la última copia guardada" : "el valor del código"}.`);
      return respaldo();
    }

    const ahora = new Date().toISOString();
    const nueva = { serie: IPC_SERIE, descargado: ahora, revisado: ahora, lastModified: res.headers.get("last-modified") || lastModified, ipc };
    guardar(nueva);
    return resultado(ipc, "indec", nueva, avisos);
  } catch (e) {
    avisos.push(`IPC: no se pudo bajar del INDEC (${e.name === "TimeoutError" ? "sin respuesta" : e.cause?.code || e.message}). Se usa ${copia ? "la última copia guardada" : "el valor del código"}.`);
    return respaldo();
  }
}
