import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";

// Copia un texto (el nombre de un artículo, para buscarlo en el POS sin tipearlo).
// navigator.clipboard solo anda con https o localhost: en la red local (http) se usa execCommand.
async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* sin portapapeles */ }
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text }) {
  const [estado, setEstado] = useState(null); // null | "ok" | "error"
  useEffect(() => {
    if (!estado) return;
    const t = setTimeout(() => setEstado(null), 1500);
    return () => clearTimeout(t);
  }, [estado]);
  return (
    <button type="button" className={`copy${estado === "ok" ? " is-ok" : ""}`}
      onClick={async () => setEstado((await copiar(text)) ? "ok" : "error")}
      aria-label={`Copiar "${text}"`} title="Copiar el nombre">
      <Icon name={estado === "ok" ? "check" : "copy"} size={18} />
      <span className="sr-only" aria-live="polite">{estado === "ok" ? "Copiado" : estado === "error" ? "No se pudo copiar" : ""}</span>
    </button>
  );
}
