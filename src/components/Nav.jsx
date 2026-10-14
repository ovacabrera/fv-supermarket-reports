import Icon from "./Icon.jsx";
import { SECTIONS } from "../lib/sections.js";

function NavItems({ tab, onChange }) {
  return SECTIONS.map(({ id, label }) => (
    <button key={id} type="button" className="nav-item" aria-current={tab === id ? "page" : undefined} onClick={() => onChange(id)}>
      <span className="nav-item__icon"><Icon name={id} /></span>
      <span>{label}</span>
    </button>
  ));
}

export function Brand() {
  return (
    <div className="brand">
      <div className="brand__mark" aria-hidden="true">$</div>
      <div>
        <div className="brand__name">Panel de Ventas</div>
        <div className="brand__sub">FácilVirtual</div>
      </div>
    </div>
  );
}

// Escritorio: barra lateral fija.
export function Sidebar({ tab, onChange, footer }) {
  return (
    <nav className="sidebar" aria-label="Reportes">
      <Brand />
      <NavItems tab={tab} onChange={onChange} />
      {footer && <div className="sidebar__foot">{footer}</div>}
    </nav>
  );
}

// Celular: pestañas abajo, al alcance del pulgar.
export function BottomNav({ tab, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Reportes">
      <NavItems tab={tab} onChange={onChange} />
    </nav>
  );
}
