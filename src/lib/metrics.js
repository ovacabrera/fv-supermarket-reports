// ─── Cálculos de los reportes ─────────────────────────────────────────────────
// Funciones puras (sin React): reciben `db` (salida de parseHSQLScript o del snapshot)
// y devuelven los datos que muestran las páginas.

import { DIAS_CORTO, DIAS_LARGO, MESES_CORTO, toYMD, fromYMD } from "./dates.js";
import { ipcDe, acumuladoFactor } from "./ipc.js";

// Producto genérico que usa la fiambrería para cobrar por ticket: se muestra como rubro propio
// y no cuenta como "artículo" en los rankings.
const FIAMBR_PROD_ID = 25912;
// Órdenes con totales absurdos (códigos de barras cargados como cantidad) que se excluyen
// de los resúmenes mensuales y anuales.
const MAX_ORDEN_RAZONABLE = 10_000_000;

function median(sorted) {
  if (!sorted.length) return 0;
  return sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
}

// Órdenes dentro del rango de días y de la franja horaria.
export function filterOrders(db, { dateFrom, dateTo, timeFrom, timeTo }) {
  const [fH, fM] = timeFrom.split(":").map(Number);
  const [tH, tM] = timeTo.split(":").map(Number);
  const fromMs = new Date(dateFrom + "T00:00:00").getTime();
  const toMs = new Date(dateTo + "T23:59:59").getTime();
  return db.orders.filter(o => {
    const t = o.saleDate.getTime();
    if (t < fromMs || t > toMs) return false;
    const mins = o.saleDate.getHours() * 60 + o.saleDate.getMinutes();
    return mins >= fH * 60 + fM && mins <= tH * 60 + tM;
  });
}

export function lastSaleDate(db) {
  let max = null;
  for (const o of db.orders) if (!max || o.saleDate > max) max = o.saleDate;
  return max;
}

// Orden fijo de colores para los medios de pago: por importe histórico total, así un medio
// conserva su color en cualquier período. Los que no entran en los primeros 3 van a "Otros".
export function paymentRanking(db) {
  const tot = {};
  for (const p of db.orderPayments || []) tot[p.paymentTypeId] = (tot[p.paymentTypeId] || 0) + p.amount;
  return Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([id]) => paymentName(db, Number(id)));
}

function paymentName(db, id) {
  // Si no está registrado (paymentTypeId=0 o sin nombre), usamos "Sin especificar".
  return (id && db.paymentTypes[id]) ? db.paymentTypes[id] : (id ? `Medio ${id}` : "Sin especificar");
}

