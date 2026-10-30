// ─── Lista de precios pública ─────────────────────────────────────────────────
// Lo único que baja el consultor de precios abierto a los clientes (ver PLAN-PRECIOS-PUBLICO.md).
// Va a un KV y un sitio aparte: nunca la foto de ventas.
//
// `venta` es el día de la última venta ("YYYY-MM-DD", sin el precio cobrado): el sitio la usa para no
// mostrar en la búsqueda por nombre artículos que no se venden hace mucho (y quizás tienen precio viejo).
//
// Los campos se eligen uno por uno: si el parser agrega algo al catálogo, acá no aparece solo.
// validarPreciosPublicos() lo vuelve a comprobar antes de subir.

import { ultimasVentas } from "./precios.js";
import { toYMD } from "./dates.js";

export const PRECIOS_VERSION = 1;

const CAMPOS = ["codigo", "nombre", "precio", "rubro", "venta"];
const CAMPOS_RAIZ = ["version", "generatedAt", "items"];
// La lista mide ~1 MB sin comprimir (~9.400 artículos). Mucho más es señal de que entró algo que no va.
const MAX_BYTES = 4 * 1024 * 1024;

// Artículos activos con precio de la lista Minorista: { codigo, nombre, precio, rubro, venta }.
export function armarPreciosPublicos(db, generatedAt) {
  const ultima = ultimasVentas(db);
  const items = (db.catalog || [])
    .filter(c => c.price > 0)
    .map(c => ({
      codigo: c.barcode || "",
      nombre: db.products[c.productId] || `Prod.${c.productId}`,
      precio: Math.round(c.price * 100) / 100,
      rubro: c.categoryId != null ? db.categories[c.categoryId] || null : null,
      venta: ultima.has(c.productId) ? toYMD(ultima.get(c.productId).fecha) : null,
    }));
  return { version: PRECIOS_VERSION, generatedAt, items };
}

// Devuelve la lista de problemas (vacía si está bien). `json` es el texto que se va a publicar.
export function validarPreciosPublicos(json) {
  const errores = [];
  if (json.length > MAX_BYTES) errores.push(`mide ${(json.length / 1e6).toFixed(1)} MB (máximo ${MAX_BYTES / 1e6} MB)`);
  let lista;
  try { lista = JSON.parse(json); } catch (e) { return [...errores, `no es JSON (${e.message})`]; }
  const extra = Object.keys(lista).filter(k => !CAMPOS_RAIZ.includes(k));
  if (extra.length) errores.push(`trae campos que no van: ${extra.join(", ")}`);
  if (!Array.isArray(lista.items) || lista.items.length === 0) return [...errores, "no trae artículos"];
  const raros = new Set();
  for (const it of lista.items) for (const k of Object.keys(it)) if (!CAMPOS.includes(k)) raros.add(k);
  if (raros.size) errores.push(`los artículos traen campos que no van: ${[...raros].join(", ")}`);
  return errores;
}
