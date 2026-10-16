// ─── Góndola: precios y faltantes ─────────────────────────────────────────────
// Funciones puras (sin React). El negocio no carga compras ni stock: todo se deduce de
// las ventas. El precio de cada venta es subtotal / qty (en el POS, subtotal = PRICE × QTY).

import { toYMD, fromYMD, MESES_CORTO, MESES_NOMBRE } from "./dates.js";
import { ipcDe, ultimoIpc, factorEntre } from "./ipc.js";
import { FIAMBR_PROD_ID, MAX_ORDEN_RAZONABLE, lastSaleDate } from "./metrics.js";

const DIA = 864e5;

// Precios sin actualizar
const TOP_PRECIOS = 150;          // artículos que más facturaron en los últimos 90 días
const DIAS_SIN_CAMBIO = 45;
const TOLERANCIA_PRECIO = 0.01;   // ±1%: redondeo de los artículos por peso
// Inflación de la góndola
const TOP_CANASTA = 100;
// Faltantes
const VENTANA_FALTANTES = 56;     // días corridos antes de la última venta del artículo
const FRECUENCIA_MIN = 0.5;
const PROB_MAX = 0.02;
const GAP_MAX = 30;               // más días sin venta ya no es un faltante: lo dejaron de traer

// Fecha de cada orden válida (sin las de totales absurdos).
function fechasDeOrdenes(db) {
  const fecha = new Map();
  for (const o of db.orders) if (o.total <= MAX_ORDEN_RAZONABLE) fecha.set(o.id, o.saleDate);
  return fecha;
}

const esArticulo = ol => ol.productId && ol.productId !== FIAMBR_PROD_ID && ol.qty > 0;
const precioDe = ol => Math.round((ol.subtotal / ol.qty) * 100) / 100;
const nombreDe = (db, id) => db.products[id] || `Prod.${id}`;

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// ── Precios sin actualizar ────────────────────────────────────────────────────
// Para los artículos que más venden: precio de la última venta, desde cuándo se cobra
// ese precio y cuánta inflación de alimentos hubo desde entonces.
export function computePrecios(db) {
  const fin = lastSaleDate(db);
  if (!fin) return null;
  const fecha = fechasDeOrdenes(db);
  const desde90 = fin.getTime() - 90 * DIA;
  const desde30 = fin.getTime() - 30 * DIA;

  const venta90 = new Map(), ultima = new Map();
  for (const ol of db.orderLines) {
    if (!esArticulo(ol)) continue;
    const t = fecha.get(ol.orderId)?.getTime();
    if (t === undefined || t < desde90) continue;
    venta90.set(ol.productId, (venta90.get(ol.productId) || 0) + ol.subtotal);
    if (t > (ultima.get(ol.productId) || 0)) ultima.set(ol.productId, t);
  }
  const elegidos = [...venta90.entries()]
    .filter(([id]) => ultima.get(id) >= desde30)
    .sort((a, b) => b[1] - a[1]).slice(0, TOP_PRECIOS).map(([id]) => id);
  const set = new Set(elegidos);

  // Todas las ventas de los elegidos (toda la historia: un precio puede no cambiar hace más de un año).
  const ventas = new Map(elegidos.map(id => [id, []]));
  for (const ol of db.orderLines) {
    if (!set.has(ol.productId) || !(ol.qty > 0)) continue;
    const d = fecha.get(ol.orderId);
    if (d) ventas.get(ol.productId).push({ t: d.getTime(), precio: precioDe(ol) });
  }

  const ipc = ipcDe(db);
  const ultimo = ultimoIpc(ipc);
  const filas = [];
  let recientes = 0;
  for (const id of elegidos) {
    const v = ventas.get(id).sort((a, b) => a.t - b.t);
    const precio = v[v.length - 1].precio;
    const igual = p => Math.abs(p - precio) <= precio * TOLERANCIA_PRECIO;
    // Racha final con este precio. Una venta suelta con otro precio (un precio cargado a mano)
    // no la corta: hacen falta dos seguidas.
    let inicio = v.length - 1, distintas = 0;
    for (let i = v.length - 2; i >= 0; i--) {
      if (igual(v[i].precio)) { inicio = i; distintas = 0; }
      else if (++distintas === 2) break;
    }
    const desde = new Date(v[inicio].t);
    const dias = Math.floor((fin - desde) / DIA);
    if (dias < DIAS_SIN_CAMBIO) { recientes++; continue; }
    const factor = ultimo ? factorEntre(desde.getFullYear(), desde.getMonth(), ultimo.year, ultimo.month, ipc) : 1;
    filas.push({
      id, name: nombreDe(db, id), precio, desde, dias,
      inflacion: (factor - 1) * 100,
      precioConInflacion: precio * factor,
      venta90: venta90.get(id),
    });
  }
  filas.sort((a, b) => b.inflacion - a.inflacion || b.dias - a.dias);
  return { filas, revisados: elegidos.length, recientes, ipcHasta: ultimo };
}

