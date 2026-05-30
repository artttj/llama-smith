#!/usr/bin/env node
// llama-smith — point it at a repo; a swarm of Ollama "Smiths" reads how it
// deploys, leaks, and breaks, the Oracle validates each finding against its
// cited file, and a self-learning <repo>-smith skill is forged. Thin CLI over lib/.
import { existsSync, readFileSync, writeFileSync, realpathSync } from 'node:fs'
import { resolve, join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile, execFileSync } from 'node:child_process'
import { runPipeline } from './lib/pipeline.mjs'
import { appendLesson } from './lib/lessons-store.mjs'

export const VERSION = '1.2.0'
const VERBS = new Set(['run', 'scan', 'forge', 'diff', 'serve'])

export function parseArgs(argv) {
  const args = { verb: 'run', path: '.', local: false, scanOnly: false, json: false, rounds: 2, oracle: true, missed: null, incremental: false, semantic: false, base: 'HEAD~1', head: 'HEAD', open: false, port: 7777, noServe: false }
  let verbSet = false
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--local') args.local = true
    else if (a === '--scan-only') args.scanOnly = true
    else if (a === '--json') args.json = true
    else if (a === '--no-oracle') args.oracle = false
    else if (a === '--missed' && i + 1 < argv.length && !argv[i + 1].startsWith('-')) args.missed = argv[++i]
    else if (a === '--incremental' || a === '--inc') args.incremental = true
    else if (a === '--semantic') args.semantic = true
    else if (a === '--base' && i + 1 < argv.length && !argv[i + 1].startsWith('-')) args.base = argv[++i]
    else if (a === '--head' && i + 1 < argv.length && !argv[i + 1].startsWith('-')) args.head = argv[++i]
    else if (a === '--rounds' && i + 1 < argv.length && !argv[i + 1].startsWith('-')) args.rounds = Math.max(1, parseInt(argv[++i], 10) || 2)
    else if (a === '--open') args.open = true
    else if (a === '--no-serve' || a === '--html-only') args.noServe = true
    else if (a === '--port' && i + 1 < argv.length && !argv[i + 1].startsWith('-')) { const p = parseInt(argv[++i], 10); args.port = Number.isInteger(p) && p > 0 && p < 65536 ? p : 7777 }
    else if (!verbSet && VERBS.has(a)) { args.verb = a; verbSet = true }
    else if (!a.startsWith('-')) args.path = a
  }
  return args
}

// Build the static dashboard from the current results, then (unless --no-serve)
// start the localhost server and optionally open a browser. Shared by the
// `serve` verb and the post-scan `--open` flow so both stay in lockstep.
async function buildAndServe(existing, { reportsDir, port, noServe, open }) {
  const { buildDashboard } = await import('./scripts/report.mjs')
  buildDashboard(existing, reportsDir)
  if (noServe) { console.log(`built ${existing.length} report page(s) → ${reportsDir}  (--no-serve: localhost not started)`); return }
  const { createDashboardServer } = await import('./scripts/serve.mjs')
  const { url } = await createDashboardServer(port, reportsDir)
  if (open) { try { execFile('open', [url], () => {}) } catch { console.log(`open ${url}`) } }
}

