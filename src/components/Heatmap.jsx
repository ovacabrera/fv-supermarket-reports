import { useState } from "react";
import { ars, num } from "../lib/format.js";

// Intensidad de 0 a 1 → mezcla del color de datos con la superficie (un solo tono, de claro a
// oscuro en modo claro y al revés en oscuro: dataviz, escala secuencial).
const fondo = v => v <= 0 ? "var(--surface-2)" : `color-mix(in srgb, var(--data) ${Math.round(12 + v * 88)}%, var(--surface-2))`;
const comprasTxt = n => `${n < 10 ? n.toFixed(1).replace(".", ",") : num(n)} ${n === 1 ? "compra" : "compras"}`;

// Mapa de calor día × hora. `mapa`: salida de computeMapaCalor.
export function Heatmap({ mapa }) {
  const [sel, setSel] = useState(null);
  const { dias, horas, max, pico } = mapa;
  const actual = sel ?? { ...pico, esPico: true };
  return (
    <>
      <p className="heat__readout" aria-live="polite">
        <strong>{actual.nombre} de {actual.hora} a {actual.hora + 1} h</strong>
        {actual.esPico && <span className="heat__badge">El horario con más gente</span>}
        <br />
        {comprasTxt(actual.compras)} y {ars(actual.ventas)} en promedio
      </p>
      <div className="heat" style={{ gridTemplateColumns: `2.6em repeat(${horas.length}, minmax(0, 1fr))` }}
        onMouseLeave={() => setSel(null)}>
        {dias.map(d => (
          <div className="heat__row" key={d.dia} style={{ display: "contents" }}>
            <span className="heat__day">{d.corto}</span>
            {d.celdas.map(c => {
              const activo = actual.nombre === d.nombre && actual.hora === c.hora;
              return (
                <button type="button" key={c.hora} className={`heat__cell${activo ? " is-sel" : ""}`}
                  style={{ background: fondo(max ? c.compras / max : 0) }}
                  aria-label={`${d.nombre} ${c.hora} h: ${comprasTxt(c.compras)}, ${ars(c.ventas)}`}
                  onMouseEnter={() => setSel({ ...c, nombre: d.nombre })}
                  onFocus={() => setSel({ ...c, nombre: d.nombre })}
                  onClick={() => setSel({ ...c, nombre: d.nombre })} />
              );
            })}
          </div>
        ))}
        <span />
        {horas.map(h => <span key={h} className="heat__hour">{h % 3 === 0 ? h : ""}</span>)}
      </div>
      <div className="heat__scale" aria-hidden="true">
        <span>Menos</span>
        {[0.1, 0.35, 0.6, 0.85, 1].map(v => <i key={v} style={{ background: fondo(v) }} />)}
        <span>Más gente</span>
      </div>
    </>
  );
}
