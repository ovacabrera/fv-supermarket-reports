import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Empty, Panel } from "../components/ui.jsx";
import { CopyButton } from "../components/CopyButton.jsx";
import { Escaner } from "../components/Escaner.jsx";
import Icon from "../components/Icon.jsx";
import { armarIndice, buscar } from "../lib/precios.js";
import { MESES_CORTO, fromYMD, toYMD } from "../lib/dates.js";
import { ars, num } from "../lib/format.js";

const VISIBLES = 12;

const fecha = d => `${d.getDate()} ${MESES_CORTO[d.getMonth()].toLowerCase()}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`;
// "hoy", "ayer", "hace 9 días", "hace 3 meses", contando días de calendario.
function haceTxt(d) {
  const dias = Math.round((fromYMD(toYMD(new Date())) - fromYMD(toYMD(d))) / 864e5);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias >= 60) return `hace ${Math.floor(dias / 30)} meses`;
  return `hace ${dias} días`;
}

// El artículo elegido, como etiqueta de góndola.
function Ficha({ it }) {
  const n = Math.round(it.precio).toLocaleString("es-AR");
  return (
    <section className="span-2 ficha" aria-live="polite">
      <div className="tag">
        <div className="tag__label ficha__name">{it.name}<CopyButton text={it.name} /></div>
        {it.precio > 0 ? (
          <div className="tag__price" aria-label={`$ ${n}`}>
            <span className="tag__cur" aria-hidden="true">$</span>
            <span className="tag__value" aria-hidden="true">{n}</span>
          </div>
        ) : <div className="ficha__sin">Sin precio cargado</div>}
        <div className="tag__range">
          {it.desde && <span>Precio desde el {fecha(it.desde)} · {haceTxt(it.desde)}</span>}
          {it.barcode && <span className="num">Código {it.barcode}</span>}
          {it.categoria && <span>{it.categoria}</span>}
        </div>
      </div>
      <p className={`ficha__venta${it.distinto ? " is-alert" : ""}`}>
        {it.distinto && <Icon name="warning" size={18} />}
        {it.venta
          ? <span>Última venta: <strong>{ars(it.venta.precio)}</strong> el {fecha(it.venta.fecha)} ({haceTxt(it.venta.fecha)}){it.distinto && ". Se cobró distinto del precio de lista."}</span>
          : <span>Todavía no se vendió.</span>}
      </p>
    </section>
  );
}

export default function PreciosPage({ db }) {
  const indice = useMemo(() => armarIndice(db), [db]);
  const [consulta, setConsulta] = useState("");
  const [elegidoId, setElegidoId] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
  const [all, setAll] = useState(false);
  const inputRef = useRef(null);

  // En la compu el cursor queda en el buscador: un lector de códigos USB escribe ahí directo.
  useEffect(() => {
    if (window.matchMedia("(min-width: 900px)").matches) inputRef.current?.focus();
  }, []);

  const cambiar = useCallback(q => { setConsulta(q); setElegidoId(null); setAll(false); }, []);
  const onCodigo = useCallback(codigo => { setEscaneando(false); cambiar(codigo); }, [cambiar]);
  const cerrar = useCallback(() => setEscaneando(false), []);

  const res = useMemo(() => indice ? buscar(indice, consulta) : null, [indice, consulta]);

  if (!indice) {
    return <Empty title="Falta el catálogo de precios"
      text="Los datos guardados son de antes del consultor de precios. Van a aparecer con la próxima publicación desde la PC del POS." />;
  }

  // Ficha: el elegido de la lista, el del código exacto o el único resultado.
  const elegido = elegidoId != null ? indice.items.find(it => it.id === elegidoId) : null;
  const ficha = elegido || res.exacto || (res.total === 1 ? res.filas[0] : null);
  const filas = res.filas.filter(f => f !== ficha);
  const visibles = all ? filas : filas.slice(0, VISIBLES);
  const q = consulta.trim();

  return (
    <>
      {escaneando && <Escaner onCodigo={onCodigo} onCerrar={cerrar} />}
      <form className="span-2 finder" role="search" onSubmit={e => { e.preventDefault(); inputRef.current?.blur(); }}>
        <label className="sr-only" htmlFor="consulta">Nombre o código de barras</label>
        <div className="finder__box">
          <input id="consulta" ref={inputRef} className="finder__input" type="search" value={consulta}
            onChange={e => cambiar(e.target.value)} placeholder="Nombre o código"
            autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
          {consulta && (
            <button type="button" className="finder__clear" onClick={() => { cambiar(""); inputRef.current?.focus(); }} aria-label="Borrar">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
        <button type="button" className="btn finder__scan" onClick={() => setEscaneando(true)}>
          <Icon name="barcode" size={22} />Escanear
        </button>
      </form>

      {ficha && <Ficha it={ficha} />}

      {!q && (
        <Panel title="Consultar un precio" wide
          hint={`Escaneá el código con la cámara o escribí parte del nombre, en cualquier orden: "coca 500". Hay ${num(indice.items.length)} artículos activos.`}
          foot="Precio de la lista Minorista del POS, al momento de la última publicación de los datos. Si lo cambiaron después, se ve en la próxima." />
      )}

      {q && !ficha && res.total === 0 && (
        <Empty title="No se encontró"
          text={/^\d+$/.test(q) ? `Ningún artículo activo tiene el código ${q}.` : `Ningún artículo activo tiene "${q}" en el nombre.`} />
      )}

      {filas.length > 0 && (
        <Panel title={ficha ? "Otros resultados" : `${num(res.total)} resultados`} wide
          foot={res.total > res.filas.length && `Se muestran los primeros ${res.filas.length}. Escribí algo más para achicar la búsqueda.`}>
          <ol className="list">
            {visibles.map(f => (
              <li key={f.id}>
                <button type="button" className="hit" onClick={() => { setElegidoId(f.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <span className="list__top">
                    <span className="list__name">{f.name}</span>
                    <span className="list__value">{f.precio > 0 ? ars(f.precio) : "Sin precio"}</span>
                  </span>
                  <span className="list__meta">
                    {f.barcode && <span>{f.barcode}</span>}
                    {f.venta && <span>Última venta {haceTxt(f.venta.fecha)}</span>}
                    {f.distinto && <span className="is-strong">Se cobró distinto</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {filas.length > VISIBLES && (
            <button type="button" className="more" onClick={() => setAll(a => !a)} aria-expanded={all}>
              {all ? "Ver menos" : `Ver todos (${filas.length})`}
            </button>
          )}
        </Panel>
      )}
    </>
  );
}
