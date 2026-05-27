import http from 'node:http'

export const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
export const NUM_PREDICT = 3500
const TIMEOUT = 240

export function buildPayload(model, prompt, numPredict = NUM_PREDICT) {
  return JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, options: { num_predict: numPredict } })
}

export function parseOllamaResponse(body) {
  const data = JSON.parse(body)
  if (data.error) throw new Error(data.error)
  return { content: data.message?.content || data.message?.thinking || '', model: data.model }
}

function request(model, prompt, host, timeout) {
  return new Promise((res, rej) => {
    const payload = buildPayload(model, prompt)
    const url = new URL('/api/chat', host)
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: timeout * 1000
    }, (r) => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(parseOllamaResponse(b)) } catch (e) { rej(e) } }) })
    req.on('error', rej); req.on('timeout', () => { req.destroy(); rej(new Error('timeout')) })
    req.write(payload); req.end()
  })
}

export async function dispatch(model, prompt, host = OLLAMA_HOST, retries = 1) {
  const t0 = Date.now()
  let lastErr = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return { ...(await request(model, prompt, host, TIMEOUT)), success: true, ms: Date.now() - t0 } }
    catch (e) { lastErr = e; if (attempt < retries) await new Promise(r => setTimeout(r, 3000 * (attempt + 1))) }
  }
  return { success: false, error: lastErr?.message || 'unknown', ms: Date.now() - t0 }
}
