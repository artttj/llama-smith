// The Oracle — a single strong model re-reads each LLM finding against the
// actual content of its cited file and drops anything the file does not support.
// High recall comes from the investigator swarm; precision comes from here.
import { resolve, join } from 'node:path'
import { dispatch } from './ollama.mjs'
import { readSlice } from './git.mjs'

export const ORACLE_MODEL = 'kimi-k2.6:cloud'
const MAX_FILE = 8000

const prompt = (f, body) => `You are the Oracle, a strict validator for a repo-forensics tool.
A scanner reported this operational-risk finding:

FINDING: ${f.text}
CITED FILE: ${f.file}

Actual content of ${f.file}:
--- BEGIN FILE ---
${body}
--- END FILE ---

Decide: does this file's real content SUPPORT the finding? Be strict — if the file
does not clearly demonstrate what the finding claims, it is NOT supported.
Return ONLY JSON, no prose: {"supported": true, "reason": "<one short sentence>"}`

export function parseVerdict(raw) {
  const c = (raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  const s = c.indexOf('{'), e = c.lastIndexOf('}')
  if (s === -1 || e === -1) return { supported: true, reason: 'unparseable verdict — kept' }
  try {
    const o = JSON.parse(c.slice(s, e + 1))
    return { supported: o.supported !== false, reason: String(o.reason || '').trim() }
  } catch { return { supported: true, reason: 'unparseable verdict — kept' } }
}

// Validate findings in parallel (bounded). Fail-open on network/parse errors so a
// blip never silently drops a real finding; fail-closed only on an explicit
// unsupported verdict or a missing cited file.
export async function validateFindings(root, findings, { model = ORACLE_MODEL, host, concurrency = 4 } = {}) {
  const queue = findings.map((f, i) => ({ f, i }))
  const out = new Array(findings.length)
  const fileCache = new Map()  // findings often share a cited file; read it once
  const slice = file => fileCache.has(file) ? fileCache.get(file) : fileCache.set(file, readSlice(root, file)).get(file)
  const rootAbs = resolve(root)
  // The cited path comes from model output — never read outside the repo.
  const withinRepo = file => { const p = resolve(join(root, file)); return p === rootAbs || p.startsWith(rootAbs + '/') }
  const worker = async () => {
    let item
    while ((item = queue.shift())) {
      const { f, i } = item
      if (!f.file) { out[i] = { ...f, oracle: { supported: true, reason: 'no file to verify against' } }; continue }
      if (!withinRepo(f.file)) { out[i] = { ...f, oracle: { supported: false, reason: 'cited path escapes the repo' } }; continue }
      const body = slice(f.file)
      if (!body || !body.trim()) { out[i] = { ...f, oracle: { supported: false, reason: 'cited file not found in repo' } }; continue }
      const r = await dispatch(model, prompt(f, body.slice(0, MAX_FILE)), host)
      out[i] = { ...f, oracle: r.success ? parseVerdict(r.content) : { supported: true, reason: `oracle error (${r.error}) — kept` } }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, findings.length)) }, worker))
  return out
}

export const keepSupported = validated => validated.filter(f => f.oracle?.supported !== false)
