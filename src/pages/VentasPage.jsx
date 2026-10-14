import { useMemo } from "react";
import { PriceTag, Kpis, Panel, Stats, BarRows } from "../components/ui.jsx";
import { TimeBars, TicketHistogram } from "../components/charts.jsx";
import { describeDates, describeTimes } from "../lib/period.js";
import { computeHistograma } from "../lib/metrics.js";
import { ars, arsShort, num, pct } from "../lib/format.js";

export default function VentasPage({ metrics, filtered, period }) {
  const hist = useMemo(() => filtered.length >= 5 ? computeHistograma(filtered, metrics.ticketProm) : null, [filtered, metrics.ticketProm]);
  const times = describeTimes(period);

  const sesgo = !hist ? null
    : metrics.ticketProm > hist.mediana * 1.1 ? "Unas pocas compras grandes suben el promedio: la compra típica es la mediana."
    : metrics.ticketProm < hist.mediana * 0.9 ? "Muchas compras chicas bajan el promedio por debajo de la compra típica."
    : "El promedio y la compra típica son parecidos.";

  return (
    <>
      <div className="hero span-2">
        <PriceTag label="Venta total" value={metrics.totalVentas}>
          <span>{describeDates(period)}</span>
          {times && <span>{times}</span>}
        </PriceTag>
        <Kpis items={[
          { label: "Operaciones", value: num(metrics.cantOps) },
          { label: "Ticket promedio", value: ars(metrics.ticketProm) },
          { label: "Unidades", value: num(metrics.totalUnidades) },
        ]} />
      </div>

      <Panel title={metrics.singleDay ? "Ventas por hora" : "Ventas por día"}
        hint={metrics.singleDay ? "Tocá una barra para ver el importe de esa hora." : "Tocá una barra para ver el importe del día."}>
        <TimeBars data={metrics.timeData} />
      </Panel>

      <Panel title="Ventas por cajero">
        <BarRows rows={metrics.empData.map(e => ({ ...e, sub: pct((e.value / metrics.totalVentas) * 100, 0) }))} format={ars} />
      </Panel>

      {hist && (
        <Panel title="Cuánto gasta cada cliente" hint={sesgo} wide>
          <Stats items={[
            { label: "Compra típica", value: arsShort(hist.mediana) },
            { label: "Promedio", value: arsShort(metrics.ticketProm) },
            { label: "El 25% gasta menos de", value: arsShort(hist.p25) },
            { label: "El 25% gasta más de", value: arsShort(hist.p75) },
          ]} />
          <TicketHistogram hist={hist} />
        </Panel>
      )}
    </>
  );
}
