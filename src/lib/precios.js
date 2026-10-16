// ─── Consultor de precios ─────────────────────────────────────────────────────
// Funciones puras (sin React). El precio de lista sale de db.catalog (lista Minorista del POS);
// el último precio cobrado, de las ventas (subtotal / qty), como en la Góndola.

import { MAX_ORDEN_RAZONABLE } from "./metrics.js";

const TOLERANCIA_PRECIO = 0.01;   // ±1%: redondeo de los artículos por peso
const MAX_RESULTADOS = 40;

// Sin tildes, en mayúsculas y con un solo espacio: "Café  La Virginia" → "CAFE LA VIRGINIA".
export function normalizar(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9Ñ]+/g, " ").trim();
}

// Última venta de cada artículo: { fecha, precio }.
function ultimasVentas(db) {
  const fecha = new Map();
  for (const o of db.orders) if (o.total <= MAX_ORDEN_RAZONABLE) fecha.set(o.id, o.saleDate);
  const ultima = new Map();
  for (const ol of db.orderLines) {
    if (!ol.productId || ol.qty <= 0) continue;
    const f = fecha.get(ol.orderId); if (!f) continue;
    const u = ultima.get(ol.productId);
    if (!u || f >= u.fecha) ultima.set(ol.productId, { fecha: f, precio: Math.round((ol.subtotal / ol.qty) * 100) / 100 });
  }
  return ultima;
}

// Índice para buscar. null si la foto no trae el catálogo (publicada con una versión anterior).
export function armarIndice(db) {
  if (!db.catalog) return null;
  const ultima = ultimasVentas(db);
  const items = db.catalog.map(c => {
    const name = db.products[c.productId] || `Prod.${c.productId}`;
    const venta = ultima.get(c.productId) || null;
    // Se cobró distinto: la última venta es posterior al último cambio de precio y no coincide.
    const distinto = !!(venta && c.price > 0 && c.priceDate && venta.fecha >= c.priceDate
      && Math.abs(venta.precio - c.price) / c.price > TOLERANCIA_PRECIO);
    return {
      id: c.productId, name, norm: normalizar(name), barcode: c.barcode,
      categoria: c.categoryId != null ? db.categories[c.categoryId] || null : null,
      precio: c.price, desde: c.priceDate, venta, distinto,
    };
  });
  const porCodigo = new Map();
  for (const it of items) if (it.barcode) porCodigo.set(it.barcode, it);
  return { items, porCodigo };
}

// Busca por código de barras (exacto o parte, si son solo números) o por palabras del nombre
// en cualquier orden ("coca 600" encuentra "GASEOSA COCA COLA ZERO BOTELLA 600 ML").
// Devuelve { exacto, filas, total }: `exacto` es el artículo con ese código, si lo hay.
export function buscar(indice, consulta) {
  const q = consulta.trim();
  if (!q) return { exacto: null, filas: [], total: 0 };
  const exacto = indice.porCodigo.get(q) || null;
  let filas;
  if (/^\d{4,}$/.test(q)) {
    filas = indice.items.filter(it => it.barcode.includes(q) || it.norm.includes(q));
  } else {
    const palabras = normalizar(q).split(" ").filter(Boolean);
    if (!palabras.length) return { exacto: null, filas: [], total: 0 };
    filas = indice.items.filter(it => palabras.every(p => it.norm.includes(p)));
    // Primero los que empiezan con la primera palabra; después, los que se vendieron más cerca.
    const primera = palabras[0];
    filas.sort((a, b) => (b.norm.startsWith(primera) - a.norm.startsWith(primera))
      || ((b.venta?.fecha ?? 0) - (a.venta?.fecha ?? 0)));
  }
  if (exacto) filas = filas.filter(it => it !== exacto);
  return { exacto, filas: filas.slice(0, MAX_RESULTADOS), total: filas.length };
}
