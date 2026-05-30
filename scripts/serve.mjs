import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, normalize, extname, dirname } from 'node:path'
import { realpathSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildDashboard, safeName } from './report.mjs'

const LS = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))))
const RESULTS_FILE = '/tmp/ls-results.json'
const TYPES = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

export function createDashboardServer(port = 7777, root = join(LS, 'reports')) {
  const server = createServer(async (req, res) => {
    let rel
    try { rel = decodeURIComponent((req.url || '/').split('?')[0]) }
    catch { res.writeHead(400, { 'Cache-Control': 'no-store' }).end('bad request'); return }
    if (rel === '/api/delete') {
      if (req.method !== 'POST') { res.writeHead(405, { 'Cache-Control': 'no-store' }).end('method not allowed'); return }
      if (req.headers['x-requested-with'] !== 'llama-smith') { res.writeHead(403, { 'Cache-Control': 'no-store' }).end('forbidden'); return }
      let raw = ''
      for await (const chunk of req) raw += chunk
      let repo
      try { repo = JSON.parse(raw).repo } catch { res.writeHead(400, { 'Cache-Control': 'no-store' }).end('bad json'); return }
      let results = []
      try { results = JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) } catch {}
      const idx = results.findIndex(x => x.repo === repo)
      if (idx < 0) { res.writeHead(404, { 'Cache-Control': 'no-store' }).end('unknown report'); return }
      const [removed] = results.splice(idx, 1)
      writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2))
      const htmlPath = normalize(join(root, `${safeName(removed.repo)}.html`))
      if (htmlPath.startsWith(root + '/')) { try { unlinkSync(htmlPath) } catch {} }
      buildDashboard(results, root)
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ ok: true, remaining: results.length }))
      return
    }
    if (rel.startsWith('/api/')) { res.writeHead(404, { 'Cache-Control': 'no-store' }).end('not found'); return }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { 'Cache-Control': 'no-store' }).end('method not allowed'); return }
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
  })
  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => {
      const url = `http://localhost:${port}`
      process.stdout.write(`serving ${root} at ${url}\n`)
      resolve({ server, url, port })
    })
  })
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const port = Number(process.argv[2]) || 7777
  const root = process.argv[3] || join(LS, 'reports')
  createDashboardServer(port, root)
}
