// Findings that survive scan after scan are likely real: a secret exposed across
// three scans is still exposed. Track each finding's identity in .smith/history.json
// and bump severity once it persists. All logic here is pure — timestamps are the
// scan's scannedAt, passed in, never read from the clock.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export const ESCALATE_AFTER = 3
const BUMP = { low: 'medium', medium: 'high' }

const file = root => join(root, '.smith', 'history.json')
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

// Stable identity: sha1 of smith+file+normalized text, first 12 hex chars.
export const findingKey = f =>
  createHash('sha1').update(`${f.smith}\0${f.file || ''}\0${norm(f.text)}`).digest('hex').slice(0, 12)

export function readHistory(root) {
  const p = file(root)
  if (!existsSync(p)) return {}
  try { const h = JSON.parse(readFileSync(p, 'utf8')); return h && typeof h === 'object' ? h : {} }
  catch { return {} }
}

export function writeHistory(root, hist) {
  mkdirSync(join(root, '.smith'), { recursive: true })
  writeFileSync(file(root), JSON.stringify(hist, null, 2))
}

// Pure: fold this scan's findings into a NEW history. Reappearance bumps count and
// lastSeen; a new key starts at 1. Findings absent this scan are carried unchanged.
export function recordScan(history, findings, { scannedAt }) {
  const next = { ...history }
  for (const f of findings) {
    const key = findingKey(f)
    const prior = next[key]
    next[key] = prior
      ? { ...prior, lastSeen: scannedAt, count: prior.count + 1 }
      : { firstSeen: scannedAt, lastSeen: scannedAt, count: 1, severity: f.severity, smith: f.smith, file: f.file || null, text: f.text }
  }
  return next
}

// Pure: return NEW finding objects, bumping one level for any finding seen >= threshold
// times that is not already high. Run against the history AFTER recordScan so the
// third appearance escalates on its own scan. Untouched findings are returned as-is.
export function escalate(findings, history, { threshold = ESCALATE_AFTER } = {}) {
  return findings.map(f => {
    const count = history[findingKey(f)]?.count ?? 0
    if (count < threshold || f.severity === 'high') return f
    return { ...f, severity: BUMP[f.severity] || f.severity, escalated: true, seenCount: count }
  })
}