// ── Inflación de la góndola ───────────────────────────────────────────────────
// Canasta fija de los artículos que más facturaron en los últimos 12 meses. Por mes, la mediana
// del precio de cada uno contra el mes base, ponderada por lo que facturó. Comparada con el IPC
// de alimentos de los mismos meses.
export function computeInflacionPropia(db) {
  const fin = lastSaleDate(db);
  const ipc = ipcDe(db);
  const ultimo = ultimoIpc(ipc);
  if (!fin || !ultimo) return null;
  // Último mes: el último cerrado de ventas, sin pasar el último dato del INDEC.
  const cerrado = new Date(fin.getFullYear(), fin.getMonth() - 1, 1);
  const finMes = Math.min(cerrado.getFullYear() * 12 + cerrado.getMonth(), ultimo.year * 12 + ultimo.month);
  const baseMes = finMes - 12;
  const desde = new Date(Math.floor(baseMes / 12), baseMes % 12, 1);
  const hasta = new Date(Math.floor(finMes / 12), finMes % 12 + 1, 1);
  const fecha = fechasDeOrdenes(db);

  const venta = new Map(), precios = new Map(); // id → [13 listas de precios]
  for (const ol of db.orderLines) {
    if (!esArticulo(ol)) continue;
    const d = fecha.get(ol.orderId);
    if (!d || d < desde || d >= hasta) continue;
    venta.set(ol.productId, (venta.get(ol.productId) || 0) + ol.subtotal);
    const k = d.getFullYear() * 12 + d.getMonth() - baseMes;
    let p = precios.get(ol.productId);
    if (!p) { p = Array.from({ length: 13 }, () => []); precios.set(ol.productId, p); }
    p[k].push(precioDe(ol));
  }
  // La canasta: los que más facturaron y se vendieron en el mes base y en el último.
  const canasta = [...venta.entries()]
    .filter(([id]) => precios.get(id)[0].length && precios.get(id)[12].length)
    .sort((a, b) => b[1] - a[1]).slice(0, TOP_CANASTA);
  if (canasta.length < 10) return null;
  const base = new Map(canasta.map(([id]) => [id, median(precios.get(id)[0])]));

  const data = [];
  for (let k = 0; k <= 12; k++) {
    let suma = 0, peso = 0;
    for (const [id, w] of canasta) {
      const lista = precios.get(id)[k];
      if (!lista.length) continue;
      suma += w * (median(lista) / base.get(id));
      peso += w;
    }
    const mes = baseMes + k, y = Math.floor(mes / 12), m = mes % 12;
    const fIpc = factorEntre(Math.floor(baseMes / 12), baseMes % 12, y, m, ipc);
    data.push({
      mes: `${MESES_CORTO[m]} ${String(y).slice(2)}`,
      nombre: `${MESES_NOMBRE[m].toLowerCase()} ${y}`,
      propia: peso ? (suma / peso - 1) * 100 : null,
      ipc: (fIpc - 1) * 100,
    });
  }
  const ult = data[12];
  return { data, propia: ult.propia, ipc: ult.ipc, articulos: canasta.length, desde: data[0].nombre, hasta: ult.nombre };
}

// ── Faltantes probables ───────────────────────────────────────────────────────
// Artículos que se vendían casi todos los días y hace varios días abiertos que no salen.
// La probabilidad de no venderlos esos días por azar es (1 − frecuencia) ^ días.
export function computeFaltantes(db, hoy = new Date()) {
  const fin = lastSaleDate(db);
  if (!fin) return null;
  const finYMD = toYMD(fin);
  // El día en curso no cuenta como día sin venta.
  const ultimoCompleto = finYMD === toYMD(hoy) ? toYMD(new Date(fromYMD(finYMD).getTime() - DIA)) : finYMD;
  const desde = new Date(fromYMD(ultimoCompleto).getTime() - (VENTANA_FALTANTES + GAP_MAX + 30) * DIA);
  const fecha = fechasDeOrdenes(db);

  const abiertos = new Set();
  for (const d of fecha.values()) if (d >= desde) abiertos.add(toYMD(d));
  // Incluye el día en curso: una venta de hoy saca al artículo de la lista.
  const dias = [...abiertos].sort();
  const idx = new Map(dias.map((d, i) => [d, i]));
  const completos = dias.filter(d => d <= ultimoCompleto).length;

  const porArticulo = new Map(); // id → { dias: Set de índices, venta: Map índice → $ }
  for (const ol of db.orderLines) {
    if (!esArticulo(ol)) continue;
    const d = fecha.get(ol.orderId);
    if (!d || d < desde) continue;
    const i = idx.get(toYMD(d));
    if (i === undefined) continue;
    let a = porArticulo.get(ol.productId);
    if (!a) { a = { venta: new Map() }; porArticulo.set(ol.productId, a); }
    a.venta.set(i, (a.venta.get(i) || 0) + ol.subtotal);
  }

  const filas = [];
  for (const [id, a] of porArticulo) {
    const ultimo = Math.max(...a.venta.keys());
    const gap = completos - 1 - ultimo;
    if (gap < 2 || gap > GAP_MAX) continue;
    // Días abiertos de la ventana que termina en su última venta.
    const limite = toYMD(new Date(fromYMD(dias[ultimo]).getTime() - VENTANA_FALTANTES * DIA));
    let primero = ultimo;
    while (primero > 0 && dias[primero - 1] > limite) primero--;
    const abiertosVentana = ultimo - primero + 1;
    if (abiertosVentana < 20) continue;
    let conVenta = 0, venta = 0;
    for (let i = primero; i <= ultimo; i++) if (a.venta.has(i)) { conVenta++; venta += a.venta.get(i); }
    const frecuencia = conVenta / abiertosVentana;
    if (frecuencia < FRECUENCIA_MIN) continue;
    const prob = (1 - frecuencia) ** gap;
    if (prob >= PROB_MAX) continue;
    filas.push({ id, name: nombreDe(db, id), frecuencia, gap, ultimaVenta: dias[ultimo], porDia: venta / abiertosVentana, prob });
  }
  filas.sort((a, b) => b.porDia - a.porDia);
  return { filas, hasta: ultimoCompleto };
}
