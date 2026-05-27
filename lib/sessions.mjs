// Memory Matrix — locate a repo's Claude Code session transcripts and distill
// them into compact "moments" (prompts, commands, errors) with timestamps.

import { readdirSync, readFileSync, existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export const PROJECTS_DIR = join(homedir(), '.claude', 'projects')

// Claude Code names a project dir by slugifying the cwd: / and . → -
export function slugifyPath(p) {
  return p.replace(/[/.]/g, '-')
}

export function findSessions(repoPath, projectsDir = PROJECTS_DIR) {
  const candidates = new Set([repoPath])
  try { candidates.add(realpathSync(repoPath)) } catch { /* path may not exist in tests */ }
  for (const p of candidates) {
    const dir = join(projectsDir, slugifyPath(p))
    if (!existsSync(dir)) continue
    try {
      const files = readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => join(dir, f))
      if (files.length) return files
    } catch { /* try next candidate */ }
  }
  return []
}

const SECRET = /(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/g
const scrub = (s) => s.replace(SECRET, '«secret»')

// Distill a raw .jsonl transcript into compact moments. Pure (takes the text).
export function distillSession(jsonl) {
  const moments = []
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    let o
    try { o = JSON.parse(line) } catch { continue }
    const ts = o.timestamp || null
    if (o.type === 'user') {
      const c = o.message?.content
      if (typeof c === 'string') {
        const t = c.trim()
        if (t && !t.startsWith('<')) moments.push({ kind: 'prompt', ts, text: scrub(t).slice(0, 400) })
      } else if (Array.isArray(c)) {
        for (const b of c) {
          if (b.type === 'text' && b.text?.trim()) moments.push({ kind: 'prompt', ts, text: scrub(b.text).slice(0, 400) })
          if (b.type === 'tool_result' && b.is_error) {
            const t = typeof b.content === 'string' ? b.content : JSON.stringify(b.content)
            moments.push({ kind: 'error', ts, text: scrub(t).slice(0, 300) })
          }
        }
      }
    } else if (o.type === 'assistant') {
      const c = o.message?.content
      if (Array.isArray(c)) for (const b of c) {
        if (b.type === 'tool_use' && b.name === 'Bash' && b.input?.command) {
          moments.push({ kind: 'cmd', ts, text: scrub(b.input.command).slice(0, 200) })
        }
      }
    }
  }
  return moments
}

// Read + distill all sessions for a repo, newest file first, capped.
export function gatherMoments(repoPath, { projectsDir = PROJECTS_DIR, maxMoments = 220 } = {}) {
  const files = findSessions(repoPath, projectsDir)
  let moments = []
  for (const f of files) {
    try { moments = moments.concat(distillSession(readFileSync(f, 'utf8'))) } catch { /* skip */ }
  }
  // prefer errors + prompts (the signal), then cap
  const errs = moments.filter(m => m.kind === 'error')
  const rest = moments.filter(m => m.kind !== 'error')
  return [...errs, ...rest].slice(0, maxMoments)
}
