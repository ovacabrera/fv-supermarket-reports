import { useMemo } from "react";
import { Panel, BarRows } from "../components/ui.jsx";
import { computePareto, computeJuntos } from "../lib/productos.js";
import { arsShort, num, pct } from "../lib/format.js";

// A, B y C son ordinales: un solo tono, de fuerte a suave (dataviz).
const CLASES = [
  { id: "A", nombre: "A", color: "var(--data)" },
  { id: "B", nombre: "B", color: "color-mix(in srgb, var(--data) 55%, var(--surface-2))" },
  { id: "C", nombre: "C", color: "color-mix(in srgb, var(--data) 25%, var(--surface-2))" },
];

function Pareto({ pareto }) {
  const { clases, articulos, listaA } = pareto;
  const a = clases.A;
  return (
    <Panel title="Los que hacen la venta"
      hint={`${num(a.n)} ${a.n === 1 ? "artículo hace" : "artículos hacen"} el 80% de lo facturado: ${pct(a.pctArticulos, 0)} de los ${num(articulos)} que se vendieron. Son los que nunca pueden faltar.`}
      foot="A: hasta el 80% de la venta. B: del 80% al 95%. C: el 5% restante. Sin Fiambrería Ticket.">
      <div className="abc">
        {[["Parte de los artículos", "pctArticulos"], ["Parte de la venta", "pctVenta"]].map(([label, key]) => (
          <div key={key}>
            <div className="abc__label">{label}</div>
            <div className="abc__bar" role="img" aria-label={`${label}: ${CLASES.map(c => `${c.nombre} ${pct(clases[c.id][key], 0)}`).join(", ")}`}>
              {CLASES.map(c => clases[c.id].n > 0 && <i key={c.id} style={{ flexGrow: clases[c.id][key], background: c.color }} />)}
            </div>
          </div>
        ))}
        <div className="chart-legend" style={{ margin: 0 }}>
          {CLASES.map(c => (
            <span key={c.id}><i className="swatch" style={{ background: c.color }} />{c.nombre}: {num(clases[c.id].n)} art. · {pct(clases[c.id].pctVenta, 0)} de la venta</span>
          ))}
        </div>
      </div>
      <BarRows ranked rows={listaA.map(p => ({ ...p, sub: pct(p.pct) }))} format={arsShort} initial={5} moreLabel="Ver todos los A" />
    </Panel>
  );
}

function Juntos({ juntos }) {
  if (juntos.pocas) {
    return (
      <Panel title="Se compran juntos">
        <p className="panel__hint">Hacen falta al menos {num(juntos.minimo)} compras con artículos para encontrar pares; en este período hay {num(juntos.compras)}. Elegí un período más largo, por ejemplo "Este mes".</p>
      </Panel>
    );
  }
  return (
    <Panel title="Se compran juntos"
      hint="Pares de artículos que aparecen en la misma compra mucho más de lo que daría la casualidad. Sirven para armar combos o ponerlos cerca."
      foot={`Entre ${num(juntos.compras)} compras. Entran los pares con ${num(juntos.minJuntos)} compras juntos o más.`}>
      {juntos.pares.length ? (
        <ol className="list">
          {juntos.pares.map(p => (
            <li key={p.a + p.b}>
              <div className="list__top">
                <span className="list__name">{p.a} <span style={{ color: "var(--muted)" }}>+</span> {p.b}</span>
              </div>
              <div className="list__meta">
                <span className="is-strong">{num(p.juntos)} compras juntos</span>
                <span>{p.lift >= 10 ? num(p.lift) : p.lift.toFixed(1).replace(".", ",")} veces más que por casualidad</span>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="panel__hint">No hay pares que se repitan lo suficiente en este período.</p>}
    </Panel>
  );
}

export default function ProductosPage({ db, metrics, filtered }) {
  const pareto = useMemo(() => computePareto(db, filtered), [db, filtered]);
  const juntos = useMemo(() => computeJuntos(db, filtered), [db, filtered]);
  const totalRubros = metrics.catData.reduce((s, c) => s + c.value, 0) || 1;
  return (
    <>
      <Panel title="Ventas por rubro" foot={metrics.catData.length === 15 ? "Se muestran los 15 rubros que más vendieron." : null}>
        <BarRows rows={metrics.catData.map(c => ({ ...c, sub: pct((c.value / totalRubros) * 100, 0) }))}
          format={arsShort} initial={8} moreLabel="Ver todos los rubros" />
      </Panel>

      <Panel title="Artículos más vendidos" hint="Por unidades. A la derecha, lo que se facturó de cada uno.">
        {metrics.top10.length
          ? <BarRows ranked rows={metrics.top10.map(p => ({ name: p.name, value: p.qty, sub: arsShort(p.total) }))} format={v => `${num(v)} u.`} />
          : <p className="panel__hint">No hay artículos con código en este período.</p>}
      </Panel>

      <Panel title="Candidatos para un 3x2" wide
        hint={`Aparecen en muchas compras, pero lo que se lleva cada cliente está por debajo de la compra típica (${arsShort(metrics.mediana)}). Una promoción puede subir ese importe.`}>
        {metrics.top5FrecuentesBaratos.length
          ? <BarRows ranked rows={metrics.top5FrecuentesBaratos.map(p => ({ name: p.name, value: p.txCount, sub: `${arsShort(p.subtotalProm)} c/u` }))}
            format={v => `${num(v)} compras`} />
          : <p className="panel__hint">No hay artículos frecuentes con importe bajo en este período.</p>}
      </Panel>

      {pareto && <Pareto pareto={pareto} />}
      <Juntos juntos={juntos} />
    </>
  );
}
