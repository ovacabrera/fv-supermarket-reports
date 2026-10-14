// ─── Fechas ───────────────────────────────────────────────────────────────────
// Los días se manejan como "YYYY-MM-DD" en hora local.

export const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DIAS_LARGO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const MESES_NOMBRE = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// En hora local: con toISOString (UTC) las ventas después de las 21 h caían en el día siguiente.
export function toYMD(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function fromYMD(s) { return new Date(s + "T12:00:00"); }
export function sameDay(a, b) { return toYMD(a) === toYMD(b); }
export function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
export function addDays(ymd, n) { const d = fromYMD(ymd); d.setDate(d.getDate() + n); return toYMD(d); }
