import { useMemo, useState } from "react";
import { Panel, Stats, Delta } from "../components/ui.jsx";
import { AnnualBars, IpcBars } from "../components/charts.jsx";
import { computeAnual, computeHistorico } from "../lib/metrics.js";
import { MESES_NOMBRE } from "../lib/dates.js";
import { ultimoIpc, IPC_FUENTE } from "../lib/ipc.js";
import { ars, arsShort, num, pct } from "../lib/format.js";

export default function HistoricoPage({ db }) {
  const meses = useMemo(() => computeHistorico(db), [db]);
  const hoyYear = new Date().getFullYear();
  const years = [hoyYear, hoyYear - 1, hoyYear - 2, hoyYear - 3];
  const [year, setYear] = useState(hoyYear);
  const esActual = year === hoyYear;
  const anual = useMemo(() => computeAnual(db, year, esActual), [db, year, esActual]);
  const ipc = ultimoIpc();

  return (
    <>
      <Panel title="Últimos meses" hint="Cada mes comparado con el anterior, junto a la inflación de ese mes."
        foot={`Inflación: ${IPC_FUENTE}.`}>
        <ol className="months">
          {meses.map(m => (
            <li className="month" key={m.nombre}>
              <div className="month__top">
                <span className="month__name">{m.nombre}</span>
                <span className="month__total">{ars(m.total)}</span>
              </div>
              <div className="month__meta">
                {m.variacion != null && <span><Delta value={m.variacion} /> vs mes anterior</span>}
                {m.ipc != null && <span>Inflación {pct(m.ipc)}</span>}
              </div>
              <div className="month__meta">
                <span>{num(m.cantOps)} operaciones</span>
                <span>Ticket {arsShort(m.ticketProm)}</span>
                <span>{num(m.unidades)} unidades</span>
              </div>
              {m.pico && <div className="month__meta">Mejor día: {m.pico.diaSemana.toLowerCase()} {m.pico.dia}, {ars(m.pico.total)}</div>}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Año por año"
        hint={esActual
          ? `Si las barras de ${year} quedan por debajo de las de ${year - 1} ajustado por IPC, en términos reales se vendió menos.`
          : "Si las ventas crecen menos que la inflación acumulada, en términos reales se vendió menos."}
        foot={ipc ? `Inflación: ${IPC_FUENTE}, datos hasta ${MESES_NOMBRE[ipc.month].toLowerCase()} de ${ipc.year}.` : null}>
        <div className="years" role="group" aria-label="Año">
          {years.map(y => (
            <button key={y} type="button" className="chip" aria-pressed={y === year} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
        <Stats items={[
          { label: esActual ? "Total en el año" : "Total", value: arsShort(anual.total) },
          { label: "Operaciones", value: num(anual.ops) },
          { label: "Ticket promedio", value: arsShort(anual.ticket) },
          { label: "Unidades", value: num(anual.unidades) },
        ]} />
        <AnnualBars data={anual.data} year={year} conSombra={esActual} />
        <h3 className="panel__hint" style={{ fontWeight: 600, margin: "16px 0 4px", color: "var(--ink)" }}>Inflación mensual de alimentos y bebidas (IPC)</h3>
        <IpcBars data={anual.data} year={year} />
      </Panel>
    </>
  );
}
