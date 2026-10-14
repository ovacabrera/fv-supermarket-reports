// ─── Período: atajos y textos ─────────────────────────────────────────────────
import { DIAS_LARGO, MESES_NOMBRE, addDays, fromYMD, toYMD } from "./dates.js";

export const FULL_DAY = { timeFrom: "00:00", timeTo: "23:59" };
export function presets(today) {
  const n = fromYMD(today);
  const ayer = addDays(today, -1);
  return [
    { id: "hoy", label: "Hoy", dateFrom: today, dateTo: today },
    { id: "ayer", label: "Ayer", dateFrom: ayer, dateTo: ayer },
    { id: "7d", label: "7 días", dateFrom: addDays(today, -6), dateTo: today },
    { id: "mes", label: "Este mes", dateFrom: toYMD(new Date(n.getFullYear(), n.getMonth(), 1, 12)), dateTo: toYMD(new Date(n.getFullYear(), n.getMonth() + 1, 0, 12)) },
    { id: "mes-pasado", label: "Mes pasado", dateFrom: toYMD(new Date(n.getFullYear(), n.getMonth() - 1, 1, 12)), dateTo: toYMD(new Date(n.getFullYear(), n.getMonth(), 0, 12)) },
  ];
}

const corto = d => `${d.getDate()} ${MESES_NOMBRE[d.getMonth()].slice(0, 3).toLowerCase()}`;

// "Domingo 5 de octubre" · "29 sep – 5 oct · 7 días"
export function describeDates({ dateFrom, dateTo }) {
  const a = fromYMD(dateFrom), b = fromYMD(dateTo);
  if (dateFrom === dateTo) return `${DIAS_LARGO[a.getDay()]} ${a.getDate()} de ${MESES_NOMBRE[a.getMonth()].toLowerCase()}`;
  const dias = Math.round((b - a) / 864e5) + 1;
  const anio = a.getFullYear() !== b.getFullYear() || a.getFullYear() !== new Date().getFullYear();
  return `${corto(a)}${anio ? " " + a.getFullYear() : ""} – ${corto(b)}${anio ? " " + b.getFullYear() : ""} · ${dias} días`;
}

export function describeTimes({ timeFrom, timeTo }) {
  if (timeFrom === FULL_DAY.timeFrom && timeTo === FULL_DAY.timeTo) return null;
  return `de ${timeFrom} a ${timeTo} h`;
}

export const TIME_WINDOWS = [
  { id: "dia", label: "Todo el día", timeFrom: "00:00", timeTo: "23:59" },
  { id: "manana", label: "Hasta las 16", timeFrom: "00:00", timeTo: "16:00" },
  { id: "tarde", label: "Desde las 16", timeFrom: "16:00", timeTo: "23:59" },
];