// Métricas del período filtrado.
export function computeMetrics(db, filtered, dateFrom, dateTo) {
  const totalVentas = filtered.reduce((s, o) => s + o.total, 0);
  const cantOps = filtered.length;
  const ticketProm = cantOps ? totalVentas / cantOps : 0;
  const singleDay = dateFrom === dateTo;
  const filteredIds = new Set(filtered.map(o => o.id));
  const totalUnidades = Math.round(db.orderLines.reduce((s, ol) => filteredIds.has(ol.orderId) ? s + ol.qty : s, 0));

  let timeData;
  if (singleDay) {
    const byHour = {};
    filtered.forEach(o => { const h = o.saleDate.getHours(); byHour[h] = (byHour[h] || 0) + o.total; });
    timeData = Array.from({ length: 24 }, (_, i) => ({ label: `${String(i).padStart(2, "0")}h`, ventas: Math.round(byHour[i] || 0) })).filter(d => d.ventas > 0);
  } else {
    const byDay = {};
    filtered.forEach(o => { const d = toYMD(o.saleDate); byDay[d] = (byDay[d] || 0) + o.total; });
    timeData = Object.entries(byDay).sort().map(([d, v]) => { const dt = fromYMD(d); return { label: `${DIAS_CORTO[dt.getDay()]} ${dt.getDate()}`, ventas: Math.round(v) }; });
  }

  const byEmp = {};
  filtered.forEach(o => { const name = db.employees[o.cashierId] || `Cajero ${o.cashierId}`; byEmp[name] = (byEmp[name] || 0) + o.total; });
  const empData = Object.entries(byEmp).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);

  const byCat = {};
  db.orderLines.forEach(ol => {
    if (!filteredIds.has(ol.orderId)) return;
    let cat;
    if (ol.productId === FIAMBR_PROD_ID) { cat = "Fiambrería Ticket"; }
    else { cat = ol.categoryId ? (db.categories[ol.categoryId] || "Sin categoría") : "Sin categoría"; }
    byCat[cat] = (byCat[cat] || 0) + ol.subtotal;
  });
  const catData = Object.entries(byCat).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 15);

  const byProd = {};
  db.orderLines.forEach(ol => {
    if (!filteredIds.has(ol.orderId)) return;
    if (!ol.productId || ol.productId === 0) return;
    if (ol.productId === FIAMBR_PROD_ID) return;
    const nombre = db.products[ol.productId] || `Prod.${ol.productId}`;
    if (!byProd[nombre]) byProd[nombre] = { qty: 0, total: 0, txCount: 0 };
    byProd[nombre].qty += ol.qty;
    byProd[nombre].total += ol.subtotal;
    byProd[nombre].txCount += 1;
  });
  const top10 = Object.entries(byProd).map(([name, d]) => ({ name, qty: Math.round(d.qty), total: Math.round(d.total) })).sort((a, b) => b.qty - a.qty).slice(0, 10);

  const mediana = median(filtered.map(o => o.total).filter(t => t > 0).sort((a, b) => a - b));

  // Candidatos 3x2: aparecen en muchas transacciones pero con subtotal por debajo de la mediana.
  const top5FrecuentesBaratos = Object.entries(byProd)
    .map(([name, d]) => ({
      name,
      txCount: d.txCount,
      subtotalProm: d.txCount > 0 ? Math.round(d.total / d.txCount) : 0,
      total: Math.round(d.total),
    }))
    .filter(p => p.subtotalProm < mediana && p.txCount >= 2)
    .sort((a, b) => b.txCount - a.txCount)
    .slice(0, 5);

  // Formas de pago: si no hay datos en db.orderPayments, paymentData queda vacío.
  const byPayment = {};
  const byPaymentCount = {};
  let paymentDataMissing = 0;
  const ordersWithPayment = new Set();
  if (db.orderPayments && db.orderPayments.length > 0) {
    db.orderPayments.forEach(p => {
      if (!filteredIds.has(p.orderId)) return;
      ordersWithPayment.add(p.orderId);
      const name = paymentName(db, p.paymentTypeId);
      byPayment[name] = (byPayment[name] || 0) + p.amount;
      byPaymentCount[name] = (byPaymentCount[name] || 0) + 1;
    });
    // Órdenes sin ningún monto de pago (todas las PAYMENT_NET_* en 0)
    filteredIds.forEach(id => { if (!ordersWithPayment.has(id)) paymentDataMissing++; });
  }
  const paymentTotal = Object.values(byPayment).reduce((s, v) => s + v, 0) || totalVentas;
  const paymentData = Object.entries(byPayment)
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      count: byPaymentCount[name] || 0,
      pct: paymentTotal > 0 ? (value / paymentTotal) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    totalVentas, cantOps, ticketProm, totalUnidades, timeData, empData, catData,
    singleDay, top10, top5FrecuentesBaratos, mediana,
    paymentData, paymentDataMissing,
  };
}

// Resumen de los 3 meses cerrados anteriores, con variación contra el mes previo.
export function computeHistorico(db, now = new Date()) {
  const meses = Array.from({ length: 4 }, (_, i) => {
    const ref = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const fin = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
    const ords = db.orders.filter(o => o.saleDate >= inicio && o.saleDate <= fin && o.total <= MAX_ORDEN_RAZONABLE);
    const total = ords.reduce((s, o) => s + o.total, 0);
    const cantOps = ords.length;
    const ticketProm = cantOps ? total / cantOps : 0;
    const ordIds = new Set(ords.map(o => o.id));
    const unidades = Math.round(db.orderLines.reduce((s, ol) => ordIds.has(ol.orderId) ? s + ol.qty : s, 0));
    const byDay = {};
    ords.forEach(o => { const d = toYMD(o.saleDate); byDay[d] = (byDay[d] || 0) + o.total; });
    let picoKey = null, picoVal = 0;
    Object.entries(byDay).forEach(([d, v]) => { if (v > picoVal) { picoVal = v; picoKey = d; } });
    let picoInfo = null;
    if (picoKey) { const dt = fromYMD(picoKey); picoInfo = { dia: dt.getDate(), diaSemana: DIAS_LARGO[dt.getDay()], total: Math.round(picoVal) }; }
    const nombreMes = ref.toLocaleString("es-AR", { month: "long", year: "numeric" });
    const ipcMes = (ipcDe(db)[ref.getFullYear()] || [])[ref.getMonth()] ?? null;
    return { nombre: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1), total: Math.round(total), cantOps, ticketProm: Math.round(ticketProm), unidades, pico: picoInfo, ipc: ipcMes, ref };
  });
  return meses.slice(0, 3).map((m, i) => {
    const anterior = meses[i + 1];
    const variacion = anterior && anterior.total > 0
      ? ((m.total - anterior.total) / anterior.total) * 100
      : null;
    return { ...m, variacion };
  });
}

