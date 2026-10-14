import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { MESES_NOMBRE, addMonths, fromYMD, sameDay, toYMD } from "../lib/dates.js";
import { TIME_WINDOWS, presets, describeDates, describeTimes } from "../lib/period.js";

// ─── Barra de períodos: atajos + "Elegir fechas" ──────────────────────────────
export function PeriodBar({ period, onChange, today }) {
  const [open, setOpen] = useState(false);
  const sentinel = useRef(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const list = presets(today);
  const active = list.find(p => p.dateFrom === period.dateFrom && p.dateTo === period.dateTo);
  const times = describeTimes(period);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" />
      <div className={`period${stuck ? " is-stuck" : ""}`}>
        <div className="period__inner">
          <div className="chips" role="group" aria-label="Período">
            {list.map(p => (
              <button key={p.id} type="button" className="chip" aria-pressed={active?.id === p.id}
                onClick={() => onChange({ ...period, dateFrom: p.dateFrom, dateTo: p.dateTo })}>
                {p.label}
              </button>
            ))}
            <button type="button" className="chip chip--custom" aria-pressed={!active || !!times} onClick={() => setOpen(true)}>
              <Icon name="calendar" size={18} />
              {active && !times ? "Elegir fechas" : [!active && describeDates(period).split(" · ")[0], times].filter(Boolean).join(", ")}
            </button>
          </div>
        </div>
      </div>
      {open && <PeriodSheet period={period} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Hoja para elegir rango y franja horaria ──────────────────────────────────
function PeriodSheet({ period, onChange, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const win = TIME_WINDOWS.find(w => w.timeFrom === period.timeFrom && w.timeTo === period.timeTo);
  const times = describeTimes(period);

  return (
    <div className="sheet-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={ref} tabIndex={-1}>
        <div className="sheet__grip" aria-hidden="true" />
        <div className="sheet__head">
          <h2 className="sheet__title" id="sheet-title">Elegir período</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <p className="sheet__summary">{describeDates(period)}{times ? `, ${times}` : ""}</p>

        <RangeCalendar dateFrom={period.dateFrom} dateTo={period.dateTo}
          onChange={(dateFrom, dateTo) => onChange({ ...period, dateFrom, dateTo })} />

        <div className="sheet__group">
          <div className="sheet__label" id="franja">Horario</div>
          <div className="seg" role="group" aria-labelledby="franja">
            {TIME_WINDOWS.map(w => (
              <button key={w.id} type="button" aria-pressed={win?.id === w.id}
                onClick={() => onChange({ ...period, timeFrom: w.timeFrom, timeTo: w.timeTo })}>
                {w.label}
              </button>
            ))}
          </div>
          <div className="times">
            <label>Desde
              <input type="time" value={period.timeFrom} onChange={e => e.target.value && onChange({ ...period, timeFrom: e.target.value })} />
            </label>
            <label>Hasta
              <input type="time" value={period.timeTo} onChange={e => e.target.value && onChange({ ...period, timeTo: e.target.value })} />
            </label>
          </div>
        </div>

        <button type="button" className="sheet__done" onClick={onClose}>Ver resultados</button>
      </div>
    </div>
  );
}

// Primer toque: día inicial (y final, por si es un solo día). Segundo toque: día final.
function RangeCalendar({ dateFrom, dateTo, onChange }) {
  const [viewDate, setViewDate] = useState(() => fromYMD(dateTo));
  const [selecting, setSelecting] = useState(false);
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dfDate = fromYMD(dateFrom), dtDate = fromYMD(dateTo);
  const now = new Date();

  function handleDayClick(d) {
    const s = toYMD(d);
    if (!selecting) { onChange(s, s); setSelecting(true); }
    else { const lo = d < dfDate ? s : dateFrom; const hi = d < dfDate ? dateFrom : s; onChange(lo, hi); setSelecting(false); }
  }

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i, 12));

  return (
    <div className="cal">
      <div className="cal__nav">
        <button type="button" className="icon-btn" onClick={() => setViewDate(addMonths(viewDate, -1))} aria-label="Mes anterior"><Icon name="left" /></button>
        <div className="cal__month" aria-live="polite">{MESES_NOMBRE[month]} {year}</div>
        <button type="button" className="icon-btn" onClick={() => setViewDate(addMonths(viewDate, 1))} aria-label="Mes siguiente"><Icon name="right" /></button>
      </div>
      <div className="cal__grid">
        {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"].map(d => <div key={d} className="cal__dow" aria-hidden="true">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const start = sameDay(d, dfDate), end = sameDay(d, dtDate);
          const cls = ["cal__day",
            start && "is-start", end && "is-end",
            d > dfDate && d < dtDate && "in-range",
            sameDay(d, now) && "is-today",
            d > now && "is-future"].filter(Boolean).join(" ");
          return (
            <button key={i} type="button" className={cls} onClick={() => handleDayClick(d)}
              aria-pressed={start || end} aria-label={`${d.getDate()} de ${MESES_NOMBRE[month].toLowerCase()}`}>
              <span>{d.getDate()}</span>
            </button>
          );
        })}
      </div>
      <p className="cal__hint" aria-live="polite">{selecting ? "Tocá el último día del período" : "Tocá un día, o el primero y el último"}</p>
    </div>
  );
}
