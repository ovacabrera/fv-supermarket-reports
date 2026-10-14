import { Panel, BarRows } from "../components/ui.jsx";
import { arsShort, num, pct } from "../lib/format.js";

export default function ProductosPage({ metrics }) {
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
    </>
  );
}