function repoIdentity(root) {
  let fullName = '', url = '', commits = 0, blurb = ''
  try {
    const remote = execFileSync('git', ['-C', root, 'config', '--get', 'remote.origin.url'], { encoding: 'utf8' }).trim().replace(/\.git$/, '')
    const m = remote.match(/([^/:]+\/[^/]+)$/)
    if (m) { fullName = m[1]; url = `https://github.com/${m[1]}` }
  } catch {}
  for (const f of ['package.json', 'composer.json']) {
    try { const j = JSON.parse(readFileSync(join(root, f), 'utf8')); if (!blurb && j.description) blurb = String(j.description); if (!fullName && j.name) fullName = String(j.name) } catch {}
  }
  if (!fullName) fullName = basename(root)
  if (!blurb) { for (const f of ['Cargo.toml', 'pyproject.toml']) { try { const t = readFileSync(join(root, f), 'utf8').match(/^description\s*=\s*"([^"]+)"/m); if (t) { blurb = t[1]; break } } catch {} } }
  try { commits = parseInt(execFileSync('git', ['-C', root, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim(), 10) || 0 } catch {}
  return { fullName, url, commits, blurb }
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
  if (args.verb === 'diff') {
    const { runPRScan } = await import('./lib/prscan.mjs')
    const pr = await runPRScan(root, { base: args.base, head: args.head, oracle: args.oracle, local: args.local })
    if (args.json) { console.log(JSON.stringify(pr, null, 2)); return }
    console.log(`llama-smith diff · ${args.base}...${args.head}`)
    console.log(`${pr.changed.length} changed file(s), ${pr.findings.length} finding(s)${pr.note ? ` — ${pr.note}` : ''}\n`)
    for (const f of pr.findings) console.log(`  [pr|${f.smith}/${f.severity}] ${f.text}${f.file ? `  (${f.file})` : ''}`)
    if (pr.changed.length) console.log(`\nwrote  → ${join(root, '.smith', 'pr-findings.json')}`)
    return
  }
  const LS = realpathSync(dirname(fileURLToPath(import.meta.url)))
  const reportsDir = join(LS, 'reports')
  const resultsFile = '/tmp/ls-results.json'

  if (args.verb === 'serve') {
    // Build a fresh dashboard first so a clean install (reports/ is gitignored, so a
    // fresh checkout ships none) shows a dashboard — an empty state when there are no
    // scans yet — instead of a 404. With --no-serve it just writes the HTML and exits.
    let existing = []
    try { existing = JSON.parse(readFileSync(resultsFile, 'utf8')) } catch { existing = [] }
    await buildAndServe(existing, { reportsDir, port: args.port, noServe: args.noServe, open: args.open })
    return
  }

  const opts = { local: args.local, rounds: args.rounds, oracle: args.oracle, semantic: args.semantic, scanOnly: args.scanOnly || args.verb === 'scan', incremental: args.incremental }
  const t0 = Date.now()
  const res = await runPipeline(root, opts)
  const scanSeconds = Math.max(1, Math.round((Date.now() - t0) / 1000))
  if (args.json) { console.log(JSON.stringify(res.json, null, 2)); return }

  console.log(`llama-smith · ${res.project}`)
  console.log(`${res.supported.length} operational findings (Oracle dropped ${res.dropped.length})\n`)
  for (const f of res.supported) console.log(`  [${f.smith}/${f.severity}] ${f.text}${f.file ? `  (${f.file})` : ''}`)
  if (res.hotspots.length) console.log(`\nhotspots: ${res.hotspots.map(h => `${h.file}:${h.edits}`).join(', ')}`)
  if (res.skillPath) console.log(`\nforged → ${res.skillPath}/  (SKILL.md + references/ + lessons.md)`)
  console.log(`wrote  → ${join(root, '.smith', 'findings.json')}`)

  if (args.open) {
    let existing = []
    try { existing = JSON.parse(readFileSync(resultsFile, 'utf8')) } catch { existing = [] }
    const ident = repoIdentity(root)
    const repoKey = ident.fullName.split('/').pop() || res.json.project
    const idx = existing.findIndex(r => r.repo === repoKey)
    const entry = { ...res.json, repo: repoKey, fullName: ident.fullName || res.json.project, group: 'interesting',
      url: ident.url, blurb: ident.blurb, commits: ident.commits,
      verdict: `${res.supported.length} file-cited operational findings${ident.commits ? ` across ${ident.commits.toLocaleString()} commits` : ''}, all validated against real files.`,
      scanSeconds }
    if (idx >= 0) existing[idx] = { ...existing[idx], ...entry }; else existing.push(entry)
    writeFileSync(resultsFile, JSON.stringify(existing, null, 2))
    await buildAndServe(existing, { reportsDir, port: args.port, noServe: args.noServe, open: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1) })
}
