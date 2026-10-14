// ─── Formato de números ───────────────────────────────────────────────────────

export function ars(n) { return "$ " + Math.round(n).toLocaleString("es-AR"); }
export function arsShort(n) { n = Math.round(n); if (n >= 1000000) return "$" + (n / 1000000).toFixed(1).replace(".", ",") + "M"; if (n >= 1000) return "$" + Math.round(n / 1000) + "k"; return "$" + n; }
export function num(n) { return Math.round(n).toLocaleString("es-AR"); }
export function pct(n, digits = 1) { return n.toFixed(digits).replace(".", ",") + "%"; }
