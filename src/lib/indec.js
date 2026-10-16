// ─── IPC del INDEC: lectura y validación del CSV oficial ─────────────────────
// https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_divisiones.csv
// Separado por ";", decimales con coma, "NA" sin dato y fin de línea CRLF.
// Columnas: Codigo;Descripcion;Clasificador;Periodo;Indice_IPC;v_m_IPC;v_i_a_IPC;Region
//
// Funciones puras (sin red ni fs). La descarga está en server/src/fetchIpc.mjs.

export const IPC_CSV_URL = "https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_divisiones.csv";

// texto del CSV (ya decodificado de latin1) → { [año]: [12 variaciones mensuales en % o null] }
export function parseIpcCsv(text, { codigo = "01", region = "Nacional" } = {}) {
  const lines = text.split(/\r?\n/);
  const header = lines[0].replace(/^\uFEFF/, "").split(";").map(s => s.trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`El CSV del INDEC no tiene la columna ${name}`);
    return i;
  };
  const iCod = col("Codigo"), iPer = col("Periodo"), iVm = col("v_m_IPC"), iReg = col("Region");

  const ipc = {};
  for (let n = 1; n < lines.length; n++) {
    const f = lines[n].split(";").map(s => s.trim());
    if (f.length < header.length || f[iCod] !== codigo || f[iReg] !== region) continue;
    const per = f[iPer];
    if (!/^\d{6}$/.test(per)) continue;
    const year = Number(per.slice(0, 4)), month = Number(per.slice(4)) - 1;
    const v = f[iVm] === "NA" || f[iVm] === "" ? null : Number(f[iVm].replace(",", "."));
    if (v !== null && !Number.isFinite(v)) throw new Error(`Valor inválido en ${per}: ${f[iVm]}`);
    (ipc[year] ||= Array(12).fill(null))[month] = v;
  }
  return ipc;
}

// Meses con dato, en orden: [{ year, month, v }]
function meses(ipc) {
  const out = [];
  for (const y of Object.keys(ipc).map(Number).sort((a, b) => a - b))
    ipc[y].forEach((v, m) => { if (v != null) out.push({ year: y, month: m, v }); });
  return out;
}

// Último mes con dato, como "AAAA-MM" (o null).
export function ipcHasta(ipc) {
  const ms = meses(ipc);
  const u = ms[ms.length - 1];
  return u ? `${u.year}-${String(u.month + 1).padStart(2, "0")}` : null;
}

// Chequea una serie nueva antes de usarla. `conocido` es la última serie buena (o la del código).
// Devuelve { errores, avisos }: con errores no se usa; los avisos solo se informan.
export function validarIpc(ipc, conocido = null) {
  const errores = [], avisos = [];
  const ms = meses(ipc);
  if (ms.length < 12) errores.push(`solo ${ms.length} meses con dato`);
  for (let i = 1; i < ms.length; i++) {
    const a = ms[i - 1], b = ms[i];
    if ((b.year - a.year) * 12 + b.month - a.month !== 1) { errores.push(`falta el dato entre ${a.year}-${a.month + 1} y ${b.year}-${b.month + 1}`); break; }
  }
  for (const { year, month, v } of ms)
    if (v < -5 || v > 30) errores.push(`valor fuera de rango en ${year}-${month + 1}: ${v}%`);

  if (conocido) {
    const nuevoHasta = ipcHasta(ipc), viejoHasta = ipcHasta(conocido);
    if (nuevoHasta && viejoHasta && nuevoHasta < viejoHasta) errores.push(`llega hasta ${nuevoHasta}, antes que lo ya conocido (${viejoHasta})`);
    const cambios = [];
    for (const { year, month, v } of meses(conocido)) {
      const n = ipc[year]?.[month];
      if (n != null && n !== v) cambios.push(`${year}-${month + 1}: ${v} → ${n}`);
    }
    if (cambios.length) avisos.push(`el INDEC cambió datos ya conocidos (${cambios.slice(0, 5).join(", ")}${cambios.length > 5 ? ", …" : ""})`);
  }
  return { errores, avisos };
}
