// Tiny static server for the dashboard with no-store caching, so a plain
// browser refresh always shows the freshly generated HTML.
// Usage: node scripts/serve.mjs [port] [dir]
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { realpathSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const LS = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))))
const port = Number(process.argv[2]) || 7777
const root = process.argv[3] || join(LS, 'reports')
const TYPES = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

createServer(async (req, res) => {
  let rel = decodeURIComponent((req.url || '/').split('?')[0])
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html'
  const path = normalize(join(root, rel))
  if (!path.startsWith(root)) { res.writeHead(403).end('forbidden'); return }
  try {
    const body = await readFile(path)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
    }).end(body)
  } catch {
    res.writeHead(404, { 'Cache-Control': 'no-store' }).end('not found')
  }
}).listen(port, '127.0.0.1', () => process.stdout.write(`serving ${root} at http://localhost:${port}\n`))
