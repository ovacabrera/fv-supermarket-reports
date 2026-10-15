// Lee la base del POS (.script + .log) de forma consistente. Solo lectura: nunca escribe,
// bloquea ni renombra nada en la carpeta del POS. Lo usan scripts/export-snapshot.mjs y server.cjs.

import fs from "fs";

const statOf = file => { try { const s = fs.statSync(file); return { size: s.size, modified: s.mtime.toISOString() }; } catch { return null; } };
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export const logPathFor = scriptPath => scriptPath.replace(/\.script$/i, "") + ".log";

// → { script, log, source }. `log` es null si no hay .log o si se pidió { log: false }.
// Si en el medio hubo un checkpoint (el .script cambió o el .log se achicó), los dos archivos
// serían de momentos distintos: se vuelve a leer, hasta `retries` veces. Que el .log crezca
// mientras se lee es normal (el POS sigue vendiendo) y no mezcla estados.
export function readPosDb(scriptPath, { log: useLog = true, retries = 3 } = {}) {
  const logPath = logPathFor(scriptPath);
  for (let attempt = 1; ; attempt++) {
    const s0 = statOf(scriptPath);
    if (!s0) throw new Error(`No se encontró la base: ${scriptPath}`);
    const l0 = useLog ? statOf(logPath) : null;
    const script = fs.readFileSync(scriptPath, "utf8");
    const log = l0 ? fs.readFileSync(logPath, "utf8") : null;
    const s1 = statOf(scriptPath), l1 = l0 ? statOf(logPath) : null;
    const consistent = s1 && s1.size === s0.size && s1.modified === s0.modified && (!l0 || (l1 && l1.size >= l0.size));
    if (consistent) {
      const logInfo = l0 ? { size: Buffer.byteLength(log), modified: l1.modified } : null;
      // `modified` (lo que muestra "Datos al …") es la escritura más nueva entre los dos archivos.
      const modified = logInfo && logInfo.modified > s0.modified ? logInfo.modified : s0.modified;
      return { script, log, source: { file: scriptPath.split(/[\\/]/).pop(), size: s0.size, modified, script: s0, log: logInfo } };
    }
    if (attempt >= retries) throw new Error("La base cambió mientras se leía (checkpoint del POS). Probá de nuevo en un rato.");
    sleep(2000);
  }
}
