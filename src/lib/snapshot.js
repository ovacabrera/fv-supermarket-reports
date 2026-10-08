// ─── Snapshot pre-procesado ───────────────────────────────────────────────────
// Convierte el resultado de parseHSQLScript a un formato compacto por columnas
// (para publicar y bajar desde el celular) y lo vuelve a armar con la misma forma.
//
// Es genérico: toma las tablas (arrays) y mapas (objetos) que devuelva el parser,
// así que si el parser agrega campos o tablas, el snapshot los incluye solo.
//
// Tipos de columna:
//   "v"  valores tal cual (números, strings, null)
//   "c"  constante: todas las filas tienen el mismo valor
//   "d"  fechas como segundos de "hora local de pared" (ver dateToWall)
//   "z"  enteros codificados como diferencia con la fila anterior (ids, fechas ordenadas)

export const SNAPSHOT_VERSION = 1;

// Las fechas del POS no tienen zona horaria: se guardan como la hora de pared
// (2025-03-01 13:20:00) codificada como si fuera UTC, para que se vean igual
// sin importar la zona horaria de la PC que exporta o del celular que muestra.
function dateToWall(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) / 1000;
}
function wallToDate(s) {
  if (s === null) return null;
  const u = new Date(s * 1000);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
}

// Quita el ruido de punto flotante (240.89999999 → 240.9) sin perder kilos con 3 decimales.
function roundNum(v) { return typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v; }

function deltaEncode(values) {
  const out = new Array(values.length);
  let prev = 0;
  for (let i = 0; i < values.length; i++) { out[i] = values[i] - prev; prev = values[i]; }
  return out;
}
function deltaDecode(values) {
  const out = new Array(values.length);
  let acc = 0;
  for (let i = 0; i < values.length; i++) { acc += values[i]; out[i] = acc; }
  return out;
}

function encodeColumn(values) {
  const sample = values.find(v => v !== null && v !== undefined);
  const isDate = sample instanceof Date;
  const v = isDate ? values.map(dateToWall) : values.map(roundNum);
  if (!isDate && v.every(x => x === v[0])) return { t: "c", v: v[0] ?? null };
  if (v.every(Number.isInteger)) {
    // Delta solo si achica: columnas ordenadas (ids, fechas) quedan con números chicos.
    const d = deltaEncode(v);
    let small = 0;
    for (const x of d) if (Math.abs(x) < 1000) small++;
    if (small > v.length * 0.8) return { t: "z", d: isDate, v: d };
  }
  return isDate ? { t: "d", v } : { t: "v", v };
}

function decodeColumn(col, length) {
  switch (col.t) {
    case "c": return new Array(length).fill(col.v);
    case "d": return col.v.map(wallToDate);
    case "z": { const v = deltaDecode(col.v); return col.d ? v.map(wallToDate) : v; }
    default:  return col.v;
  }
}

function encodeTable(rows) {
  if (rows.length === 0) return { n: 0, cols: {} };
  const cols = {};
  for (const key of Object.keys(rows[0])) cols[key] = encodeColumn(rows.map(r => r[key] ?? null));
  return { n: rows.length, cols };
}

function decodeTable({ n, cols }) {
  const keys = Object.keys(cols);
  const data = keys.map(k => decodeColumn(cols[k], n));
  const rows = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = {};
    for (let k = 0; k < keys.length; k++) row[keys[k]] = data[k][i];
    rows[i] = row;
  }
  return rows;
}

// db (salida de parseHSQLScript) → objeto serializable a JSON
export function encodeSnapshot(db, source = {}) {
  const tables = {}, maps = {}, counts = {};
  for (const [name, value] of Object.entries(db)) {
    if (Array.isArray(value)) { tables[name] = encodeTable(value); counts[name] = value.length; }
    else { maps[name] = value; counts[name] = Object.keys(value).length; }
  }
  return { version: SNAPSHOT_VERSION, generatedAt: new Date().toISOString(), source, counts, tables, maps };
}

// objeto del snapshot → { db, meta }, con db en la misma forma que parseHSQLScript
export function decodeSnapshot(snap) {
  if (snap.version !== SNAPSHOT_VERSION) throw new Error(`Versión de snapshot no soportada: ${snap.version}`);
  const db = { ...snap.maps };
  for (const [name, table] of Object.entries(snap.tables)) db[name] = decodeTable(table);
  const { generatedAt, source, counts } = snap;
  return { db, meta: { version: snap.version, generatedAt, source, counts } };
}
