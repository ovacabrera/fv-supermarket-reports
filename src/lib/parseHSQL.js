// ─── Parser HSQLDB ────────────────────────────────────────────────────────────
// Las tablas del POS son MEMORY: todos los datos están en dos archivos.
//   fvposdb.script  el estado completo en el último checkpoint (FácilVirtual lo hace al arrancar).
//   fvposdb.log     lo que pasó después, en orden. Formato (verificado con un .log real):
//     - una sentencia por línea (CRLF); un UPDATE se escribe como DELETE + INSERT de la fila;
//     - DELETE FROM <tabla> WHERE <pk>=<valor>;
//     - prefijo /*Cn*/ solo cuando cambia la sesión: las líneas sin prefijo son de la última nombrada;
//     - COMMIT explícito al final de cada transacción.
//
// Se arma en tres capas:
//   1. sentencias → filas crudas por tabla, indexadas por PK (la primera columna en todas las tablas usadas);
//   2. el .log se aplica sobre esas filas, solo lo confirmado con COMMIT;
//   3. las filas finales → orders, orderLines, orderPayments, etc.

// Tablas que usa el reporte. En todas, la primera columna es la PK.
const TABLES = ["FVPOS_ORDER", "FVPOS_ORDER_LINE", "FVPOS_EMPLOYEE", "FVPOS_PRODUCT_CATEGORY", "FVPOS_PRODUCT", "FVPOS_PRODUCT_PRICE", "FVPOS_CREDIT_CARD", "FVPOS_DEBIT_CARD", "FVPOS_CASH_OPERATION"];

const decodeUnicode = text => text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// ── Capa 1: sentencias ────────────────────────────────────────────────────────
// Devuelve { op, table, key, line } o null si la sentencia no interesa (SET SCHEMA, CREATE, otras tablas…).
function parseStatement(line) {
  if (line.startsWith("INSERT INTO ")) {
    const p = line.indexOf(" VALUES(", 12); if (p === -1) return null;
    const table = line.slice(12, p);
    const start = p + 8, end = line.indexOf(",", start);
    return { op: "insert", table, key: line.slice(start, end === -1 ? -1 : end), line };
  }
  if (line.startsWith("DELETE FROM ")) {
    const m = line.match(/^DELETE FROM (\w+) WHERE (\w+)=(.+)$/); if (!m) return { op: "delete", table: line.slice(12).split(" ")[0], key: null, line };
    // Sin PK la condición trae todas las columnas (… AND …): no se usa en las tablas del reporte.
    return { op: "delete", table: m[1], key: m[3].includes(" AND ") ? null : m[3], line };
  }
  if (line === "COMMIT") return { op: "commit" };
  if (line.startsWith("ROLLBACK")) return { op: "rollback", savepoint: line.includes("SAVEPOINT") };
  return null;
}

function newStore() {
  const store = {};
  for (const t of TABLES) store[t] = { rows: new Map(), max: -Infinity, unordered: false };
  return store;
}

// Aplica una sentencia sobre las filas. Las desconocidas se cuentan en info.warnings.
function apply(store, st, info) {
  const t = store[st.table]; if (!t) return;
  if (st.op === "delete") {
    if (st.key === null) { info.warnings.push(`DELETE sin PK, no aplicado: ${st.line.slice(0, 120)}`); return; }
    t.rows.delete(st.key);
    return;
  }
  const k = Number(st.key);
  if (!t.rows.has(st.key) && k < t.max) t.unordered = true; // fila modificada o insertada fuera de orden
  if (k > t.max) t.max = k;
  t.rows.set(st.key, st.line);
}

// El .script no tiene transacciones: todo lo que trae está confirmado.
function applyScript(store, text, info) {
  for (const line of text.split(/\r?\n/)) {
    const st = parseStatement(line);
    if (st && (st.op === "insert" || st.op === "delete")) apply(store, st, info);
  }
}

