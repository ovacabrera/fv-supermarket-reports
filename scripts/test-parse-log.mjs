// Prueba del parser con un .log armado a mano (casos que el .log real de muestra no trae).
//
//   node scripts/test-parse-log.mjs

import assert from "assert/strict";
import { parseHSQL } from "../src/lib/parseHSQL.js";

// Orden con las columnas que usa el parser: 0 id, 27 efectivo, 38 fecha, 40 estado, 45 total, 46 cajero.
function order(id, total, date, status = "COMPLETED") {
  const v = new Array(51).fill("NULL");
  v[0] = id; v[27] = `${total}.0E0`; v[38] = `'${date}.000000'`; v[40] = `'${status}'`; v[45] = `${total}.0E0`; v[46] = 1;
  return `INSERT INTO FVPOS_ORDER VALUES(${v.join(",")})`;
}
const line = (id, orderId, price) => `INSERT INTO FVPOS_ORDER_LINE VALUES(${id},${price}.0E0,'','0',0.0E0,1,${price}.0E0,0.0E0,1.0E0,0.0E0,NULL,${orderId},NULL)`;
const product = (id, name) => `INSERT INTO FVPOS_PRODUCT VALUES(${id},'0',15,'22',0.0E0,'2020-08-15 13:11:03.705000','${name}')`;

const script = [
  "CREATE MEMORY TABLE PUBLIC.FVPOS_ORDER(ORDER_ID BIGINT NOT NULL PRIMARY KEY)",
  order(10, 100, "2026-10-14 10:00:00"),
  order(11, 200, "2026-10-14 11:00:00"),
  line(1, 10, 100),
  product(5, "Leche"),
].join("\n");

const log = [
  "/*C5*/SET SCHEMA PUBLIC",
  order(12, 300, "2026-10-15 09:00:00"),   // C5, sin prefijo: confirmada más abajo
  "/*C6*/SET SCHEMA PUBLIC",
  order(13, 999, "2026-10-15 09:05:00"),   // C6: se descarta con ROLLBACK
  "/*C5*/" + line(2, 12, 300),
  "COMMIT",                                // confirma la 12 y su línea (C5)
  "/*C6*/ROLLBACK",
  "DELETE FROM FVPOS_ORDER WHERE ORDER_ID=11",                  // modificación de la 11: DELETE + INSERT
  order(11, 250, "2026-10-14 11:00:00", "CANCELED"),
  "DELETE FROM FVPOS_PRODUCT WHERE PRODUCT_ID=5",
  product(5, "Leche entera"),
  "COMMIT",
  "/*C5*/" + order(14, 400, "2026-10-15 10:00:00"),           // sin COMMIT al final: no se aplica
  order(15, 500, "2026-10-15 10:01:00").slice(0, 40),         // última línea a medio escribir (sin salto): se ignora
].join("\r\n");

const info = {};
const db = parseHSQL({ script, log }, info);

assert.deepEqual(db.orders.map(o => o.id), [10, 12], "la 11 quedó anulada, la 13 se revirtió, la 14 sin COMMIT");
assert.equal(db.orders[1].total, 300);
assert.deepEqual(db.orderLines.map(l => l.orderId), [10, 12]);
assert.equal(db.products[5], "Leche entera");
assert.equal(info.log.commits, 2);
assert.equal(info.log.rollbacks, 1);
assert.equal(info.log.uncommitted, 1);
assert.equal(info.log.partialLine, true);
assert.deepEqual(info.warnings, []);

// Una fila modificada vuelve a su lugar por PK (como en el .script).
const db2 = parseHSQL({ script, log: ["DELETE FROM FVPOS_ORDER WHERE ORDER_ID=10", order(10, 150, "2026-10-14 10:00:00"), "COMMIT", ""].join("\r\n") });
assert.deepEqual(db2.orders.map(o => [o.id, o.total]), [[10, 150], [11, 200]]);

// Sin .log da lo mismo que antes.
assert.deepEqual(parseHSQL({ script }).orders.map(o => o.id), [10, 11]);

console.log("✓ parser con .log: todos los casos pasan");
