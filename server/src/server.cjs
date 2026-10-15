const express = require("express");
const fs      = require("fs");
const path    = require("path");
const os      = require("os");
const http    = require("http");
const zlib    = require("zlib");
const { pathToFileURL } = require("url");
 
const app  = express();
const PORT = 3001;
 
// ─── Ruta al archivo según plataforma (o FV_DB_PATH) ─────────────────────────
const DB_PATH = process.env.FV_DB_PATH || (process.platform === "win32"
  ? "C:\\FacilVirtual\\data\\fvposdb.script"
  : path.join(os.homedir(), "Downloads", "fvposdb.script"));

// Parser, snapshot y lectura de la base son ESM (los mismos que usa scripts/export-snapshot.mjs).
const esm = file => import(pathToFileURL(path.join(__dirname, file)).href);
 
// ─── CORS: permite acceso desde cualquier origen (iPhone en WiFi incluido) ───
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
 
// ─── Sirve el build de React (dist/) ─────────────────────────────────────────
const DIST_PATH = path.join(__dirname, "../../dist");

app.use(express.static(DIST_PATH));
 
// ─── Endpoint: info del archivo DB ───────────────────────────────────────────
// `modified` es la escritura más nueva entre el .script y el .log.
app.get("/api/db-info", async (req, res) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ found: false, path: DB_PATH });
    }
    const { logPathFor } = await esm("readPosDb.mjs");
    const stat = fs.statSync(DB_PATH);
    const logStat = fs.existsSync(logPathFor(DB_PATH)) ? fs.statSync(logPathFor(DB_PATH)) : null;
    const modified = logStat && logStat.mtime > stat.mtime ? logStat.mtime : stat.mtime;
    res.json({
      found:    true,
      path:     DB_PATH,
      size:     stat.size,
      modified: modified.toISOString(),
      log:      logStat ? { size: logStat.size, modified: logStat.mtime.toISOString() } : null,
    });
  } catch (e) {
    res.status(500).json({ found: false, error: e.message });
  }
});
 
// ─── Endpoint: foto de la base (.script + .log), en el mismo formato que la publicada ──
app.get("/api/snapshot", async (req, res) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: "Archivo no encontrado", path: DB_PATH });
    }
    const [{ readPosDb }, { parseHSQL }, { encodeSnapshot }] = await Promise.all([
      esm("readPosDb.mjs"), esm("../../src/lib/parseHSQL.js"), esm("../../src/lib/snapshot.js"),
    ]);
    const { script, log, source } = readPosDb(DB_PATH);
    const gz = zlib.gzipSync(JSON.stringify(encodeSnapshot(parseHSQL({ script, log }), source)));
    res.setHeader("Content-Type", "application/gzip");
    res.send(gz);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── React SPA fallback ─────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(DIST_PATH, "index.html"));
});
 
// ─── IP local (para mostrar en consola, útil para iPhone) ────────────────────
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}
 
// ─── Inicio ───────────────────────────────────────────────────────────────────
const server = http.createServer(app);
server.listen(PORT, "0.0.0.0", () => {
  const localIP = getLocalIP();
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║      Panel de Ventas · FácilVirtual        ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║  PC:     http://localhost:${PORT}             ║`);
  console.log(`║  iPhone: http://${localIP}:${PORT}       ║`);
  console.log("╠════════════════════════════════════════════╣");
  if (fs.existsSync(DB_PATH)) {
    const stat = fs.statSync(DB_PATH);
    console.log(`║  ✓ BD encontrada:                          ║`);
    console.log(`║    ${DB_PATH.slice(0, 44).padEnd(44)}║`);
    console.log(`║    Modificado: ${stat.mtime.toLocaleDateString("es-AR").padEnd(29)}║`);
  } else {
    console.log(`║  ✗ BD no encontrada en:                    ║`);
    console.log(`║    ${DB_PATH.slice(0, 44).padEnd(44)}║`);
    console.log(`║    Usá el selector manual en el dashboard  ║`);
  }
  console.log("╚════════════════════════════════════════════╝\n");
});
 