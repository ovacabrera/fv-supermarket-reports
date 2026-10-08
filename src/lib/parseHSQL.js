// ─── Parser HSQLDB ────────────────────────────────────────────────────────────
export function parseHSQLScript(text) {
  text = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const lines = text.split(/\r?\n/);
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
  const orders = [], orderLines = [], orderPayments = [], employees = {}, categories = {}, products = {}, paymentTypes = {}, cashOperations = [];
  for (const p of PAY) paymentTypes[p.id] = p.name;
  for (const line of lines) {
    if (line.startsWith("INSERT INTO FVPOS_ORDER VALUES")) {
      const v = parseValues(line); if (!v) continue;
      if (v[OC.STATUS] !== "COMPLETED") continue;
      const saleDate = parseTS(v[OC.SALE_DATE]); if (!saleDate) continue;
      const orderId = num(v[OC.ORDER_ID]);
      orders.push({ id: orderId, saleDate, total: num(v[OC.TOTAL]), cashierId: num(v[OC.CASHIER_ID]) });
      for (const p of PAY) {
        const amount = num(v[p.col]); if (!amount) continue;
        const cardId = p.cardCol && v[p.cardCol] !== "NULL" ? num(v[p.cardCol]) : null;
        orderPayments.push({ orderId, paymentTypeId: cardId ? p.cardBase + cardId : p.id, amount });
      }
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

    // ── Tarjetas (nombres para las formas de pago) ───────────────────────────
    // FVPOS_CREDIT_CARD / FVPOS_DEBIT_CARD: 0 = CARD_ID, 1 = IS_ACTIVE, 2 = CARD_NAME.
    } else if (line.startsWith("INSERT INTO FVPOS_CREDIT_CARD VALUES")) {
      const v = parseValues(line); if (!v) continue;
      paymentTypes[100 + num(v[0])] = v[2] || `Crédito ${v[0]}`;
    } else if (line.startsWith("INSERT INTO FVPOS_DEBIT_CARD VALUES")) {
      const v = parseValues(line); if (!v) continue;
      paymentTypes[200 + num(v[0])] = v[2] || `Débito ${v[0]}`;


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

} else if (line.startsWith("INSERT INTO FVPOS_CASH_OPERATION VALUES")) {
  const v = parseValues(line); if (!v) continue;
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
  }
  return { orders, orderLines, orderPayments, employees, categories, products, paymentTypes, cashOperations };
}
