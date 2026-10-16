// ─── IPC INDEC (variación mensual %) ─────────────────────────────────────────
// Rubro Alimentos y bebidas no alcohólicas, región Nacional (código 01), del CSV oficial:
// https://www.indec.gob.ar/ftp/cuadros/economia/serie_ipc_divisiones.csv (columna v_m_IPC).
// Cargado a mano el 2026-10-15 con la publicación del 13/10/2026. La Fase 9 lo baja solo.
export const IPC_FUENTE = "IPC del INDEC, rubro Alimentos y bebidas no alcohólicas (nacional)";
export const IPC = {
  2023: [6.8, 9.8, 9.3, 10.1, 5.8, 4.1, 5.8, 15.6, 14.3, 7.7, 15.7, 29.7],
  2024: [20.4, 11.9, 10.5, 6.0, 4.8, 3.0, 3.2, 3.6, 2.3, 1.2, 0.9, 2.2],
  2025: [1.8, 3.2, 5.9, 2.9, 0.5, 0.6, 1.9, 1.4, 1.9, 2.3, 2.8, 3.1],
  2026: [4.7, 3.3, 3.4, 1.5, 2.5, 1.3, 2.0, 1.7, 2.0, null, null, null],
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
