// The Self-Learning Memory store — an append-only journal that
// graduates into confidence-ranked instincts (the memory-block pattern behind
// MemGPT / Letta and the claude-mem continuous-learning loop, scoped to one repo).
// Journal at .smith/lessons.json. Corrections pin HIGH ("correct once, never
// again"); mined observations enter LOW and graduate toward HIGH as they recur.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const file = root => join(root, '.smith', 'lessons.json')
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
// Confidence as a number — shared with the skill renderer so graduation thresholds can't drift.
export const num = c => typeof c === 'number' ? c : ({ high: 0.9, medium: 0.7, low: 0.4 }[c] ?? 0.5)
// A missed finding enters above an observation but below a pinned correction; it
// graduates toward 0.95 on recurrence, like an observation.
export const MISSED_CONFIDENCE = 0.7

export function readLessons(root) {
  const p = file(root)
  if (!existsSync(p)) return []
  try { const l = JSON.parse(readFileSync(p, 'utf8')); return Array.isArray(l) ? l : [] }
  catch { return [] }
}

// Append/merge a lesson. source 'correction' => HIGH and pinned; 'observation' => LOW,
// graduating on repeat via a bounded Bayesian-style bump. Deduped by normalized text.
export function appendLesson(root, { text, kind = 'decision', paths = [], source = 'correction', learned = null }) {
  if (!text || !text.trim()) throw new Error('lesson text required')
  const lessons = readLessons(root)
  const hit = lessons.find(l => norm(l.text || l.pattern) === norm(text))
  if (hit) {
    const cur = num(hit.confidence)
    hit.count = (hit.count || 1) + 1
    hit.confidence = source === 'correction'
      ? 0.9
      : Math.min(0.95, (cur * (hit.count - 1) + 0.4) / hit.count + 0.18)  // recurrence graduates it
    if (source === 'missed') hit.kind = 'missed'
    if (learned) hit.learned = learned
  } else {
    const entryKind = source === 'missed' ? 'missed' : kind
    const entryConf = source === 'correction' ? 0.9 : source === 'missed' ? MISSED_CONFIDENCE : 0.4
    lessons.push({ text: text.trim(), pattern: text.trim(), kind: entryKind, paths, source, learned, count: 1, confidence: entryConf })
  }
  mkdirSync(join(root, '.smith'), { recursive: true })
  writeFileSync(file(root), JSON.stringify(lessons, null, 2))
  return lessons
}
