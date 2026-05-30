#!/usr/bin/env node
// llama-smith — point it at a repo; a swarm of Ollama "Smiths" reads how it
// deploys, leaks, and breaks, the Oracle validates each finding against its
// cited file, and a self-learning <repo>-smith skill is forged. Thin CLI over lib/.
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runPipeline } from './lib/pipeline.mjs'
import { appendLesson } from './lib/lessons-store.mjs'

export const VERSION = '0.2.0'
const VERBS = new Set(['run', 'scan', 'forge', 'diff'])

export function parseArgs(argv) {
  const args = { verb: 'run', path: '.', local: false, scanOnly: false, json: false, rounds: 2, oracle: true, missed: null }
  let verbSet = false
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--local') args.local = true
    else if (a === '--scan-only') args.scanOnly = true
    else if (a === '--json') args.json = true
    else if (a === '--no-oracle') args.oracle = false
    else if (a === '--missed' && i + 1 < argv.length && !argv[i + 1].startsWith('-')) args.missed = argv[++i]
    else if (a === '--rounds' && i + 1 < argv.length) args.rounds = Math.max(1, parseInt(argv[++i], 10) || 2)
    else if (!verbSet && VERBS.has(a)) { args.verb = a; verbSet = true }
    else if (!a.startsWith('-')) args.path = a
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv)
  const root = resolve(args.path)
  if (!existsSync(root)) { console.error(`no such path: ${root}`); process.exit(1) }
  if (args.missed) {
    const lessons = appendLesson(root, { text: args.missed, source: 'missed', learned: new Date().toISOString().slice(0, 10) })
    console.log(`recorded (missed) — ${lessons.length} lesson(s) in ${root}/.smith/lessons.json`)
    return
  }
  const opts = { local: args.local, rounds: args.rounds, oracle: args.oracle, scanOnly: args.scanOnly || args.verb === 'scan' }
  const res = await runPipeline(root, opts)
  if (args.json) { console.log(JSON.stringify(res.json, null, 2)); return }

  console.log(`llama-smith · ${res.project}`)
  console.log(`${res.supported.length} operational findings (Oracle dropped ${res.dropped.length})\n`)
  for (const f of res.supported) console.log(`  [${f.smith}/${f.severity}] ${f.text}${f.file ? `  (${f.file})` : ''}`)
  if (res.hotspots.length) console.log(`\nhotspots: ${res.hotspots.map(h => `${h.file}:${h.edits}`).join(', ')}`)
  if (res.skillPath) console.log(`\nforged → ${res.skillPath}/  (SKILL.md + references/ + lessons.md)`)
  console.log(`wrote  → ${join(root, '.smith', 'findings.json')}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1) })
}
