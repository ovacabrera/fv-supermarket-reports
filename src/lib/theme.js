// ─── Colores para los gráficos (SVG de Recharts) ──────────────────────────────
// Recharts escribe los colores como atributos, así que no puede usar las variables CSS:
// se repiten acá los mismos valores de index.css, en claro y oscuro.
// Paleta de series validada con la skill dataviz (contraste y daltonismo) en ambos modos.

import { useSyncExternalStore } from "react";

const LIGHT = {
  surface: "#ffffff", ink: "#18202e", ink2: "#465163", muted: "#677285",
  grid: "#e6eaef", axis: "#c4ccd6", data: "#2a78d6", dataMuted: "#b7d3f6",
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"],
};
const DARK = {
  surface: "#171c24", ink: "#e9edf2", ink2: "#b4bdc9", muted: "#8a94a3",
  grid: "#252c36", axis: "#3a4350", data: "#3987e5", dataMuted: "#3e5c88",
  series: ["#3987e5", "#d95926", "#199e70", "#c98500"],
};

const query = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const subscribe = cb => { query?.addEventListener("change", cb); return () => query?.removeEventListener("change", cb); };
const isDark = () => !!query?.matches;

export function useChartTheme() {
  return useSyncExternalStore(subscribe, isDark) ? DARK : LIGHT;
}

export const AXIS_TICK = { fontSize: 12, fontFamily: "Barlow, system-ui, sans-serif" };
