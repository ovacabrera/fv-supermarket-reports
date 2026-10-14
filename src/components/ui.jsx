import { useState } from "react";
import Icon from "./Icon.jsx";

// Venta total como etiqueta de góndola: "$" chico arriba y el importe grande.
export function PriceTag({ label, value, children }) {
  const n = Math.round(value).toLocaleString("es-AR");
  return (
    <div className="tag">
      <div className="tag__label">{label}</div>
      <div className="tag__price" aria-label={`$ ${n}`}>
        <span className="tag__cur" aria-hidden="true">$</span>
        <span className="tag__value" aria-hidden="true">{n}</span>
      </div>
      {children && <div className="tag__range">{children}</div>}
    </div>
  );
}

export function Kpis({ items }) {
  return (
    <dl className="kpis">
      {items.map(k => (
        <div className="kpi" key={k.label}>
          <dt className="kpi__label">{k.label}</dt>
          <dd className="kpi__value" style={{ margin: 0 }}>{k.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Panel({ title, hint, foot, wide, children }) {
  return (
    <section className={`panel${wide ? " span-2" : ""}`}>
      <header className="panel__head">
        <h2 className="panel__title">{title}</h2>
        {hint && <p className="panel__hint">{hint}</p>}
      </header>
      {children}
      {foot && <p className="panel__foot">{foot}</p>}
    </section>
  );
}

export function Stats({ items }) {
  return (
    <dl className={`stats${items.length === 4 ? " stats--4" : ""}`}>
      {items.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
    </dl>
  );
}

// Lista con barra proporcional. `rows`: [{ name, value, sub?, color? }], ya ordenadas.
export function BarRows({ rows, format, ranked, initial = rows.length, moreLabel = "Ver todos" }) {
  const [all, setAll] = useState(false);
  const max = Math.max(...rows.map(r => r.barValue ?? r.value), 1);
  const visible = all ? rows : rows.slice(0, initial);
  return (
    <>
      <ol className="rows">
        {visible.map((r, i) => (
          <li key={r.name} className={ranked ? "row--ranked" : undefined}>
            <div className="row__top">
              {ranked && <span className="row__rank">{i + 1}</span>}
              <span className="row__name" title={r.name}>{r.name}</span>
              <span className="row__value">{format(r.value)}</span>
              {r.sub != null && <span className="row__sub">{r.sub}</span>}
            </div>
            <div className="row__bar" aria-hidden="true">
              <i style={{ width: `${((r.barValue ?? r.value) / max) * 100}%`, background: r.color }} />
            </div>
          </li>
        ))}
      </ol>
      {rows.length > initial && (
        <button type="button" className="more" onClick={() => setAll(a => !a)} aria-expanded={all}>
          {all ? "Ver menos" : `${moreLabel} (${rows.length})`}
        </button>
      )}
    </>
  );
}

export function Delta({ value, suffix = "" }) {
  const up = value >= 0;
  return (
    <span className={`delta ${up ? "delta--up" : "delta--down"}`}>
      <Icon name={up ? "up" : "down"} size={15} strokeWidth={2.4} />
      {Math.abs(value).toFixed(1).replace(".", ",")}%{suffix}
    </span>
  );
}

export function Alert({ children }) {
  return <div className="alert" role="alert"><Icon name="warning" size={20} />{children}</div>;
}

export function Empty({ title, text, action }) {
  return (
    <section className="panel span-2 empty">
      <h2 className="empty__title">{title}</h2>
      {text && <p className="empty__text">{text}</p>}
      {action}
    </section>
  );
}

export function PanelSkeleton() {
  return <section className="panel span-2 skeleton" aria-busy="true"><div className="loading"><div className="loading__bar"><i /></div></div></section>;
}
