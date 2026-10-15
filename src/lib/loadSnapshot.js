// ─── Carga del snapshot publicado (./data/) con copia local en IndexedDB ─────
// Flujo (stale-while-revalidate):
//   1. readCachedSnapshot()   → la última foto guardada en el teléfono, al instante.
//   2. fetchMeta()            → ./data/meta.json, liviano, para ver si hay una foto nueva.
//   3. fetchSnapshot(meta)    → baja ./data/snapshot.json.gz, lo decodifica y lo guarda.
//
// Se guarda el .gz tal cual (4 MB) en vez del objeto decodificado (~100 MB en memoria):
// la escritura es rápida y rearmarlo al abrir tarda menos de un segundo.

import { decodeSnapshot, SNAPSHOT_VERSION } from "./snapshot.js";

const DATA_URL = "./data/";
const IDB_NAME = "fv-panel";
const IDB_STORE = "snapshot";
const IDB_KEY = "current";

// ── IndexedDB mínimo. Cualquier error (modo privado, sin espacio) se ignora: sin cache igual funciona.
function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IDB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(IDB_STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(IDB_STORE, mode);
      const req = fn(tx.objectStore(IDB_STORE));
      tx.oncomplete = () => { open.result.close(); resolve(req.result); };
      tx.onerror = tx.onabort = () => { open.result.close(); reject(tx.error); };
    };
  });
}
const idbGet = () => idb("readonly", s => s.get(IDB_KEY));
const idbPut = value => idb("readwrite", s => s.put(value, IDB_KEY));

// ── Bytes → objeto del snapshot.
// Si Pages mandó el archivo con Content-Encoding: gzip, el navegador ya lo descomprimió:
// se miran los primeros bytes (1f 8b = gzip) en vez de confiar en las cabeceras.
async function bytesToSnapshot(buf) {
  const bytes = new Uint8Array(buf);
  let text;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  return decodeSnapshot(JSON.parse(text));
}

// Última foto guardada en este dispositivo, o null.
export async function readCachedSnapshot() {
  try {
    const cached = await idbGet();
    if (!cached || cached.meta?.version !== SNAPSHOT_VERSION) return null;
    return await bytesToSnapshot(cached.gz);
  } catch {
    return null;
  }
}

// meta.json publicado, o null si no hay snapshot publicado en este origen
// (dev, Electron, sin conexión o sesión de Access vencida).
export async function fetchMeta() {
  try {
    const res = await fetch(DATA_URL + "meta.json", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return null;
    const meta = await res.json();
    return meta?.version === SNAPSHOT_VERSION && meta.generatedAt ? meta : null;
  } catch {
    return null;
  }
}

// Baja la foto descripta por `meta`, la guarda en IndexedDB y devuelve { db, meta }.
export async function fetchSnapshot(meta) {
  const url = `${DATA_URL}snapshot.json.gz?v=${encodeURIComponent(meta.generatedAt)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const gz = await res.arrayBuffer();
  const snap = await bytesToSnapshot(gz);
  // Si llegó a medio actualizar (meta nueva, datos viejos), se usa la meta que trae el propio archivo.
  try { await idbPut({ meta: snap.meta, gz }); } catch { /* sin cache: no pasa nada */ }
  return snap;
}

// Foto armada en el momento por el server local (Electron / LAN) con .script + .log. No se guarda.
export async function fetchLiveSnapshot(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return bytesToSnapshot(await res.arrayBuffer());
}

// Antigüedad de la foto: fecha de la base del POS (o de generación, si no viene).
export function snapshotDate(meta) {
  return new Date(meta?.source?.modified || meta?.generatedAt);
}
