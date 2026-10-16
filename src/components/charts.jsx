import {
  Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ars, arsShort, num, pct } from "../lib/format.js";
import { AXIS_TICK, useChartTheme } from "../lib/theme.js";

const MARGIN = { top: 22, right: 4, left: 0, bottom: 0 };

function Tip({ active, payload, title, rows }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tip">
      <div className="tip__title">{title(d)}</div>
      {rows(d, payload).map((r, i) => (
        <div className="tip__row" key={i}>
          {r.color && <span className="swatch" style={{ background: r.color }} />}
          {r.text}
        </div>
      ))}
    </div>
  );
}

function useAxes() {
  const t = useChartTheme();
  return {
    t,
    grid: <CartesianGrid stroke={t.grid} vertical={false} />,
    xProps: { tick: { ...AXIS_TICK, fill: t.muted }, axisLine: { stroke: t.axis }, tickLine: false, tickMargin: 6 },
    yProps: { tick: { ...AXIS_TICK, fill: t.muted }, axisLine: false, tickLine: false, tickFormatter: arsShort, width: 46 },
    cursor: { fill: t.grid, opacity: 0.6 },
  };
}

// Etiqueta directa sobre la barra más alta (una sola, no un número por barra).
function PeakLabel({ x, y, width, value, index, peak, color }) {
  if (index !== peak) return null;
  return <text x={x + width / 2} y={y - 7} textAnchor="middle" fill={color} fontSize={12} fontWeight={600} fontFamily={AXIS_TICK.fontFamily}>{arsShort(value)}</text>;
}

