import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseHSQL } from "./lib/parseHSQL.js";
import { readCachedSnapshot, fetchMeta, fetchSnapshot, fetchLiveSnapshot, snapshotDate } from "./lib/loadSnapshot.js";
import { filterOrders, computeMetrics, lastSaleDate, paymentRanking } from "./lib/metrics.js";
import { toYMD } from "./lib/dates.js";
import { SECTIONS } from "./lib/sections.js";
import { describeDates } from "./lib/period.js";
import { Sidebar, BottomNav, Brand } from "./components/Nav.jsx";
import { PeriodBar } from "./components/Period.jsx";
import { Alert, Empty, PanelSkeleton } from "./components/ui.jsx";
import Icon from "./components/Icon.jsx";

const VentasPage = lazy(() => import("./pages/VentasPage.jsx"));
const ProductosPage = lazy(() => import("./pages/ProductosPage.jsx"));
const PagosPage = lazy(() => import("./pages/PagosPage.jsx"));
const HistoricoPage = lazy(() => import("./pages/HistoricoPage.jsx"));
const GondolaPage = lazy(() => import("./pages/GondolaPage.jsx"));
const PreciosPage = lazy(() => import("./pages/PreciosPage.jsx"));

// URL base del servidor local. En desarrollo (vite) corre aparte en el puerto 3001;
// en producción (Electron, LAN, Cloudflare) se usa el mismo origen que la página.
const SERVER = import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:3001` : "";
const SNAPSHOT_MAX_HOURS = 36;

const tabFromHash = () => {
  const id = window.location.hash.slice(1);
  return SECTIONS.some(s => s.id === id) ? id : "ventas";
};

const p2 = n => String(n).padStart(2, "0");
const fechaCorta = d => `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

// ─── Fecha de los datos y aviso si están viejos ───────────────────────────────
function DataStatus({ date, offline }) {
  const [ahora] = useState(() => Date.now());
  if (!date || isNaN(date)) return null;
  const horas = (ahora - date.getTime()) / 36e5;
  const vieja = horas > SNAPSHOT_MAX_HOURS;
  return (
    <div className={`status${vieja ? " status--old" : ""}`} role="status">
      <span className="status__dot" aria-hidden="true" />
      <span>
        Datos al {fechaCorta(date)}
        {vieja && <><br />hace {Math.floor(horas / 24)} días</>}
        {offline && <><br />Sin conexión. <button type="button" className="status__link" onClick={() => window.location.reload()}>Reintentar</button></>}
      </span>
    </div>
  );
}

