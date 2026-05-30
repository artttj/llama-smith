import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, normalize, extname, dirname } from 'node:path'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const LS = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))))
const port = Number(process.argv[2]) || 7777
const root = process.argv[3] || join(LS, 'reports')
const TYPES = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

createServer(async (req, res) => {
  let rel
  try { rel = decodeURIComponent((req.url || '/').split('?')[0]) }
  catch { res.writeHead(400, { 'Cache-Control': 'no-store' }).end('bad request'); return }
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html'
  const path = normalize(join(root, rel))
  if (path !== root && !path.startsWith(root + '/')) { res.writeHead(403).end('forbidden'); return }
  try {
    const body = await readFile(path)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
    }).end(body)
  } catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'EISDIR') { res.writeHead(500, { 'Cache-Control': 'no-store' }).end('server error'); return }
    res.writeHead(404, { 'Cache-Control': 'no-store' }).end('not found')
  }
}).listen(port, '127.0.0.1', () => process.stdout.write(`serving ${root} at http://localhost:${port}\n`))
