#!/usr/bin/env node
import { resolve, join } from 'node:path'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { renderDashboard } from './lib/dashboard.mjs'
import { vibeScore } from './lib/vibe.mjs'

function readJSON(p) {
  try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null } catch { return null }
}

export function buildDashboard(repoPaths) {
  const manifests = []
  for (const rp of repoPaths) {
    const m = readJSON(join(rp, '.smith', 'manifest.json'))
    if (!m) continue
    const lessons = readJSON(join(rp, '.smith', 'lessons.json')) || []
    m._lessons = lessons
    m._vibe = vibeScore(m, { lessons })
    manifests.push(m)
  }
  return { html: renderDashboard(manifests), count: manifests.length }
}

async function main() {
  const argv = process.argv.slice(2)
  const noOpen = argv.includes('--no-open')
  const repos = argv.filter(a => !a.startsWith('-') && a !== 'dashboard').map(a => resolve(a))
  if (!repos.length) { console.error('usage: cli-dashboard.mjs <repo> [repo...]'); process.exit(1) }
  const { html, count } = buildDashboard(repos)
  const outDir = join(homedir(), 'Documents', 'llama-smith-reports')
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, 'dashboard.html')
  writeFileSync(out, html)
  console.log(`The Construct · ${count} repos → ${out}`)
  if (!noOpen) execFile('open', [out], () => {})
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1) })
}