// ─── Pantalla inicial: cargando, o elegir el archivo a mano ───────────────────
function StartScreen({ loading, loadingMsg, showManual, dbInfo, error, onPick, onDropFile }) {
  const [over, setOver] = useState(false);
  return (
    <main className="start">
      <div className="start__box">
        <Brand />
        {loading && (
          <div className="loading" role="status">
            <div className="loading__bar"><i /></div>
            {loadingMsg}
          </div>
        )}
        {!loading && showManual && (
          <>
            {dbInfo?.found === false && dbInfo.path && (
              <Alert>No se encontró la base del POS en <span style={{ overflowWrap: "anywhere" }}>{dbInfo.path}</span>. Elegila a mano.</Alert>
            )}
            <button type="button" className={`drop${over ? " is-over" : ""}`} onClick={onPick}
              onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={e => { e.preventDefault(); setOver(false); onDropFile(e.dataTransfer?.files); }}>
              <Icon name="file" size={32} />
              <div className="drop__title">Elegir fvposdb.script</div>
              <div className="drop__text">Tocá para buscarlo o arrastralo acá. Si está, sumá también fvposdb.log (las ventas del día).</div>
            </button>
          </>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
    </main>
  );
}

export default function App() {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);
  // De dónde salen los datos: "live" (server local), "snapshot" (./data publicado) o "file" (selector manual)
  const [source, setSource] = useState(null);
  const [snapMeta, setSnapMeta] = useState(null);
  const [snapOffline, setSnapOffline] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Cargando datos…");
  const [showManual, setShowManual] = useState(false);
  const [tab, setTab] = useState(tabFromHash);
  const fileRef = useRef(null);

  const today = toYMD(new Date());
  const [period, setPeriod] = useState({ dateFrom: today, dateTo: today, timeFrom: "00:00", timeTo: "23:59" });

  const changeTab = useCallback(id => {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Server local (Electron / LAN): lee la base del POS en vivo. Devuelve false si no hay server
  // (en Cloudflare /api/db-info responde el index.html, no JSON).
  const loadLive = useCallback(async () => {
    const infoRes = await fetch(`${SERVER}/api/db-info`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (!infoRes || !(infoRes.headers.get("content-type") || "").includes("json")) return false;
    const info = await infoRes.json();
    setDbInfo(info);
    if (!info.found) return false;
    setLoadingMsg("Leyendo la base del POS…");
    const snap = await fetchLiveSnapshot(`${SERVER}/api/snapshot`);
    setDb(snap.db);
    setSource("live");
    setShowManual(false);
    setFileName(info.path);
    return true;
  }, []);

  // Snapshot publicado: si hay una foto más nueva que `current`, la baja.
  // Devuelve false si no hay snapshot disponible (ni publicado ni guardado).
  const loadSnapshot = useCallback(async (current) => {
    const meta = await fetchMeta();
    if (!meta) { setSnapOffline(!!current); return !!current; }
    if (current?.generatedAt === meta.generatedAt) { setSnapOffline(false); return true; }
    try {
      setLoadingMsg("Descargando datos…");
      const snap = await fetchSnapshot(meta);
      setDb(snap.db);
      setSnapMeta(snap.meta);
      setSource("snapshot");
      setShowManual(false);
      setSnapOffline(false);
      return true;
    } catch (e) {
      if (!current) throw e;
      setSnapOffline(true);
      return true;
    }
  }, []);

  // Orden de fuentes: server local (datos en vivo) → snapshot (lo guardado al instante, después
  // busca uno nuevo) → selector manual.
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (await loadLive()) return;
        const cached = await readCachedSnapshot();
        if (cached) {
          setDb(cached.db);
          setSnapMeta(cached.meta);
          setSource("snapshot");
          setLoading(false);
        }
        if (await loadSnapshot(cached?.meta)) return;
        setShowManual(true);
      } catch (e) {
        setError("No se pudieron cargar los datos: " + e.message);
        setShowManual(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadLive, loadSnapshot]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      if (source === "snapshot") await loadSnapshot(snapMeta);
      else if (!(await loadLive())) setError("No se pudo actualizar. Revisá que el servidor local esté abierto.");
    } catch {
      setError("No se pudo actualizar. Probá de nuevo en un rato.");
    } finally {
      setRefreshing(false);
    }
  }, [source, snapMeta, loadSnapshot, loadLive]);

  // Acepta el .script solo o junto con el .log (selección múltiple o arrastrando los dos).
  const handleFile = useCallback(async (fileList) => {
    const files = [...(fileList || [])];
    if (files.length === 0) return;
    const scriptFile = files.find(f => f.name.endsWith(".script"));
    const logFile = files.find(f => f.name.endsWith(".log"));
    setLoading(true); setError(null);
    try {
      if (files.some(f => f.name.endsWith(".7z") || f.name.endsWith(".zip"))) { setError("Descomprimí el .7z y elegí fvposdb.script (y fvposdb.log, si está)."); setLoading(false); return; }
      if (!scriptFile) { setError("Falta fvposdb.script: el .log solo no alcanza."); setLoading(false); return; }
      setFileName(logFile ? `${scriptFile.name} + ${logFile.name}` : scriptFile.name);
      setLoadingMsg("Leyendo el archivo…");
      setDb(parseHSQL({ script: await scriptFile.text(), log: logFile ? await logFile.text() : null }));
      setSource("file");
      setShowManual(false);
    } catch (e) { setError("No se pudo leer el archivo: " + e.message); }
    setLoading(false);
  }, []);

  const filtered = useMemo(() => db ? filterOrders(db, period) : null, [db, period]);
  const metrics = useMemo(() => filtered ? computeMetrics(db, filtered, period.dateFrom, period.dateTo) : null, [db, filtered, period.dateFrom, period.dateTo]);
  const paymentOrder = useMemo(() => db ? paymentRanking(db) : [], [db]);
  const lastSale = useMemo(() => db ? lastSaleDate(db) : null, [db]);

  const fileInput = <input ref={fileRef} type="file" multiple hidden onChange={e => handleFile(e.target.files)} />;

  if (!db) {
    return (
      <>
        {fileInput}
        <StartScreen loading={loading} loadingMsg={loadingMsg} showManual={showManual} dbInfo={dbInfo} error={error}
          onPick={() => fileRef.current?.click()} onDropFile={handleFile} />
      </>
    );
  }

  const dataDate = source === "snapshot" ? snapshotDate(snapMeta) : source === "live" && dbInfo?.modified ? new Date(dbInfo.modified) : null;
  // Histórico y Góndola miran toda la historia, y Precios el catálogo: no usan el período.
  const usesPeriod = tab !== "historico" && tab !== "gondola" && tab !== "precios";
  const title = SECTIONS.find(s => s.id === tab).label;

  let body;
  if (usesPeriod && filtered.length === 0) {
    const ultimo = lastSale && toYMD(lastSale);
    const saltar = ultimo && ultimo < period.dateFrom;
    body = (
      <Empty title="No hay ventas en este período"
        text={saltar ? `Los datos llegan hasta el ${describeDates({ dateFrom: ultimo, dateTo: ultimo }).toLowerCase()}.` : `${describeDates(period)}. Probá con otro rango u horario.`}
        action={saltar && (
          <button type="button" className="btn" onClick={() => setPeriod(p => ({ ...p, dateFrom: ultimo, dateTo: ultimo }))}>
            Ver el último día con ventas
          </button>
        )} />
    );
  } else if (tab === "ventas") body = <VentasPage db={db} metrics={metrics} filtered={filtered} period={period} />;
  else if (tab === "productos") body = <ProductosPage db={db} metrics={metrics} filtered={filtered} />;
  else if (tab === "gondola") body = <GondolaPage db={db} />;
  else if (tab === "precios") body = <PreciosPage db={db} />;
  else if (tab === "pagos") body = <PagosPage metrics={metrics} paymentOrder={paymentOrder} />;
  else body = <HistoricoPage db={db} />;

  return (
    <div className="shell">
      {fileInput}
      <Sidebar tab={tab} onChange={changeTab} footer={source !== "snapshot" && fileName && (
        <>
          <span>Base: {fileName}</span>
          <button type="button" className="status__link" style={{ justifySelf: "start" }} onClick={() => fileRef.current?.click()}>Elegir otro archivo</button>
        </>
      )} />
      <div className="main">
        <header className="topbar">
          <h1 className="topbar__title">{title}</h1>
          <div className="topbar__status"><DataStatus date={dataDate} offline={snapOffline} /></div>
          {source !== "file" && (
            <button type="button" className="icon-btn" onClick={refresh} disabled={refreshing} aria-busy={refreshing}
              aria-label={refreshing ? "Buscando datos nuevos" : "Buscar datos nuevos"} title="Buscar datos nuevos">
              <Icon name="refresh" />
            </button>
          )}
        </header>
        {usesPeriod && <PeriodBar period={period} onChange={setPeriod} today={today} />}
        <main className="content">
          {error && <div className="span-2"><Alert>{error}</Alert></div>}
          <Suspense fallback={<PanelSkeleton />}>{body}</Suspense>
        </main>
      </div>
      <BottomNav tab={tab} onChange={changeTab} />
    </div>
  );
}
