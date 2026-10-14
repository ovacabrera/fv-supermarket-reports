// ─── IPC INDEC hardcodeado (variación mensual %) ───────────────────────────────
export const IPC = {
  2023: [6.0, 6.6, 7.7, 8.4, 7.8, 6.0, 6.3, 12.4, 12.7, 8.3, 12.8, 25.5],
  2024: [20.6, 13.2, 11.0, 8.8, 4.2, 4.6, 4.0, 4.2, 3.5, 2.7, 2.4, 2.7],
  2025: [2.2, 2.4, 3.7, 2.8, 1.5, 1.6, 1.9, 1.9, 2.1, 2.3, 2.5, 2.8],
  2026: [2.9, 2.9, 3.4, 2.6, null, null, null, null, null, null, null, null],
};

export function acumuladoFactor(year, mesInicio, mesFin) {
  let f = 1;
  const datos = IPC[year] || [];
  for (let m = mesInicio; m <= mesFin; m++) {
    const v = datos[m];
    if (v != null) f *= (1 + v / 100);
  }
  return f;
}

// Último mes con dato publicado, para la nota de fuente.
export function ultimoIpc() {
  const years = Object.keys(IPC).map(Number).sort();
  for (let i = years.length - 1; i >= 0; i--) {
    const m = IPC[years[i]].findLastIndex(v => v != null);
    if (m >= 0) return { year: years[i], month: m };
  }
  return null;
}
