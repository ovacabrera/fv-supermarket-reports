import { Panel, Empty } from "../components/ui.jsx";
import { ars, num, pct } from "../lib/format.js";
import { useChartTheme } from "../lib/theme.js";

// Medios con color propio; el resto se agrupa en "Otros" (máximo 4 colores, ver dataviz).
const PROPIOS = 3;

export default function PagosPage({ metrics, paymentOrder }) {
  const t = useChartTheme();
  if (!metrics.paymentData.length) {
    return <Empty title="Sin datos de formas de pago" text="Las ventas de este período no tienen los montos de pago registrados en el POS." />;
  }

  const propios = paymentOrder.slice(0, PROPIOS);
  const rows = [];
  let otros = null;
  for (const p of metrics.paymentData) {
    const i = propios.indexOf(p.name);
    if (i >= 0) rows.push({ ...p, color: t.series[i] });
    else {
      otros ??= { name: "Otros", value: 0, count: 0, pct: 0, color: t.series[PROPIOS], items: [] };
      otros.value += p.value; otros.count += p.count; otros.pct += p.pct; otros.items.push(p.name);
    }
  }
  rows.sort((a, b) => propios.indexOf(a.name) - propios.indexOf(b.name));
  if (otros) rows.push(otros);
  const principal = [...rows].sort((a, b) => b.value - a.value)[0];

  return (
    <Panel title="Cómo pagaron" wide
      hint={`${principal.name}: ${pct(principal.pct, 0)} de lo cobrado en el período.`}
      foot={metrics.paymentDataMissing > 0 ? `${num(metrics.paymentDataMissing)} ${metrics.paymentDataMissing === 1 ? "venta no tiene" : "ventas no tienen"} medio de pago registrado.` : null}>
      <div className="stack" role="img" aria-label={rows.map(r => `${r.name} ${pct(r.pct, 0)}`).join(", ")}>
        {rows.map(r => <i key={r.name} style={{ flexGrow: r.value, background: r.color }} />)}
      </div>
      <ol className="rows">
        {rows.map(r => (
          <li key={r.name} className="pay-row">
            <div className="row__top">
              <span className="row__name">
                <span className="swatch" style={{ background: r.color }} />
                {r.name}
              </span>
              <span className="row__value">{ars(r.value)}</span>
              <span className="row__sub">{pct(r.pct, 0)}</span>
            </div>
            <div className="panel__hint" style={{ marginTop: 2, marginLeft: 20 }}>
              {num(r.count)} {r.count === 1 ? "pago" : "pagos"}{r.items ? ` · ${r.items.join(", ")}` : ""}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
