// ─── Parser HSQLDB ────────────────────────────────────────────────────────────
export function parseHSQLScript(text) {
  text = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const lines = text.split(/\r?\n/);
  const OC = { ORDER_ID: 0, SALE_DATE: 38, STATUS: 40, TOTAL: 45, CASHIER_ID: 46 };
  const LC = { PRICE: 6, QTY: 8, CATEGORY_ID: 10, ORDER_ID: 11, PRODUCT_ID: 12 };
  function parseValues(line) { const m = line.match(/VALUES\((.+)\)$/s); if (!m) return null; const raw = m[1]; const vals = []; let cur = "", inStr = false, i = 0; while (i < raw.length) { const ch = raw[i]; if (ch === "'" && !inStr) { inStr = true; i++; continue; } if (ch === "'" && inStr) { if (raw[i + 1] === "'") { cur += "'"; i += 2; continue; } inStr = false; i++; continue; } if (ch === "," && !inStr) { vals.push(cur); cur = ""; i++; continue; } cur += ch; i++; } vals.push(cur); return vals; }
  function num(v) { if (!v || v === "NULL") return 0; return parseFloat(v.replace(/E0$/, "")) || 0; }
  function parseTS(v) { if (!v || v === "NULL") return null; return new Date(v.replace(/\.\d+$/, "").replace(" ", "T")); }
  const orders = [], orderLines = [], orderPayments = [], employees = {}, categories = {}, products = {}, paymentTypes = {}, cashOperations = [];
  for (const line of lines) {
    if (line.startsWith("INSERT INTO FVPOS_ORDER VALUES")) {
      const v = parseValues(line); if (!v) continue;
      if (v[OC.STATUS] !== "COMPLETED") continue;
      const saleDate = parseTS(v[OC.SALE_DATE]); if (!saleDate) continue;
      orders.push({ id: num(v[OC.ORDER_ID]), saleDate, total: num(v[OC.TOTAL]), cashierId: num(v[OC.CASHIER_ID]) });
    } else if (line.startsWith("INSERT INTO FVPOS_ORDER_LINE VALUES")) {
      const v = parseValues(line); if (!v) continue;
      orderLines.push({ orderId: num(v[LC.ORDER_ID]), categoryId: v[LC.CATEGORY_ID] === "NULL" ? null : num(v[LC.CATEGORY_ID]), subtotal: num(v[LC.PRICE]) * num(v[LC.QTY]), qty: num(v[LC.QTY]), productId: v[LC.PRODUCT_ID] === "NULL" ? null : num(v[LC.PRODUCT_ID]), description: v[2] || "" });
    } else if (line.startsWith("INSERT INTO FVPOS_EMPLOYEE VALUES")) {
      const v = parseValues(line); if (!v) continue;
      const id = num(v[0]);
      const name = [v[32] || "", v[34] || ""].join(" ").trim() || (v[45] || "").trim() || `Cajero ${id}`;
      employees[id] = name;
    } else if (line.startsWith("INSERT INTO FVPOS_PRODUCT_CATEGORY VALUES")) {
      const v = parseValues(line); if (!v) continue;
      categories[num(v[0])] = v[2] || `Cat.${v[0]}`;
    } else if (line.startsWith("INSERT INTO FVPOS_PRODUCT VALUES")) {
      const v = parseValues(line); if (!v) continue;
      products[num(v[0])] = v[6] || `Prod.${v[0]}`;

    // ── Formas de pago ────────────────────────────────────────────────────────
    // FVPOS_PAYMENT_TYPE: tabla maestra de medios de pago.
    // Columna 0 = id (numérico), columna 2 = nombre visible.
    // Si en tus datos el nombre está en otra columna, ajustá el índice aquí.
    } else if (line.startsWith("INSERT INTO FVPOS_PAYMENT_TYPE VALUES")) {
      const v = parseValues(line); if (!v) continue;
      const id = num(v[0]);
      const name = v[2] || v[1] || `Pago ${id}`;
      paymentTypes[id] = name;


//FVPOS_CASH_OPERATION es la tabla donde estan todas las operaciones de caja, apertura, cierre, venta.
// Columna 0 = id propio, columna 1 = OPERATION_TYPE_ID, columna 2 = OPERATION_DATE, columna 3 = OPERATION_AMOUNT, columna 4 = OPERATION_NOTES. En el caso de las ventas, el OPERATION_AMOUNT es el total de la venta.    
// OPERATION_TYPE_ID es el tipo de operación: 1 = APERTURA, 2 = CIERRE, 3 = VENTA.
// OPERATION_DATE es la fecha y hora de la operación.
// OPERATION_AMOUNT es el monto de la operación.
// OPERATION_NOTES son las notas de la operación.

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

} else if (line.startsWith("INSERT INTO FVPOS_CASH_OPERATION VALUES")) {
  const v = parseValues(line); if (!v) continue;
  const id = num(v[0]);
  const operationTypeId = num(v[1]);
  const operationDate = parseTS(v[2]);
  const operationAmount = num(v[3]);
  const operationNotes = v[4] || "";
  cashOperations.push({ id, operationTypeId, operationDate, operationAmount, operationNotes });
}
  }
  return { orders, orderLines, orderPayments, employees, categories, products, paymentTypes, cashOperations };
}