// ─── Ventas por hora / por día ────────────────────────────────────────────────
export function TimeBars({ data }) {
  const { t, grid, xProps, yProps, cursor } = useAxes();
  let peak = 0;
  data.forEach((d, i) => { if (d.ventas > data[peak].ventas) peak = i; });
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={MARGIN} barCategoryGap={data.length > 20 ? 2 : "18%"}>
          {grid}
          <XAxis dataKey="label" {...xProps} interval="preserveStartEnd" minTickGap={14} />
          <YAxis {...yProps} />
          <Tooltip cursor={cursor} content={<Tip title={d => d.label} rows={d => [{ text: ars(d.ventas) }]} />} />
          <Bar dataKey="ventas" fill={t.data} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            <LabelList dataKey="ventas" content={<PeakLabel peak={peak} color={t.ink} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Distribución de importes de ticket ───────────────────────────────────────
export function TicketHistogram({ hist }) {
  const { t, grid, xProps, yProps, cursor } = useAxes();
  const data = hist.data.map(b => ({ ...b, label: arsShort(b.desde) }));
  const rango = b => b.abierto ? `${arsShort(b.desde)} o más` : `${arsShort(b.desde)} a ${arsShort(b.hasta)}`;
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={MARGIN} barCategoryGap={2}>
          {grid}
          <XAxis dataKey="label" {...xProps} interval="preserveStartEnd" minTickGap={10} />
          <YAxis {...yProps} tickFormatter={num} allowDecimals={false} width={36} />
          <Tooltip cursor={cursor} content={<Tip title={rango} rows={d => [
            { text: `${num(d.cantidad)} ${d.cantidad === 1 ? "compra" : "compras"}` },
            { text: `${pct(d.pctTotal)} del total` },
          ]} />} />
          {hist.promedioIdx >= 0 && (
            <ReferenceLine x={data[hist.promedioIdx].label} stroke={t.ink} strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: "Promedio", position: "top", fill: t.ink, fontSize: 12, fontWeight: 600, fontFamily: AXIS_TICK.fontFamily }} />
          )}
          <Bar dataKey="cantidad" fill={t.data} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Año por meses (con el año anterior ajustado por IPC) ─────────────────────
export function AnnualBars({ data, year, conSombra }) {
  const { t, grid, xProps, yProps, cursor } = useAxes();
  const prev = `${year - 1} ajustado por IPC`;
  return (
    <>
      <div className="chart-legend">
        <span><i className="swatch" style={{ background: t.data }} />Ventas {year}</span>
        {conSombra && <span><i className="swatch" style={{ background: t.dataMuted }} />{prev}</span>}
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ ...MARGIN, top: 8 }} barGap={2} barCategoryGap="16%">
            {grid}
            <XAxis dataKey="mes" {...xProps} interval={0} tick={{ ...xProps.tick, fontSize: 11 }} />
            <YAxis {...yProps} />
            <Tooltip cursor={cursor} content={<Tip title={d => `${d.mes} ${year}`} rows={d => [
              { text: d.ventas == null ? "Sin datos todavía" : ars(d.ventas), color: t.data },
              ...(conSombra && d.sombra != null ? [{ text: `${ars(d.sombra)} (${prev})`, color: t.dataMuted }] : []),
            ]} />} />
            {conSombra && <Bar dataKey="sombra" fill={t.dataMuted} radius={[3, 3, 0, 0]} isAnimationActive={false} />}
            <Bar dataKey="ventas" fill={t.data} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// IPC mensual: gráfico propio, con su escala en %, debajo del de ventas (mismos meses).
export function IpcBars({ data, year }) {
  const { t, grid, xProps, yProps, cursor } = useAxes();
  if (!data.some(d => d.ipc != null)) return null;
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} margin={{ ...MARGIN, top: 18 }} barCategoryGap="30%">
          {grid}
          <XAxis dataKey="mes" {...xProps} interval={0} tick={{ ...xProps.tick, fontSize: 11 }} />
          <YAxis {...yProps} tickFormatter={v => `${v}%`} width={46} allowDecimals={false} />
          <Tooltip cursor={cursor} content={<Tip title={d => `${d.mes} ${year}`} rows={d => [{ text: d.ipc == null ? "Sin dato del INDEC" : `Inflación ${pct(d.ipc)}` }]} />} />
          <Bar dataKey="ipc" fill={t.muted} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Inflación de la góndola contra el IPC (% acumulado desde el mes base) ────
// Una sola escala; las dos series con leyenda y etiqueta directa en el último punto.
function EndLabel({ x, y, index, last, value, color, below }) {
  if (index !== last || value == null) return null;
  return <text x={x - 4} y={y + (below ? 18 : -9)} textAnchor="end" fill={color} fontSize={12} fontWeight={600} fontFamily={AXIS_TICK.fontFamily}>{pct(value, 0)}</text>;
}

export function InflacionLines({ data, labels }) {
  const { t, grid, xProps, yProps } = useAxes();
  const last = data.length - 1;
  const propiaAbajo = (data[last].propia ?? 0) < data[last].ipc;
  const colors = { propia: t.data, ipc: t.series[1] };
  return (
    <>
      <div className="chart-legend">
        <span><i className="swatch swatch--line" style={{ background: colors.propia }} />{labels.propia}</span>
        <span><i className="swatch swatch--line" style={{ background: colors.ipc }} />{labels.ipc}</span>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={data} margin={{ ...MARGIN, top: 14, right: 8 }}>
            {grid}
            <XAxis dataKey="mes" {...xProps} interval="preserveStartEnd" minTickGap={18} />
            <YAxis {...yProps} tickFormatter={v => `${v}%`} width={42} />
            <Tooltip cursor={{ stroke: t.axis, strokeWidth: 1 }} content={<Tip title={d => d.mes} rows={d => [
              { text: d.propia == null ? `${labels.propia}: sin ventas` : `${labels.propia}: ${pct(d.propia)}`, color: colors.propia },
              { text: `${labels.ipc}: ${pct(d.ipc)}`, color: colors.ipc },
            ]} />} />
            <Line dataKey="ipc" stroke={colors.ipc} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: t.surface }} isAnimationActive={false}>
              <LabelList dataKey="ipc" content={<EndLabel last={last} color={t.ink} below={!propiaAbajo} />} />
            </Line>
            <Line dataKey="propia" stroke={colors.propia} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: t.surface }} connectNulls isAnimationActive={false}>
              <LabelList dataKey="propia" content={<EndLabel last={last} color={t.ink} below={propiaAbajo} />} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
