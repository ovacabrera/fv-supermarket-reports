import { useMemo, useState } from "react";
import { Panel, Stats } from "../components/ui.jsx";
import { InflacionLines } from "../components/charts.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { computePrecios, computeInflacionPropia, computeFaltantes } from "../lib/gondola.js";
import { DIAS_CORTO, MESES_NOMBRE, fromYMD, toYMD } from "../lib/dates.js";
import { ars, arsShort, num, pct } from "../lib/format.js";

const fechaCorta = d => `${d.getDate()} ${MESES_NOMBRE[d.getMonth()].slice(0, 3).toLowerCase()}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`;
const hace = dias => dias >= 60 ? `${Math.floor(dias / 30)} meses` : `${dias} días`;
// "hoy", "ayer" o "mié 7 oct · hace 9 días", contando días de calendario.
function ultimaVentaTxt(d) {
  const dias = Math.round((fromYMD(toYMD(new Date())) - fromYMD(toYMD(d))) / 864e5);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `${DIAS_CORTO[d.getDay()].toLowerCase()} ${fechaCorta(d)} · hace ${hace(dias)}`;
}

function VerMas({ total, visibles, all, onToggle, label }) {
  if (total <= visibles) return null;
  return (
    <button type="button" className="more" onClick={onToggle} aria-expanded={all}>
      {all ? "Ver menos" : `${label} (${total})`}
    </button>
  );
}

const GRUPOS = [
  { id: "alta", label: "Alta rotación",
    hint: "Se vendieron en 8 o más de las últimas 13 semanas y se siguen vendiendo, con el mismo precio hace 45 días o más. Son los que más pesan: primero, los que más inflación acumularon desde el último cambio.",
    vacio: "Todos los artículos de alta rotación cambiaron de precio en los últimos 45 días." },
  { id: "baja", label: "Baja rotación",
    hint: "Se venden algunas semanas sí y otras no, con el mismo precio hace 45 días o más. Primero, los que más facturaron en las últimas 13 semanas.",
    vacio: "No hay artículos de baja rotación con precio viejo." },
  { id: "sinVentas", label: "Sin ventas",
    hint: "Se vendían y dejaron de salir: faltan, cambiaron de código de barras o no vienen más. Si entró uno nuevo en su lugar, revisá que tenga el precio actualizado. Primero, los que más facturaban.",
    vacio: "No hay artículos que hayan dejado de venderse." },
];

function PreciosViejos({ precios }) {
  const [grupo, setGrupo] = useState("alta");
  const [all, setAll] = useState(false);
  const { grupos, recientes, ipcHasta } = precios;
  const g = GRUPOS.find(x => x.id === grupo);
  const filas = grupos[grupo];
  const visibles = all ? filas : filas.slice(0, 8);
  const hasta = ipcHasta ? `${MESES_NOMBRE[ipcHasta.month].toLowerCase()} de ${ipcHasta.year}` : null;
  const elegir = id => { setGrupo(id); setAll(false); };
  return (
    <Panel title="Precios sin actualizar" wide
      hint="Artículos vendidos en las últimas 13 semanas, separados por cuánto se venden. Los que dejaron de salir van aparte: su precio viejo ya no se está cobrando."
      foot={hasta && `Precio con inflación: el actual más la inflación de alimentos del INDEC desde el mes siguiente al cambio, con datos hasta ${hasta}. Es una referencia: sin las compras cargadas, no se sabe cuánto aumentó cada proveedor.`}>
      <Stats items={[
        { label: "Alta rotación con precio viejo", value: num(grupos.alta.length) },
        { label: "Alta rotación actualizados en 45 días", value: num(recientes.alta) },
      ]} />
      <div className="seg" role="group" aria-label="Grupo de artículos" style={{ marginBottom: 12 }}>
        {GRUPOS.map(x => (
          <button key={x.id} type="button" aria-pressed={grupo === x.id} onClick={() => elegir(x.id)}>
            {x.label}<br />({num(grupos[x.id].length)})
          </button>
        ))}
      </div>
      <p className="panel__hint" style={{ marginBottom: 12 }}>{g.hint}</p>
      {filas.length ? (
        <>
          <ol className="list">
            {visibles.map(f => (
              <li key={f.id}>
                <div className="list__top">
                  <span className="list__name">{f.name}<CopyButton text={f.name} /></span>
                  <span className="list__value">{ars(f.precio)}</span>
                </div>
                <div className="list__meta">
                  {grupo !== "sinVentas" && <span>Mismo precio desde el {fechaCorta(f.desde)} · hace {hace(f.dias)}</span>}
                  {grupo !== "sinVentas" && f.inflacion >= 0.5 && <span>Inflación desde entonces <span className="is-strong">{pct(f.inflacion)}</span></span>}
                  {grupo !== "sinVentas" && f.inflacion >= 0.5 && <span>Con inflación: <span className="is-strong">{ars(f.precioConInflacion)}</span></span>}
                  <span>Última venta: <span className="is-strong">{ultimaVentaTxt(f.ultimaVenta)}</span></span>
                </div>
              </li>
            ))}
          </ol>
          <VerMas total={filas.length} visibles={8} all={all} onToggle={() => setAll(a => !a)} label="Ver todos" />
        </>
      ) : <p className="panel__hint">{g.vacio}</p>}
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
                  <span className="list__name">{f.name}<CopyButton text={f.name} /></span>
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
