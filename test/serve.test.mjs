import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'
import { createDashboardServer } from '../scripts/serve.mjs'

const get = (port, path) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, res => {
    let body = ''
    res.on('data', c => (body += c))
    res.on('end', () => resolve({ status: res.statusCode, body }))
  })
  req.on('error', reject)
  req.end()
})

test('serves files under root and blocks path traversal', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ls-serve-'))
  writeFileSync(join(root, 'index.html'), '<h1>ok</h1>')
  const { server } = await createDashboardServer(0, root)
  const { port } = server.address()
  try {
    assert.equal((await get(port, '/')).status, 200, 'root resolves to index.html')
    assert.equal((await get(port, '/index.html')).status, 200, 'explicit file served')
    assert.equal((await get(port, '/../../../etc/passwd')).status, 403, 'literal ../ traversal blocked')
    assert.equal((await get(port, '/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd')).status, 403, 'percent-encoded traversal blocked')
    assert.equal((await get(port, '/nope.html')).status, 404, 'missing file returns 404, not 500')
  } finally {
    server.close()
    rmSync(root, { recursive: true, force: true })
  }
})
