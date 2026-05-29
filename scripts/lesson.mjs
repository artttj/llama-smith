// Record a lesson for a repo — the write side of the self-learning loop.
// A Claude Code Stop hook (or you, by hand) calls this after a session; the
// lesson lands in <repo>/.smith/lessons.json and folds into <repo>-smith's
// lessons.md on the next run.
//   node scripts/lesson.mjs <repo> "deploy from production, not main" [--observation]
// Default source is 'correction' (HIGH confidence). --observation enters LOW
// and graduates only if it recurs.
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { appendLesson } from '../lib/lessons-store.mjs'

const [, , repoArg, ...rest] = process.argv
const text = rest.filter(a => !a.startsWith('--')).join(' ').trim()
const source = rest.includes('--observation') ? 'observation' : 'correction'

if (!repoArg || !text) {
  console.error('usage: node scripts/lesson.mjs <repo> "<lesson>" [--observation]')
  process.exit(1)
}
const root = resolve(repoArg)
if (!existsSync(root)) { console.error(`no such path: ${root}`); process.exit(1) }
const lessons = appendLesson(root, { text, source, learned: new Date().toISOString().slice(0, 10) })
console.log(`recorded (${source}) — ${lessons.length} lesson(s) in ${root}/.smith/lessons.json`)