// ── Capa 2: el .log, por sesión y solo lo confirmado ─────────────────────────
function applyLog(store, text, info) {
  const lines = text.split(/\r?\n/);
  // Si no termina en salto de línea, la última sentencia puede estar a medio escribir.
  if (lines[lines.length - 1] === "") lines.pop();
  else { lines.pop(); info.log.partialLine = true; }
  const pending = new Map();
  let session = null;
  for (let line of lines) {
    const m = line.match(/^\/\*C(\d+)\*\//);
    if (m) { session = m[1]; line = line.slice(m[0].length); }
    const st = parseStatement(line); if (!st) continue;
    if (st.op === "commit") {
      for (const s of pending.get(session) || []) apply(store, s, info);
      pending.delete(session);
      info.log.commits++;
    } else if (st.op === "rollback") {
      if (st.savepoint) info.warnings.push(`ROLLBACK a savepoint no soportado (sesión C${session}): se descarta la transacción entera`);
      pending.delete(session);
      info.log.rollbacks++;
    } else if (store[st.table]) {
      if (!pending.has(session)) pending.set(session, []);
      pending.get(session).push(st);
      info.log.statements++;
    }
  }
  for (const list of pending.values()) info.log.uncommitted += list.length;
}

// Filas finales de una tabla, en orden de PK (como en el .script).
function rowsOf(store, table) {
  const t = store[table];
  if (!t.unordered) return t.rows.values();
  return [...t.rows.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(e => e[1]);
}

// ── API ───────────────────────────────────────────────────────────────────────
// parseHSQL({ script, log }, info?) → db. `log` es opcional. Si se pasa `info`, se completa con
// lo que se aplicó del .log y las advertencias (DELETE sin PK, líneas cortadas, sin COMMIT).
export function parseHSQL({ script, log = null }, info = {}) {
  info.warnings = [];
  info.log = log === null ? null : { statements: 0, commits: 0, rollbacks: 0, uncommitted: 0, partialLine: false };
  const store = newStore();
  applyScript(store, decodeUnicode(script), info);
  if (log !== null) applyLog(store, decodeUnicode(log), info);
  return buildDb(store);
}

// Compatibilidad: solo el .script.
export function parseHSQLScript(text) {
  return parseHSQL({ script: text });
}

// ── Capa 3: filas → datos del reporte ────────────────────────────────────────
function buildDb(store) {
  const OC = { ORDER_ID: 0, SALE_DATE: 38, STATUS: 40, TOTAL: 45, CASHIER_ID: 46 };
  const LC = { PRICE: 6, QTY: 8, CATEGORY_ID: 10, ORDER_ID: 11, PRODUCT_ID: 12 };

  // ── Formas de pago ──────────────────────────────────────────────────────────
  // La BD no tiene tabla de pagos: cada FVPOS_ORDER trae una columna por medio.
  // Se usan las PAYMENT_NET_*_AMT (lo aplicado a la venta). Las PAYMENT_*_AMT sin NET
  // son lo entregado por el cliente e incluyen el vuelto (ej. total 461, efectivo 500).
  // Tarjetas: CREDIT_CARD_ID (48) → FVPOS_CREDIT_CARD, DEBIT_CARD_ID (50) → FVPOS_DEBIT_CARD.
  // Ids de paymentTypes: 1–6 medios fijos; 100+id tarjetas de crédito; 200+id de débito.
  const PAY = [
    { col: 27, id: 1, name: "Efectivo" },
    { col: 29, id: 2, name: "Tarjeta de crédito", cardCol: 48, cardBase: 100 },
    { col: 30, id: 3, name: "Tarjeta de débito", cardCol: 50, cardBase: 200 },
    { col: 31, id: 4, name: "Cuenta corriente" },
    { col: 28, id: 5, name: "Cheque" },
    { col: 32, id: 6, name: "Tickets" },
  ];
  function parseValues(line) { const m = line.match(/VALUES\((.+)\)$/s); if (!m) return null; const raw = m[1]; const vals = []; let cur = "", inStr = false, i = 0; while (i < raw.length) { const ch = raw[i]; if (ch === "'" && !inStr) { inStr = true; i++; continue; } if (ch === "'" && inStr) { if (raw[i + 1] === "'") { cur += "'"; i += 2; continue; } inStr = false; i++; continue; } if (ch === "," && !inStr) { vals.push(cur); cur = ""; i++; continue; } cur += ch; i++; } vals.push(cur); return vals; }
  function num(v) { if (!v || v === "NULL") return 0; return parseFloat(v.replace(/E0$/, "")) || 0; }
  function parseTS(v) { if (!v || v === "NULL") return null; return new Date(v.replace(/\.\d+$/, "").replace(" ", "T")); }
  function* valuesOf(table) { for (const line of rowsOf(store, table)) { const v = parseValues(line); if (v) yield v; } }

  const orders = [], orderLines = [], orderPayments = [], employees = {}, categories = {}, products = {}, paymentTypes = {}, cashOperations = [], catalog = [];
  for (const p of PAY) paymentTypes[p.id] = p.name;

  for (const v of valuesOf("FVPOS_ORDER")) {
    if (v[OC.STATUS] !== "COMPLETED") continue;
    const saleDate = parseTS(v[OC.SALE_DATE]); if (!saleDate) continue;
    const orderId = num(v[OC.ORDER_ID]);
    orders.push({ id: orderId, saleDate, total: num(v[OC.TOTAL]), cashierId: num(v[OC.CASHIER_ID]) });
    for (const p of PAY) {
      const amount = num(v[p.col]); if (!amount) continue;
      const cardId = p.cardCol && v[p.cardCol] !== "NULL" ? num(v[p.cardCol]) : null;
      orderPayments.push({ orderId, paymentTypeId: cardId ? p.cardBase + cardId : p.id, amount });
    }
  }
  for (const v of valuesOf("FVPOS_ORDER_LINE")) {
    orderLines.push({ orderId: num(v[LC.ORDER_ID]), categoryId: v[LC.CATEGORY_ID] === "NULL" ? null : num(v[LC.CATEGORY_ID]), subtotal: num(v[LC.PRICE]) * num(v[LC.QTY]), qty: num(v[LC.QTY]), productId: v[LC.PRODUCT_ID] === "NULL" ? null : num(v[LC.PRODUCT_ID]), description: v[2] || "" });
  }
  for (const v of valuesOf("FVPOS_EMPLOYEE")) {
    const id = num(v[0]);
    const name = [v[32] || "", v[34] || ""].join(" ").trim() || (v[45] || "").trim() || `Cajero ${id}`;
    employees[id] = name;
  }
  for (const v of valuesOf("FVPOS_PRODUCT_CATEGORY")) categories[num(v[0])] = v[2] || `Cat.${v[0]}`;

  // ── Productos y catálogo (consultor de precios) ──────────────────────────────
  // FVPOS_PRODUCT.SELLING_PRICE está siempre en 0: el precio de venta está en FVPOS_PRODUCT_PRICE,
  // una fila por artículo y lista. 0 = PRICE_ID, 4 = LAST_UPDATED_PRICE, 8 = SELLING_PRICE,
  // 9 = PRICE_LIST_ID (1 = Minorista), 10 = PRODUCT_ID. PREVIOUS_SELLING_PRICE (6) viene siempre en 0.
  const PRICE_LIST_MINORISTA = 1;
  const precios = new Map();
  for (const v of valuesOf("FVPOS_PRODUCT_PRICE")) {
    if (num(v[9]) !== PRICE_LIST_MINORISTA) continue;
    const id = num(v[10]), date = parseTS(v[4]);
    const prev = precios.get(id);
    if (prev && prev.date && (!date || date < prev.date)) continue; // si hay dos, la más nueva
    precios.set(id, { price: num(v[8]), date });
  }
  // FVPOS_PRODUCT: 3 = BAR_CODE, 6 = PRODUCT_DESCRIPTION, 7 = IS_DISCONTINUED, 37 = CATEGORY_ID.
  // `products` tiene todos (las ventas viejas los nombran); el catálogo, solo los que no están dados de baja.
  for (const v of valuesOf("FVPOS_PRODUCT")) {
    const id = num(v[0]);
    products[id] = v[6] || `Prod.${v[0]}`;
    if (v[7] === "1") continue;
    const p = precios.get(id);
    catalog.push({
      productId: id, barcode: v[3] || "", categoryId: v[37] && v[37] !== "NULL" ? num(v[37]) : null,
      price: p ? p.price : 0, priceDate: p ? p.date : null,
    });
  }

  // ── Tarjetas (nombres para las formas de pago) ─────────────────────────────
  // FVPOS_CREDIT_CARD / FVPOS_DEBIT_CARD: 0 = CARD_ID, 1 = IS_ACTIVE, 2 = CARD_NAME.
  for (const v of valuesOf("FVPOS_CREDIT_CARD")) paymentTypes[100 + num(v[0])] = v[2] || `Crédito ${v[0]}`;
  for (const v of valuesOf("FVPOS_DEBIT_CARD")) paymentTypes[200 + num(v[0])] = v[2] || `Débito ${v[0]}`;

//FVPOS_CASH_OPERATION es la tabla donde estan todas las operaciones de caja, apertura, cierre, venta.
// Columnas (según el CREATE TABLE): 0 = CASH_OPERATION_ID, 1 = IS_ACTIVE, 2 = AMOUNT, 3 = CASH_NUMBER,
// 4 = CREATION_DATE, 5 = DESCRIPTION, 6 = LAST_UPDATED_DATE, 7 = OBSERVATIONS, 8 = OPERATION_DATE,
// 9 = IS_SYSTEM, 10 = TYPE, 11 = AUTHOR_ID, 12 = CUSTOMER_OPERATION_ID, 13 = ORDER_ID, 14 = PURCHASE_ID, 15 = SUPPLIER_OPERATION_ID.
// TYPE (operationTypeId), según los datos: 1 = ingreso (Venta, Caja inicial, Cobro a cliente),
// 2 = egreso (Retiro de dinero), 3 = evento sin monto (Apertura de caja, Cierre de caja).
// En las ventas AMOUNT es el monto que entró a caja y ORDER_ID apunta a la orden.
// DESCRIPTION (operationNotes) es el texto de la operación: "Venta", "Retiro de dinero", etc.

//FVPOS_CREDIT_CARD es la tabla donde estan todas las tarjetas de credito, mercadopago, etc.
// Columna 0 = id propio, columna 1 = CREDIT_CARD_TYPE_ID, columna 2 = CREDIT_CARD_NUMBER, columna 3 = CREDIT_CARD_EXPIRATION_DATE, columna 4 = CREDIT_CARD_CVV, columna 5 = CREDIT_CARD_HOLDER_NAME, columna 6 = CREDIT_CARD_HOLDER_EMAIL, columna 7 = CREDIT_CARD_HOLDER_PHONE.
// CREDIT_CARD_TYPE_ID es el tipo de tarjeta: 1 = VISA, 2 = MASTERCARD, 3 = AMERICAN_EXPRESS, 4 = DINERS, 5 = DISCOVER, 6 = JCB, 7 = UNIONPAY, 8 = MAESTRO, 9 = RUPAY, 10 = OTHER.
// CREDIT_CARD_NUMBER es el numero de tarjeta.
// CREDIT_CARD_EXPIRATION_DATE es la fecha de expiracion de la tarjeta.
// CREDIT_CARD_CVV es el codigo de seguridad de la tarjeta.
// CREDIT_CARD_HOLDER_NAME es el nombre del titular de la tarjeta.
// CREDIT_CARD_HOLDER_EMAIL es el email del titular de la tarjeta.

//FVPOS_DEBIT_CARD es la tabla donde estan todas las tarjetas de débito.
//FVPOS_ORDER es la tabla que tiene referencia al FK CREDIT_CARD_ID o DEBIT_CARD_ID, esto debe no generar ingreso de caja entonces, por un lado tenemos que buscar las ordenes que tienen FVPOS_CASH_OPERATION relacionada y por otro lado las ordenes con tarjetas o cuentas corrientes.

  for (const v of valuesOf("FVPOS_CASH_OPERATION")) {
    const id = num(v[0]);
    const isActive = v[1] === "1";
    const operationAmount = num(v[2]);
    const cashNumber = num(v[3]);
    const operationNotes = v[5] || "";
    const operationDate = parseTS(v[8]);
    const operationTypeId = num(v[10]);
    const orderId = v[13] === "NULL" ? null : num(v[13]);
    cashOperations.push({ id, operationTypeId, operationDate, operationAmount, operationNotes, cashNumber, orderId, isActive });
  }
  return { orders, orderLines, orderPayments, employees, categories, products, paymentTypes, cashOperations, catalog };
}
