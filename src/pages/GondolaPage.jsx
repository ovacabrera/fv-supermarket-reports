import { useMemo, useState } from "react";
import { Panel, Stats } from "../components/ui.jsx";
import { InflacionLines } from "../components/charts.jsx";
import { computePrecios, computeInflacionPropia, computeFaltantes } from "../lib/gondola.js";
import { DIAS_CORTO, MESES_NOMBRE, fromYMD } from "../lib/dates.js";
import { ars, arsShort, num, pct } from "../lib/format.js";

const fechaCorta = d => `${d.getDate()} ${MESES_NOMBRE[d.getMonth()].slice(0, 3).toLowerCase()}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`;
const hace = dias => dias >= 60 ? `${Math.floor(dias / 30)} meses` : `${dias} días`;

function VerMas({ total, visibles, all, onToggle, label }) {
  if (total <= visibles) return null;
  return (
    <button type="button" className="more" onClick={onToggle} aria-expanded={all}>
      {all ? "Ver menos" : `${label} (${total})`}
    </button>
  );
}

function PreciosViejos({ precios }) {
  const [all, setAll] = useState(false);
  const { filas, revisados, recientes, ipcHasta } = precios;
  const visibles = all ? filas : filas.slice(0, 8);
  const hasta = ipcHasta ? `${MESES_NOMBRE[ipcHasta.month].toLowerCase()} de ${ipcHasta.year}` : null;
  return (
    <Panel title="Precios sin actualizar" wide
      hint={`De los ${revisados} artículos que más se vendieron en los últimos 90 días, los que hace 45 días o más se cobran igual. Primero, los que más inflación acumularon desde el último cambio.`}
      foot={hasta && `Precio con inflación: el actual más la inflación de alimentos del INDEC desde el mes siguiente al cambio, con datos hasta ${hasta}. Es una referencia: sin las compras cargadas, no se sabe cuánto aumentó cada proveedor.`}>
      <Stats items={[
        { label: "Con el mismo precio hace 45 días o más", value: num(filas.length) },
        { label: "Cambiaron de precio hace menos", value: num(recientes) },
      ]} />
      {filas.length ? (
        <>
          <ol className="list">
            {visibles.map(f => (
              <li key={f.id}>
                <div className="list__top">
                  <span className="list__name">{f.name}</span>
                  <span className="list__value">{ars(f.precio)}</span>
                </div>
                <div className="list__meta">
                  <span>Desde el {fechaCorta(f.desde)} · hace {hace(f.dias)}</span>
                  {f.inflacion >= 0.5 && <span>Inflación desde entonces <span className="is-strong">{pct(f.inflacion)}</span></span>}
                  {f.inflacion >= 0.5 && <span>Con inflación: <span className="is-strong">{ars(f.precioConInflacion)}</span></span>}
                </div>
              </li>
            ))}
          </ol>
          <VerMas total={filas.length} visibles={8} all={all} onToggle={() => setAll(a => !a)} label="Ver todos" />
        </>
      ) : <p className="panel__hint">Todos los artículos que más se venden cambiaron de precio en los últimos 45 días.</p>}
    </Panel>
  );
}

function InflacionPropia({ inf }) {
  const dif = inf.propia - inf.ipc;
  const hint = Math.abs(dif) < 2
    ? "Tus precios subieron parecido a la inflación de alimentos."
    : dif < 0
      ? `Tus precios subieron ${num(-dif)} puntos menos que la inflación de alimentos. Si los proveedores aumentaron como la inflación, se está perdiendo margen.`
      : `Tus precios subieron ${num(dif)} puntos más que la inflación de alimentos.`;
  return (
    <Panel title="Inflación de tu góndola" wide hint={hint}
      foot={`Canasta fija de los ${inf.articulos} artículos que más facturaron entre ${inf.desde} y ${inf.hasta}, con el precio típico de cada mes y el peso de lo que facturó cada uno. Inflación: IPC del INDEC, alimentos y bebidas no alcohólicas.`}>
      <Stats items={[
        { label: `Tus precios, ${inf.desde} a ${inf.hasta}`, value: `+${pct(inf.propia)}` },
        { label: "Inflación de alimentos", value: `+${pct(inf.ipc)}` },
      ]} />
      <InflacionLines data={inf.data} labels={{ propia: "Tus precios", ipc: "Inflación de alimentos" }} />
    </Panel>
  );
}

function Faltantes({ falt }) {
  const [all, setAll] = useState(false);
  const { filas } = falt;
  const visibles = all ? filas : filas.slice(0, 8);
  const dia = ymd => { const d = fromYMD(ymd); return `${DIAS_CORTO[d.getDay()].toLowerCase()} ${d.getDate()}/${d.getMonth() + 1}`; };
  return (
    <Panel title="Probablemente faltan" wide
      hint="Artículos que se vendían casi todos los días y hace varios días que no salen. Puede que se hayan terminado o que no estén en la góndola."
      foot="Se cuentan los días con el negocio abierto, sin el de hoy. Un artículo aparece cuando la chance de no venderlo esos días por casualidad es menor al 2%. Primero, los que más se facturaban por día.">
      {filas.length ? (
        <>
          <ol className="list">
            {visibles.map(f => (
              <li key={f.id}>
                <div className="list__top">
                  <span className="list__name">{f.name}</span>
                  <span className="list__value">hace {f.gap} días</span>
                </div>
                <div className="list__meta">
                  <span>Se vendía {Math.round(f.frecuencia * 10)} de cada 10 días</span>
                  <span>Última venta: {dia(f.ultimaVenta)}</span>
                  <span>{arsShort(f.porDia)} por día</span>
                </div>
              </li>
            ))}
          </ol>
          <VerMas total={filas.length} visibles={8} all={all} onToggle={() => setAll(a => !a)} label="Ver todos" />
        </>
      ) : <p className="panel__hint">No hay artículos de venta diaria que hayan dejado de salir.</p>}
    </Panel>
  );
}

export default function GondolaPage({ db }) {
  const precios = useMemo(() => computePrecios(db), [db]);
  const inf = useMemo(() => computeInflacionPropia(db), [db]);
  const falt = useMemo(() => computeFaltantes(db), [db]);
  return (
    <>
      {falt && <Faltantes falt={falt} />}
      {precios && <PreciosViejos precios={precios} />}
      {inf && <InflacionPropia inf={inf} />}
    </>
  );
}
