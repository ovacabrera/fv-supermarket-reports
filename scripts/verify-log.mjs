// Verifica la lectura del .log contra el .script que deja el checkpoint siguiente.
//
//   node scripts/verify-log.mjs <A: .script con su .log al lado> <B: .script posterior al checkpoint>
//
// A: copia hecha durante el día (fvposdb.script + fvposdb.log).
// B: fvposdb.script copiado después del siguiente arranque del POS (el checkpoint ya pasó el .log al .script).
// Todo lo vendido hasta la copia A tiene que dar igual en los dos: órdenes, líneas, pagos y caja.
// B puede tener más filas (lo vendido después de A): esas no se comparan.

import path from "path";
import { isDeepStrictEqual } from "util";
import { parseHSQL } from "../src/lib/parseHSQL.js";
import { readPosDb } from "../server/src/readPosDb.mjs";

const [aPath, bPath] = process.argv.slice(2).map(p => path.resolve(p));
if (!aPath || !bPath) {
  console.error("Uso: node scripts/verify-log.mjs <A.script (+ .log)> <B.script>");
  process.exit(1);
}

const A = readPosDb(aPath);
if (!A.log) { console.error(`✗ No hay .log al lado de ${aPath}`); process.exit(1); }
const infoA = {};
const a = parseHSQL({ script: A.script, log: A.log }, infoA);
const b = parseHSQL({ script: readPosDb(bPath, { log: false }).script });

const maxId = rows => rows.reduce((m, r) => (r.id > m ? r.id : m), -Infinity);
const lastA = maxId(a.orders);
console.log(`A: ${a.orders.length} órdenes (última ${lastA}), .log con ${infoA.log.statements} sentencias y ${infoA.log.uncommitted} sin confirmar`);
console.log(`B: ${b.orders.length} órdenes (última ${maxId(b.orders)})`);
for (const w of infoA.warnings) console.warn(`⚠ ${w}`);

// Filas comparables: las de órdenes hasta la última de A. Caja: hasta la última operación de A.
const lastCashA = maxId(a.cashOperations);
const pick = db => ({
  orders: db.orders.filter(o => o.id <= lastA),
  orderLines: db.orderLines.filter(l => l.orderId <= lastA),
  orderPayments: db.orderPayments.filter(p => p.orderId <= lastA),
  cashOperations: db.cashOperations.filter(c => c.id <= lastCashA),
});
const pa = pick(a), pb = pick(b);

let errors = 0;
for (const table of Object.keys(pa)) {
  const key = r => JSON.stringify(r);
  const sa = new Set(pa[table].map(key)), sb = new Set(pb[table].map(key));
  const onlyA = pa[table].filter(r => !sb.has(key(r))), onlyB = pb[table].filter(r => !sa.has(key(r)));
  const ok = onlyA.length === 0 && onlyB.length === 0;
  console.log(`${ok ? "✓" : "✗"} ${table.padEnd(15)} A ${pa[table].length} · B ${pb[table].length}${ok ? "" : ` · solo en A ${onlyA.length} · solo en B ${onlyB.length}`}`);
  for (const r of [...onlyA.slice(0, 3).map(r => ["A", r]), ...onlyB.slice(0, 3).map(r => ["B", r])]) console.log(`    solo en ${r[0]}: ${key(r[1])}`);
  if (!ok) errors++;
}
const total = rows => rows.reduce((s, o) => s + o.total, 0);
console.log(`Total vendido hasta la orden ${lastA}: A $${total(pa.orders).toLocaleString("es-AR")} · B $${total(pb.orders).toLocaleString("es-AR")}`);
// Productos y tarjetas: el nombre vigente al momento de A tiene que estar en B (salvo que se haya editado después).
const changed = Object.keys(a.products).filter(id => !isDeepStrictEqual(a.products[id], b.products[id]));
if (changed.length) console.log(`ℹ ${changed.length} productos con nombre distinto en B (pueden haberse editado después de A)`);

console.log(errors ? `✗ ${errors} tablas con diferencias` : "✓ El .log reproduce el checkpoint");
process.exit(errors ? 1 : 0);
