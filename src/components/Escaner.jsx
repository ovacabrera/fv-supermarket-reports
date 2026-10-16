import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

// Lector de códigos: el del navegador si lo tiene (Chrome en Android), si no el de zxing en
// WebAssembly (iPhone, escritorio). El .wasm (~1 MB) va con el front y se baja recién al abrir
// la cámara por primera vez. zxing-wasm viene con barcode-detector.
async function crearDetector() {
  if ("BarcodeDetector" in window) {
    try {
      const soportados = await window.BarcodeDetector.getSupportedFormats();
      const formatos = FORMATOS.filter(f => soportados.includes(f));
      if (formatos.length) return new window.BarcodeDetector({ formats: formatos });
    } catch { /* se usa zxing */ }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  prepareZXingModule({ overrides: { locateFile: (path, prefix) => path.endsWith(".wasm") ? wasmUrl : prefix + path } });
  return new BarcodeDetector({ formats: FORMATOS });
}

function mensajeDeError(e) {
  if (!navigator.mediaDevices?.getUserMedia) return "La cámara solo anda con la dirección https del panel, no en la red local.";
  if (e?.name === "NotAllowedError") return "No hay permiso para usar la cámara. Habilitalo en los ajustes del navegador para este sitio.";
  if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") return "No se encontró una cámara en este equipo.";
  if (e?.name === "NotReadableError") return "La cámara la está usando otra aplicación.";
  return "No se pudo abrir la cámara.";
}

// Pantalla completa con la cámara trasera. Llama a onCodigo con el primer código que lee.
export function Escaner({ onCodigo, onCerrar }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let stream = null, timer = null, activo = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("sin cámara");
        const [s, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } }),
          crearDetector(),
        ]);
        if (!activo) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setListo(true);
        const leer = async () => {
          if (!activo) return;
          try {
            if (video.readyState >= 2) {
              const [c] = await detector.detect(video);
              if (c?.rawValue && activo) {
                activo = false;
                navigator.vibrate?.(60);
                onCodigo(c.rawValue.trim());
                return;
              }
            }
          } catch { /* cuadro sin leer: se prueba con el siguiente */ }
          timer = setTimeout(leer, 120);
        };
        leer();
      } catch (e) {
        if (activo) setError(mensajeDeError(e));
      }
    })();
    return () => {
      activo = false;
      clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [onCodigo]);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
      <video ref={videoRef} className="scan__video" playsInline muted />
      {!error && <div className="scan__frame" aria-hidden="true" />}
      <div className="scan__bar">
        <p className="scan__text" role="status">
          {error || (listo ? "Apuntá al código de barras" : "Abriendo la cámara…")}
        </p>
        <button type="button" className="btn btn--ghost" onClick={onCerrar}>
          <Icon name="close" size={20} />Cerrar
        </button>
      </div>
    </div>
  );
}
