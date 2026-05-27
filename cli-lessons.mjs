#!/usr/bin/env node
import { resolve, join, basename } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gatherMoments } from './lib/sessions.mjs'
import { buildLessonPrompt, parseLessons } from './lib/lessons.mjs'
import { dispatch as realDispatch } from './lib/ollama.mjs'

export async function mineLessons(repoPath, { dispatchFn = realDispatch, host, local = false } = {}) {
  const moments = gatherMoments(repoPath)
  if (!moments.length) return { project: basename(repoPath), moments: 0, lessons: [] }
  const model = local ? 'glm-5.1' : 'glm-5.1:cloud'
  const r = await dispatchFn(model, buildLessonPrompt(moments, basename(repoPath)), host)
  const lessons = r.success ? parseLessons(r.content) : []
  return { project: basename(repoPath), moments: moments.length, lessons }
}

function writeLessons(repoPath, lessons) {
  const dir = join(repoPath, '.smith')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'lessons.json'), JSON.stringify(lessons, null, 2))
}

async function main() {
  const args = process.argv.slice(2)
  const local = args.includes('--local')
  const path = args.find(a => !a.startsWith('-') && a !== 'lessons') || '.'
  const root = resolve(path)
  const { project, moments, lessons } = await mineLessons(root, { local })
  writeLessons(root, lessons)
  console.log(`\nmemory matrix · ${project} · ${moments} session moments → ${lessons.length} lessons\n`)
  for (const l of lessons) {
    const when = l.learned ? `  (learned ${l.learned.slice(0, 16).replace('T', ' ')})` : ''
    console.log(`  ⟐ [${l.kind}] ${l.text}${when}`)
    if (l.paths.length) console.log(`     ${l.paths.join(', ')}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1) })
}
