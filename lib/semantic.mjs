import http from 'node:http'
import { OLLAMA_HOST } from './ollama.mjs'

export const EMBED_MODEL = process.env.LLAMA_SMITH_EMBED_MODEL || 'embeddinggemma'
export const SEMANTIC_THRESHOLD = 0.85
const TIMEOUT = 240
const SEVR = { high: 0, medium: 1, low: 2 }

export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function embedTexts(texts, { model = EMBED_MODEL, host = OLLAMA_HOST } = {}) {
  return new Promise((res, rej) => {
    const payload = JSON.stringify({ model, input: texts })
    const url = new URL('/api/embed', host)
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: TIMEOUT * 1000
    }, (r) => {
      let b = ''
      r.on('data', c => b += c)
      r.on('end', () => {
        try {
          const data = JSON.parse(b)
          if (data.error) throw new Error(data.error)
          if (!Array.isArray(data.embeddings)) throw new Error('no embeddings in response')
          res(data.embeddings)
        } catch (e) { rej(e) }
      })
    })
    req.on('error', rej)
    req.on('timeout', () => { req.destroy(); rej(new Error('timeout')) })
    req.write(payload)
    req.end()
  })
}

// Mirrors dedupeFindings's grouping (same smith + file) but swaps the Jaccard
// metric for embedding cosine similarity. Same merge rule: keep higher severity,
// tie-break on longer text. Embeds every text once, then collapses paraphrases.
export async function semanticDedupe(list, { embedFn, threshold = SEMANTIC_THRESHOLD }) {
  const vectors = await embedFn(list.map(f => f.text))
  const kept = []
  const keptVec = []
  for (let j = 0; j < list.length; j++) {
    const f = list[j]
    const v = vectors[j]
    const i = kept.findIndex((k, ki) =>
      k.smith === f.smith && (k.file || '') === (f.file || '') && cosineSimilarity(keptVec[ki], v) >= threshold)
    if (i === -1) { kept.push(f); keptVec.push(v); continue }
    const cur = kept[i]
    const better = (SEVR[f.severity] ?? 1) < (SEVR[cur.severity] ?? 1)
      || (f.severity === cur.severity && f.text.length > cur.text.length)
    if (better) { kept[i] = f; keptVec[i] = v }
  }
  return kept
}
