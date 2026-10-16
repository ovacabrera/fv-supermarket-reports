// ─── Productos: Pareto y artículos que se compran juntos ──────────────────────
// Funciones puras (sin React), sobre las órdenes del período ya filtradas.

import { FIAMBR_PROD_ID } from "./metrics.js";

const esArticulo = ol => ol.productId && ol.productId !== FIAMBR_PROD_ID;
const nombreDe = (db, id) => db.products[id] || `Prod.${id}`;

// ── Pareto (ABC) ──────────────────────────────────────────────────────────────
// A: los que suman hasta el 80% de la venta · B: del 80% al 95% · C: el resto.
export function computePareto(db, filtered) {
  const ids = new Set(filtered.map(o => o.id));
  const venta = new Map();
  for (const ol of db.orderLines) {
    if (!ids.has(ol.orderId) || !esArticulo(ol)) continue;
    venta.set(ol.productId, (venta.get(ol.productId) || 0) + ol.subtotal);
  }
  const filas = [...venta.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = filas.reduce((s, [, v]) => s + v, 0);
  if (!filas.length || total <= 0) return null;

  const clases = { A: { n: 0, venta: 0 }, B: { n: 0, venta: 0 }, C: { n: 0, venta: 0 } };
  const listaA = [];
  let acum = 0;
  for (const [id, v] of filas) {
    // La clase se decide por dónde arranca el artículo: el que cruza el 80% todavía es A.
    const clase = acum < total * 0.8 ? "A" : acum < total * 0.95 ? "B" : "C";
    acum += v;
    clases[clase].n++;
    clases[clase].venta += v;
    if (clase === "A") listaA.push({ name: nombreDe(db, id), value: Math.round(v), pct: (v / total) * 100 });
  }
  const n = filas.length;
  for (const c of Object.values(clases)) { c.pctArticulos = (c.n / n) * 100; c.pctVenta = (c.venta / total) * 100; }
  return { articulos: n, total, clases, listaA };
}

// ── Se compran juntos ─────────────────────────────────────────────────────────
// Pares de artículos en la misma compra. Lift = P(A y B) / (P(A) × P(B)): cuántas veces
// más de lo esperado si se compraran por separado.
const MIN_COMPRAS = 200;
const MAX_ARTICULOS_COMPRA = 40;
const LIFT_MIN = 1.5;
const TOP_PARES = 10;

export function computeJuntos(db, filtered) {
  const ids = new Set(filtered.map(o => o.id));
  const compras = new Map(); // orderId → Set de productId
  for (const ol of db.orderLines) {
    if (!ids.has(ol.orderId) || !esArticulo(ol)) continue;
    let s = compras.get(ol.orderId);
    if (!s) { s = new Set(); compras.set(ol.orderId, s); }
    s.add(ol.productId);
  }
  const n = compras.size;
  if (n < MIN_COMPRAS) return { pocas: true, compras: n, minimo: MIN_COMPRAS };

  const solo = new Map(), pares = new Map();
  for (const s of compras.values()) {
    const items = [...s];
    for (const a of items) solo.set(a, (solo.get(a) || 0) + 1);
    if (items.length < 2 || items.length > MAX_ARTICULOS_COMPRA) continue;
    items.sort((a, b) => a - b);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const k = items[i] * 1e7 + items[j];
        pares.set(k, (pares.get(k) || 0) + 1);
      }
    }
  }
  const minJuntos = Math.max(5, Math.ceil(n * 0.002));
  const filas = [];
  for (const [k, juntos] of pares) {
    if (juntos < minJuntos) continue;
    const a = Math.floor(k / 1e7), b = k % 1e7;
    const lift = (juntos * n) / (solo.get(a) * solo.get(b));
    if (lift < LIFT_MIN) continue;
    filas.push({ a: nombreDe(db, a), b: nombreDe(db, b), juntos, lift });
  }
  filas.sort((x, y) => y.juntos - x.juntos || y.lift - x.lift);
  return { pares: filas.slice(0, TOP_PARES), compras: n, minJuntos };
}
