const express = require("express");
const fs      = require("fs");
const path    = require("path");
const os      = require("os");
const http    = require("http");
 
const app  = express();
const PORT = 3001;
 
// ─── Ruta al archivo según plataforma ────────────────────────────────────────
const DB_PATH = process.platform === "win32"
  ? "C:\\FacilVirtual\\data\\fvposdb.script"
  : path.join(os.homedir(), "Downloads", "fvposdb.script");
 
// ─── CORS: permite acceso desde cualquier origen (iPhone en WiFi incluido) ───
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
 
// ─── Sirve el build de React (dist/) ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")));
 
// ─── Endpoint: info del archivo DB ───────────────────────────────────────────
app.get("/api/db-info", (req, res) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ found: false, path: DB_PATH });
    }
    const stat = fs.statSync(DB_PATH);
    res.json({
      found:    true,
      path:     DB_PATH,
      size:     stat.size,
      modified: stat.mtime.toISOString(),
    });
  } catch (e) {
    res.status(500).json({ found: false, error: e.message });
  }
});
 
// ─── Endpoint: contenido del archivo DB ──────────────────────────────────────
app.get("/api/db", (req, res) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: "Archivo no encontrado", path: DB_PATH });
    }
    const content = fs.readFileSync(DB_PATH, "utf8");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(content);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
 