// Histograma de importes de ticket (hasta el percentil 95 o 2× el promedio) y percentiles.
export function computeHistograma(filtered, ticketProm) {
  const totales = filtered.map(o => o.total).filter(t => t > 0);
  if (!totales.length) return null;
  const sorted = [...totales].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const maxVal = Math.max(p95, ticketProm * 2);

  // ~15 barras, con el ancho redondeado a centenas
  const NUM_BINS = 15;
  const binSize = Math.ceil(maxVal / NUM_BINS / 100) * 100;
  const actualBins = Math.ceil(maxVal / binSize) + 1;
  const bins = Array.from({ length: actualBins }, (_, i) => ({ desde: i * binSize, hasta: (i + 1) * binSize, cantidad: 0 }));
  totales.forEach(t => {
    const idx = Math.min(Math.floor(t / binSize), actualBins - 1);
    if (bins[idx]) bins[idx].cantidad++;
  });

  // Sin las barras vacías del final (deja una)
  const lastNonEmpty = bins.reduce((acc, b, i) => b.cantidad > 0 ? i : acc, 0);
  const data = bins.slice(0, lastNonEmpty + 2).map((b, i) => ({
    ...b,
    abierto: i === actualBins - 1,
    pctTotal: (b.cantidad / totales.length) * 100,
  }));

  return {
    data,
    promedioIdx: data.findIndex(b => ticketProm >= b.desde && ticketProm < b.hasta),
    mediana: median(sorted),
    p25: sorted[Math.floor(sorted.length * 0.25)] ?? 0,
    p75: sorted[Math.floor(sorted.length * 0.75)] ?? 0,
  };
}

// Ventas por mes de un año, con el año anterior ajustado por la inflación acumulada del año en curso.
export function computeAnual(db, year, esActual, hoy = new Date()) {
  const hoyYear = hoy.getFullYear();
  const hoyMes = hoy.getMonth();

  const ventasMes = Array(12).fill(0);
  const opsMes = Array(12).fill(0);
  const ventasAnteriorMes = Array(12).fill(0);
  const ordenMes = {};
  db.orders.forEach(o => {
    const y = o.saleDate.getFullYear();
    if (esActual && y === year - 1) ventasAnteriorMes[o.saleDate.getMonth()] += o.total;
    if (y !== year) return;
    ordenMes[o.id] = o.saleDate.getMonth();
    if (o.total > MAX_ORDEN_RAZONABLE) return;
    const m = o.saleDate.getMonth();
    ventasMes[m] += o.total;
    opsMes[m] += 1;
  });
  const unidadesMes = Array(12).fill(0);
  db.orderLines.forEach(ol => {
    const m = ordenMes[ol.orderId];
    if (m === undefined) return;
    unidadesMes[m] += ol.qty;
  });

  const mesFin = year === hoyYear ? hoyMes : 11;
  let total = 0, ops = 0, unidades = 0;
  for (let m = 0; m <= mesFin; m++) {
    total += ventasMes[m];
    ops += opsMes[m];
    unidades += unidadesMes[m];
  }

  const ipc = ipcDe(db);
  const ipcAnio = ipc[year] || Array(12).fill(null);
  const factorAnioActual = esActual ? acumuladoFactor(year, 0, hoyMes, ipc) : 1;
  const data = MESES_CORTO.map((mes, m) => {
    const esFuturo = year === hoyYear && m > hoyMes;
    const row = { mes, ventas: esFuturo ? null : Math.round(ventasMes[m]), ipc: ipcAnio[m] ?? null };
    if (esActual) row.sombra = esFuturo ? null : Math.round(ventasAnteriorMes[m] * factorAnioActual);
    return row;
  });

  return { total, ops, ticket: ops ? total / ops : 0, unidades, data };
}
