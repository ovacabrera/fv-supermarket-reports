import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Consultor de precios público (sites/precios): otro sitio, otro build, sin nada de ventas.
//   npx vite --config vite.precios.config.js          desarrollo, con la lista de snapshot/precios.json.gz
//   npx vite build --config vite.precios.config.js    sale en sites/precios/dist (ver scripts/deploy-precios.mjs)

const LISTA_LOCAL = path.resolve('snapshot', 'precios.json.gz')

// En desarrollo, /data/precios.json sale de la última exportación local (lo que en producción hace la Function).
const datosLocales = {
  name: 'precios-locales',
  configureServer(server) {
    server.middlewares.use('/data/precios.json', (req, res) => {
      if (!fs.existsSync(LISTA_LOCAL)) { res.statusCode = 404; res.end('Falta snapshot/precios.json.gz: correr npm run snapshot'); return }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Content-Encoding', 'gzip')
      res.end(fs.readFileSync(LISTA_LOCAL))
    })
  },
}

export default defineConfig({
  root: 'sites/precios',
  plugins: [react(), datosLocales],
  build: { outDir: 'dist', emptyOutDir: true },
})
