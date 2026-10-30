// ─── Consultor de precios para clientes ───────────────────────────────────────
// Sitio abierto (sin login). Baja solo /data/precios.json: código, nombre, precio, rubro y día de la
// última venta de los artículos activos (ver src/lib/preciosPublicos.js). Nada más de ventas.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Escaner } from "../../../src/components/Escaner.jsx";
import Icon from "../../../src/components/Icon.jsx";
import { buscar, normalizar } from "../../../src/lib/precios.js";
import { MESES_CORTO, fromYMD } from "../../../src/lib/dates.js";

const VISIBLES = 12;
const SIN_RUBRO = "Sin Clasificar";
// Por nombre solo se buscan los artículos vendidos en estos meses: los que no rotan pueden tener el precio viejo.
// Por código se busca en todos (el cliente tiene el producto en la mano).
const MESES_RECIENTES = 6;

const precioTxt = p => p.toLocaleString("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(p) ? 0 : 2 });

// "30 oct, 14:05"
function fechaTxt(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()].toLowerCase()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Etiqueta de la balanza (EAN-13 que empieza con 2): trae el precio impreso y no está en el catálogo.
const esBalanza = c => /^2\d{12}$/.test(c);

// Misma forma que el índice del panel (src/lib/precios.js) para usar el mismo buscar(), que ordena
// por la última venta. `recientes` es el índice para buscar por nombre.
function armarIndice(lista) {
  const items = lista.items.map((it, i) => ({
    id: i, name: it.nombre, norm: normalizar(it.nombre), barcode: it.codigo, precio: it.precio,
    rubro: it.rubro && it.rubro !== SIN_RUBRO ? it.rubro : null,
    venta: it.venta ? { fecha: fromYMD(it.venta) } : null,
  }));
  const porCodigo = new Map();
  for (const it of items) if (it.barcode) porCodigo.set(it.barcode, it);
  const desde = new Date();
  desde.setMonth(desde.getMonth() - MESES_RECIENTES);
  // Una lista publicada antes de que existiera `venta` no se filtra.
  const conVenta = lista.items.some(it => "venta" in it);
  const recientes = conVenta ? items.filter(it => it.venta && it.venta.fecha >= desde) : items;
  return { items, porCodigo, recientes: { items: recientes, porCodigo } };
}

// El lector a veces devuelve un UPC-A con un 0 adelante (13 dígitos) y el POS lo tiene con 12, o al revés.
function porCodigo(indice, q) {
  return indice.porCodigo.get(q) || (q.startsWith("0") && indice.porCodigo.get(q.slice(1))) || indice.porCodigo.get("0" + q) || null;
}

async function bajarLista() {
  const res = await fetch("./data/precios.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Foto del producto (Open Food Facts) ─────────────────────────────────────
// La pide el celular del cliente recién al mostrar la ficha: una consulta por artículo. Cubre ~64% de
// los más vendidos (medido el 2026-10-30). Si no hay o falla, la ficha queda igual, sin hueco.
// Licencia CC-BY-SA: se cita la fuente con un enlace al producto.
const fotos = new Map();   // código → url, o null si Open Food Facts no tiene foto

async function buscarFoto(codigo) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=image_front_url,image_url`,
      { signal: AbortSignal.timeout(6000) });
    if (res.status === 404) return null;
    if (!res.ok) return undefined;   // 429 o caído: no se guarda, se reintenta la próxima vez
    const j = await res.json();
    return (j.status === 1 && (j.product?.image_front_url || j.product?.image_url)) || null;
  } catch {
    return undefined;
  }
}

function useFoto(codigo) {
  const [, setListo] = useState(0);
  const valido = /^\d{8}$|^\d{12,13}$/.test(codigo || "");
  useEffect(() => {
    if (!valido || fotos.has(codigo)) return;
    let activo = true;
    buscarFoto(codigo).then(url => {
      if (url === undefined) return;
      fotos.set(codigo, url);
      if (activo) setListo(n => n + 1);
    });
    return () => { activo = false; };
  }, [codigo, valido]);
  return valido ? fotos.get(codigo) || null : null;
}

// Debajo del buscador, en el lugar de la lista de resultados (que se esconde con un artículo elegido).
function Foto({ it }) {
  const foto = useFoto(it.barcode);
  const [rota, setRota] = useState(null);   // url de una foto que no cargó
  if (!foto || foto === rota) return null;
  return (
    <figure className="pp-foto">
      <img className="pp-foto__img" src={foto} alt={it.name} onError={() => setRota(foto)} />
      <figcaption className="pp-foto__fuente">
        <a href={`https://world.openfoodfacts.org/product/${it.barcode}`} target="_blank" rel="noopener noreferrer">Foto: Open Food Facts</a>
      </figcaption>
    </figure>
  );
}

function Ficha({ it }) {
  const n = precioTxt(it.precio);
  return (
    <section className="tag pp-ficha" aria-live="polite">
      <div className="tag__label pp-ficha__name">{it.name}</div>
      <div className="tag__price" aria-label={`$ ${n}`}>
        <span className="tag__cur" aria-hidden="true">$</span>
        <span className="tag__value" aria-hidden="true">{n}</span>
      </div>
      <div className="tag__range">
        {it.barcode && <span className="num">Código {it.barcode}</span>}
        {it.rubro && <span>{it.rubro}</span>}
      </div>
    </section>
  );
}

export default function App() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [consulta, setConsulta] = useState("");
  const [elegidoId, setElegidoId] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
  const [all, setAll] = useState(false);
  const inputRef = useRef(null);

  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    bajarLista().then(l => activo && setLista(l), e => activo && setError(e.message));
    return () => { activo = false; };
  }, [intento]);
  const cargar = useCallback(() => { setError(null); setIntento(n => n + 1); }, []);

  const indice = useMemo(() => lista && armarIndice(lista), [lista]);
  const cambiar = useCallback(q => { setConsulta(q); setElegidoId(null); setAll(false); }, []);
  const onCodigo = useCallback(codigo => { setEscaneando(false); cambiar(codigo); window.scrollTo({ top: 0 }); }, [cambiar]);
  const cerrar = useCallback(() => setEscaneando(false), []);

  const q = consulta.trim();
  const res = useMemo(() => indice ? buscar(/^\d{4,}$/.test(q) ? indice : indice.recientes, q) : null, [indice, q]);

  const encabezado = (
    <header className="pp-head">
      <span className="pp-head__mark" aria-hidden="true"><Icon name="gondola" size={20} /></span>
      <h1 className="pp-head__title">Consultor de precios</h1>
    </header>
  );

  if (!indice) {
    return (
      <main className="pp">
        {encabezado}
        <div className="empty">
          {error ? (
            <>
              <h2 className="empty__title">No se pudieron cargar los precios</h2>
              <p className="empty__text">Revisá la conexión y probá de nuevo.</p>
              <button type="button" className="btn" onClick={cargar}>Reintentar</button>
            </>
          ) : <p className="empty__text" role="status">Cargando precios…</p>}
        </div>
      </main>
    );
  }

  const elegido = elegidoId != null ? indice.items[elegidoId] : null;
  const exacto = /^\d+$/.test(q) ? porCodigo(indice, q) : null;
  const ficha = elegido || exacto || (res.total === 1 ? res.filas[0] : null);
  // Con un artículo en la ficha no se muestran los demás: se vuelve a la lista con "Volver".
  const filas = ficha ? [] : res.filas;
  const volver = elegido && res.total > 1;
  const visibles = all ? filas : filas.slice(0, VISIBLES);
  const actualizado = fechaTxt(lista.generatedAt);

  return (
    <main className="pp">
      {escaneando && <Escaner onCodigo={onCodigo} onCerrar={cerrar} />}
      {encabezado}

      {ficha && <Ficha it={ficha} />}
      {volver && (
        <button type="button" className="more pp-back" onClick={() => setElegidoId(null)}>
          <Icon name="left" size={18} />Volver a los {res.total.toLocaleString("es-AR")} resultados
        </button>
      )}

      {!q && (
        <section className="pp-intro">
          <p className="pp-intro__text">Escaneá el código de barras del producto para ver su precio.</p>
        </section>
      )}

      <button type="button" className="pp-scan" onClick={() => setEscaneando(true)}>
        <Icon name="barcode" size={28} />{ficha || q ? "Escanear otro producto" : "Escanear un producto"}
      </button>

      {q && !ficha && res.total === 0 && (
        <div className="empty pp-empty" role="status">
          {esBalanza(q) ? (
            <>
              <h2 className="empty__title">Es una etiqueta de la balanza</h2>
              <p className="empty__text">El precio de este producto está impreso en la misma etiqueta.</p>
            </>
          ) : (
            <>
              <h2 className="empty__title">No lo encontramos</h2>
              <p className="empty__text">{/^\d+$/.test(q) ? `No tenemos un producto con el código ${q}.` : `Ningún producto vendido en los últimos ${MESES_RECIENTES} meses tiene "${q}" en el nombre.`} Consultá en caja.</p>
            </>
          )}
        </div>
      )}

      <form className="finder pp-finder" role="search" onSubmit={e => { e.preventDefault(); inputRef.current?.blur(); }}>
        <label className="pp-finder__label" htmlFor="consulta">O buscalo por nombre</label>
        <div className="finder__box">
          <input id="consulta" ref={inputRef} className="finder__input" type="search" value={consulta}
            onChange={e => cambiar(e.target.value)} placeholder="Ej.: coca 1,5"
            autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
          {consulta && (
            <button type="button" className="finder__clear" onClick={() => { cambiar(""); inputRef.current?.focus(); }} aria-label="Borrar">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      </form>

      {ficha && <Foto it={ficha} />}

      {filas.length > 0 && (
        <section className="panel">
          <h2 className="panel__title pp-results__title">{res.total.toLocaleString("es-AR")} resultados</h2>
          <ol className="list">
            {visibles.map(f => (
              <li key={f.id}>
                <button type="button" className="hit" onClick={() => { setElegidoId(f.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <span className="list__top">
                    <span className="list__name">{f.name}</span>
                    <span className="list__value">$ {precioTxt(f.precio)}</span>
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
          {res.total > res.filas.length && <p className="panel__foot">Se muestran los primeros {res.filas.length}. Escribí algo más para achicar la búsqueda.</p>}
        </section>
      )}

      <footer className="pp-foot">
        {actualizado && <p>Precios actualizados al {actualizado}.</p>}
        <p>Si ves una diferencia con la góndola, consultá en caja.</p>
      </footer>
    </main>
  );
}
