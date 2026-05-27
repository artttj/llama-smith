#!/usr/bin/env node
// llama-smith — Matrix-flavored repo-forensics swarm.
// Sends a swarm of Ollama "Smiths" through a repo, finds anomalies, forges a Claude Code skill.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'

export const VERSION = '0.1.0'
export const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'

// Cloud models are primary (no local models pulled). Each smith wears a different earpiece.
export const DEFAULT_MODELS = {
  deploy: 'glm-5.1:cloud',
  secret: 'kimi-k2.6:cloud',
  cron:   'qwen3.5:cloud',
  scar:   'deepseek-v4-flash:cloud'
}

const LANE_TIMEOUT = 240   // seconds
const NUM_PREDICT = 3500
const MAX_FILE_BYTES = 12000
const MAX_CONTEXT_FILES = 16

const VERBS = new Set(['scan', 'forge', 'diff'])

const PROMPTS = {
  deploy: `You are deploy-smith, a release forensics agent. Inspect the provided repo files (Makefile, CI configs, docker-compose, Dockerfile, deploy scripts, package/composer scripts). Determine how this project deploys and rolls back. Report ANOMALIES only: missing/partial rollback (e.g. skips media or db), manual-only deploy, no staging gate, destructive deploy steps, hardcoded hosts.`,
  secret: `You are secret-smith, a secrets-exposure agent. Inspect CI configs, env files, shell scripts, and compose files. Find secrets echoed into logs, committed credential values, tokens in plain text, or unsafe env handling. NEVER repeat a secret value — describe only the location and the risk.`,
  cron:   `You are cron-smith, a background-jobs agent. Inspect crontab files, scheduler/queue config, compose cron services, and CI scheduled workflows. Find jobs that fail silently (2>/dev/null, no logging), overlapping schedules, jobs with no alerting, or long-running jobs with no lock.`,
  scar:   `You are scar-smith. You are given PRE-COMPUTED repo scars as JSON (file, kind, value). Rewrite EACH into one short, striking sentence a developer would find revealing. Do not invent new scars. Keep file names exact.`
}

const OUTPUT_RULE = `\nReturn ONLY JSON, no prose: {"anomalies":[{"kind":"<lane>","severity":"high|medium|low","text":"...","file":"path or null"}]}. If nothing notable, return {"anomalies":[]}.`

// ---------- args ----------
export function parseArgs(argv) {
  const args = { verb: 'scan', path: '.', role: 'devsecops', local: false }
  let verbSet = false
  let i = 2
  while (i < argv.length) {
    const a = argv[i]
    if (a === '--local') { args.local = true; i++ }
    else if (a === '--role' && i + 1 < argv.length) { args.role = argv[++i]; i++ }
    else if (!verbSet && VERBS.has(a)) { args.verb = a; verbSet = true; i++ }
    else if (!a.startsWith('-')) { args.path = a; i++ }
    else { i++ }
  }
  if (!VERBS.has(args.verb)) throw new Error(`unknown verb: ${args.verb}`)
  return args
}

export function loadModels(opts = {}) {
  const m = { ...DEFAULT_MODELS }
  if (opts.local) for (const k of Object.keys(m)) m[k] = m[k].replace(/:cloud$/, '')
  return m
}

// ---------- git helpers ----------
function git(cmd, cwd) {
  try { return execSync(`git ${cmd}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 }) }
  catch { return '' }
}

// ---------- deterministic collectors ----------
export function collectChurn(nameOnlyLog) {
  const counts = new Map()
  for (const line of nameOnlyLog.split('\n')) {
    const f = line.trim()
    if (f) counts.set(f, (counts.get(f) || 0) + 1)
  }
  return [...counts.entries()].map(([file, changes]) => ({ file, changes })).sort((a, b) => b.changes - a.changes)
}

export function collectOwnership(perFileAuthors) {
  const out = []
  for (const [file, blob] of Object.entries(perFileAuthors)) {
    const names = blob.split('\n').map(s => s.trim()).filter(Boolean)
    const counts = new Map()
    for (const n of names) counts.set(n, (counts.get(n) || 0) + 1)
    const top = names.length ? Math.max(...counts.values()) : 0
    out.push({ file, authors: counts.size, topAuthorShare: names.length ? top / names.length : 0 })
  }
  return out
}

export function collectRhythm(hoursLog) {
  const hours = hoursLog.split('\n').map(s => s.trim()).filter(Boolean).map(Number)
  const afterHours = hours.filter(h => h >= 22 || h < 6).length
  const total = hours.length
  return { total, afterHours, afterHoursPct: total ? Math.round((afterHours / total) * 100) : 0 }
}

export function collectFixFeatRatio(subjects) {
  const lines = subjects.split('\n').map(s => s.trim()).filter(Boolean)
  const fixes = lines.filter(s => /^fix(\(|:|!)/.test(s)).length
  const feats = lines.filter(s => /^feat(\(|:|!)/.test(s)).length
  return { fixes, feats, ratio: feats ? Math.round((fixes / feats) * 10) / 10 : fixes }
}

export function complexityProxy(content) {
  const lines = content.split('\n').length
  const funcs = (content.match(/\bfunction\b|=>|\bdef\b|\bfunc\b|public function|private function/g) || []).length
  let depth = 0, maxNesting = 0
  for (const ch of content) {
    if (ch === '{') { depth++; if (depth > maxNesting) maxNesting = depth }
    else if (ch === '}') depth = Math.max(0, depth - 1)
  }
  return { lines, maxNesting, funcs }
}

const COMPLEX_LINES = 200
const COMPLEX_NESTING = 5

export function deriveScars(m) {
  const scars = []
  const cx = m.complexity || {}
  const isComplex = (f) => { const c = cx[f]; return c && (c.lines >= COMPLEX_LINES || c.maxNesting >= COMPLEX_NESTING) }
  for (const { file, changes } of (m.churn || [])) {
    if (changes >= 8 && isComplex(file)) {
      scars.push({ id: `hotspot:${file}`, kind: 'hotspot', severity: 'medium', value: changes, file,
        text: `${file} changed ${changes} times and is complex — a hotspot.` })
      const own = (m.ownership || []).find(o => o.file === file)
      const noTests = m.tests && m.tests[file] === false
      if (own && own.authors === 1 && noTests) {
        scars.push({ id: `fragile:${file}`, kind: 'fragile', severity: 'high', value: changes, file,
          text: `${file} is your most fragile point: ${changes} edits, one author, no tests.` })
      }
    }
  }
  if (m.drift && m.drift.drift) {
    const v = m.drift.versions
    scars.push({ id: 'drift:version', kind: 'drift', severity: 'medium', value: v, file: null,
      text: `Version drift: README (${v.readme}), Dockerfile (${v.dockerfile}), manifest (${v.manifest}) disagree.` })
  }
  if (m.rhythm && m.rhythm.afterHoursPct >= 25) {
    scars.push({ id: 'rhythm', kind: 'rhythm', severity: 'low', value: m.rhythm.afterHoursPct, file: null,
      text: `${m.rhythm.afterHoursPct}% of commits land after hours.` })
  }
  if (m.fixFeat && m.fixFeat.ratio >= 2 && m.fixFeat.feats >= 3) {
    scars.push({ id: 'fixfeat', kind: 'firefighting', severity: 'low', value: m.fixFeat.ratio, file: null,
      text: `${m.fixFeat.ratio} fixes per feature — lots of firefighting.` })
  }
  if (m.todos && m.todos.length >= 10) {
    scars.push({ id: 'todo', kind: 'todo', severity: 'low', value: m.todos.length, file: null,
      text: `${m.todos.length} TODO/FIXME markers in the tree.` })
  }
  return scars
}

export function collectVersionDrift(sources) {
  const grab = (s, re) => { const x = (s || '').match(re); return x ? x[1] : null }
  const versions = {
    readme: grab(sources.readme, /(?:php|node|python|ruby)[^\d]{0,4}(\d+\.\d+)/i),
    dockerfile: grab(sources.dockerfile, /:(\d+\.\d+)/),
    manifest: grab(sources.manifest, /(\d+\.\d+)/)
  }
  const found = Object.values(versions).filter(Boolean)
  return { versions, drift: found.length >= 2 && new Set(found).size > 1 }
}

// ---------- repo context gathering ----------
const RELEVANT = {
  deploy: [/^makefile$/i, /\.mk$/, /docker-compose.*\.ya?ml$/, /dockerfile/i, /deploy.*\.sh$/, /bitbucket-pipelines\.yml$/, /\.gitlab-ci\.yml$/, /\.github\/workflows\/.*\.ya?ml$/, /Procfile$/, /package\.json$/, /composer\.json$/, /fly\.toml$/, /vercel\.json$/, /bin\/(deploy|magento|console)/],
  secret: [/\.github\/workflows\/.*\.ya?ml$/, /\.env(\..*)?$/, /docker-compose.*\.ya?ml$/, /\.sh$/, /bitbucket-pipelines\.yml$/, /config.*\.(php|yml|yaml|json|env)$/],
  cron:   [/crontab/i, /cron/i, /\.github\/workflows\/.*\.ya?ml$/, /supervisor.*\.conf$/, /docker-compose.*\.ya?ml$/, /schedule/i, /queue/i]
}

function listFiles(root) {
  const tracked = git('ls-files', root).split('\n').map(s => s.trim()).filter(Boolean)
  if (tracked.length) return tracked
  // fallback: shallow walk
  const out = []
  const walk = (dir, depth) => {
    if (depth > 4) return
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.git') || e.name === 'node_modules' || e.name === 'vendor') continue
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full, depth + 1)
      else out.push(relative(root, full))
    }
  }
  try { walk(root, 0) } catch {}
  return out
}

function readSlice(root, file) {
  try {
    const full = join(root, file)
    const buf = readFileSync(full, 'utf8')
    return buf.length > MAX_FILE_BYTES ? buf.slice(0, MAX_FILE_BYTES) + '\n…(truncated)' : buf
  } catch { return '' }
}

function buildContext(root, files, patterns) {
  const matched = files.filter(f => patterns.some(re => re.test(f))).slice(0, MAX_CONTEXT_FILES)
  const parts = []
  for (const f of matched) {
    const body = readSlice(root, f)
    if (body.trim()) parts.push(`### FILE: ${f}\n${body}`)
  }
  return parts.join('\n\n') || '(no matching files found)'
}

// ---------- ollama dispatch (parallel) ----------
export function buildPayload(model, prompt, numPredict) {
  return JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, options: { num_predict: numPredict } })
}

export function parseOllamaResponse(body) {
  const data = JSON.parse(body)
  if (data.error) throw new Error(data.error)
  return { content: data.message?.content || data.message?.thinking || '', model: data.model }
}

function ollamaRequest(model, prompt, numPredict, timeout, host) {
  return new Promise((res, rej) => {
    const payload = buildPayload(model, prompt, numPredict)
    const url = new URL('/api/chat', host)
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: timeout * 1000
    }, (r) => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(parseOllamaResponse(b)) } catch (e) { rej(e) } }) })
    req.on('error', rej); req.on('timeout', () => { req.destroy(); rej(new Error('timeout')) })
    req.write(payload); req.end()
  })
}

async function dispatch(model, prompt, host, retries = 1) {
  const t0 = Date.now()
  let lastErr = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await ollamaRequest(model, prompt, NUM_PREDICT, LANE_TIMEOUT, host)
      return { ...r, success: true, ms: Date.now() - t0, attempts: attempt + 1 }
    } catch (e) {
      lastErr = e
      if (attempt < retries) await new Promise(r => setTimeout(r, 3000 * (attempt + 1)))
    }
  }
  return { success: false, error: lastErr?.message || 'unknown', ms: Date.now() - t0 }
}

// ---------- finding parse / merge ----------
function stripThinking(t) {
  return t.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()
}

export function parseSmithFindings(raw, smith) {
  if (!raw || !raw.trim()) return []
  const c = stripThinking(raw)
  const s = c.indexOf('{'), e = c.lastIndexOf('}')
  if (s === -1 || e === -1) return []
  try {
    const obj = JSON.parse(c.slice(s, e + 1))
    const list = Array.isArray(obj.anomalies) ? obj.anomalies : []
    return list.filter(a => a && typeof a.text === 'string' && a.text.trim()).map(a => ({
      smith, kind: a.kind || smith,
      severity: ['high', 'medium', 'low'].includes(a.severity) ? a.severity : 'medium',
      text: a.text.trim(), file: a.file || null
    }))
  } catch { return [] }
}

const SEV = { high: 0, medium: 1, low: 2 }
export function mergeAnomalies(all) { return [...all].sort((a, b) => (SEV[a.severity] ?? 1) - (SEV[b.severity] ?? 1)) }

export function narrateScars(scars, modelOutput) {
  const narrated = parseSmithFindings(modelOutput, 'scar')
  const byFile = new Map(narrated.filter(n => n.file).map(n => [n.file, n]))
  return scars.map(s => {
    const hit = s.file ? byFile.get(s.file) : null
    return { smith: 'scar', kind: s.kind, severity: s.severity, text: hit ? hit.text : s.text, file: s.file }
  })
}

// ---------- rendering ----------
const LINE = '─'.repeat(60)
export function renderTerminal(lanes, anomalies) {
  const laneLines = lanes.map(l => `  ${l.smith.padEnd(14)}[${l.model}]`.padEnd(46) + `${l.status}  ${l.ms}ms`).join('\n')
  const list = anomalies.length
    ? anomalies.map((a, i) => `${String(i + 1).padStart(2)}. ${a.smith.toUpperCase().padEnd(8)} ${a.text}${a.file ? `  (${a.file})` : ''}`).join('\n')
    : '  (no anomalies — clean system, or the Smiths found nothing)'
  return [
    'llama-smith · entering repo', LINE, '', 'wake up, dev...', '',
    `${lanes.length} smiths have entered the system`, '', laneLines, '', LINE, 'anomalies detected', '',
    list, '', LINE, 'forge project skill?', '', 'type: smith this repo'
  ].join('\n')
}

export function renderBrief(project, anomalies) {
  const lines = [`# llama-smith · ${project} (the construct)`, '', `Found ${anomalies.length} anomalies.`, '']
  for (const a of anomalies) lines.push(`- **${a.smith.toUpperCase()}** (${a.severity}): ${a.text}${a.file ? ` — \`${a.file}\`` : ''}`)
  return lines.join('\n') + '\n'
}

// ---------- memory + forge ----------
export function writeMemory(root, { sha, role, anomalies, brief }) {
  const dir = join(root, '.smith'); mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'last-run.json'), JSON.stringify({ sha, role, version: VERSION, timestamp: new Date().toISOString() }, null, 2))
  writeFileSync(join(dir, 'anomalies.json'), JSON.stringify(anomalies, null, 2))
  writeFileSync(join(dir, 'construct.md'), brief)
}

export function forgeSkill(root, project, role, anomalies) {
  const name = `${project}-${role === 'devsecops' ? 'devops' : role}`
  const dir = join(root, '.claude', 'skills', name); mkdirSync(dir, { recursive: true })
  const findings = anomalies.map(a => `- **${a.smith}** (${a.severity}): ${a.text}${a.file ? ` (\`${a.file}\`)` : ''}`).join('\n')
  const md = `---
name: ${name}
description: Project co-pilot for ${project}, forged by llama-smith. Knows how this repo deploys, where it is fragile, and where it leaks.
---

# ${project} co-pilot

Forged by llama-smith from a swarm scan of this repository.

## What the Smiths found

${findings || '- (no anomalies recorded)'}

## Operating rules (non-negotiable)

- Co-pilot mode: require the operator to type \`echo\` before acting on the system.
- Never act on production on its own. Production steps need explicit approval.
- Secrets are referenced by name only, never by value.
`
  const path = join(dir, 'SKILL.md'); writeFileSync(path, md)
  return path
}

// ---------- scan ----------
export async function runScan(root, opts = {}, host = OLLAMA_HOST) {
  const models = loadModels(opts)
  const files = listFiles(root)

  // deterministic metrics
  const churn = collectChurn(git('log --name-only --pretty=format: --since="1 year ago"', root))
  const subjects = git('log --pretty=format:%s --since="1 year ago"', root)
  const hours = git('log --pretty=format:%ad --date=format:%H --since="1 year ago"', root)
  const topChurn = churn.slice(0, 12)
  const perFileAuthors = {}, complexity = {}, tests = {}
  for (const { file } of topChurn) {
    perFileAuthors[file] = git(`log --pretty=format:%an -- "${file}"`, root)
    const full = join(root, file)
    if (existsSync(full)) { try { complexity[file] = complexityProxy(readFileSync(full, 'utf8')); tests[file] = /test|spec/i.test(file) } catch {} }
  }
  const todos = []
  const drift = collectVersionDrift({
    readme: readSlice(root, files.find(f => /readme/i.test(f)) || 'README.md'),
    dockerfile: readSlice(root, files.find(f => /dockerfile/i.test(f)) || 'Dockerfile'),
    manifest: readSlice(root, files.find(f => /composer\.json$|package\.json$/.test(f)) || 'package.json')
  })
  const metrics = { churn, ownership: collectOwnership(perFileAuthors), rhythm: collectRhythm(hours),
    fixFeat: collectFixFeatRatio(subjects), complexity, tests, todos, drift }
  const scars = deriveScars(metrics)

  // build per-smith context
  const ctx = {
    deploy: buildContext(root, files, RELEVANT.deploy),
    secret: buildContext(root, files, RELEVANT.secret),
    cron: buildContext(root, files, RELEVANT.cron)
  }
  const mk = (lane) => `${PROMPTS[lane]}${OUTPUT_RULE}\n\n--- REPO CONTEXT (${basename(root)}) ---\n${ctx[lane]}`
  const scarPrompt = `${PROMPTS.scar}${OUTPUT_RULE}\n\n--- SCARS ---\n${JSON.stringify(scars)}`

  // PARALLEL dispatch — the swarm enters at once
  const [deployR, secretR, cronR, scarR] = await Promise.all([
    dispatch(models.deploy, mk('deploy'), host),
    dispatch(models.secret, mk('secret'), host),
    dispatch(models.cron, mk('cron'), host),
    dispatch(models.scar, scarPrompt, host)
  ])

  const deploy = deployR.success ? parseSmithFindings(deployR.content, 'deploy') : []
  const secret = secretR.success ? parseSmithFindings(secretR.content, 'secret') : []
  const cron = cronR.success ? parseSmithFindings(cronR.content, 'cron') : []
  const scar = narrateScars(scars, scarR.success ? scarR.content : '')

  const anomalies = mergeAnomalies([...deploy, ...secret, ...cron, ...scar])
  const lanes = [
    { smith: 'deploy-smith', model: models.deploy, status: deployR.success ? (deploy.length ? 'anomaly' : 'clean') : `FAIL(${deployR.error})`, ms: deployR.ms },
    { smith: 'secret-smith', model: models.secret, status: secretR.success ? (secret.length ? 'anomaly' : 'clean') : `FAIL(${secretR.error})`, ms: secretR.ms },
    { smith: 'cron-smith', model: models.cron, status: cronR.success ? (cron.length ? 'anomaly' : 'clean') : `FAIL(${cronR.error})`, ms: cronR.ms },
    { smith: 'scar-smith', model: models.scar, status: scarR.success ? (scar.length ? 'anomaly' : 'clean') : `FAIL(${scarR.error})`, ms: scarR.ms }
  ]
  const project = basename(root)
  return { project, anomalies, scars, lanes, terminal: renderTerminal(lanes, anomalies), brief: renderBrief(project, anomalies) }
}

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv)
  const root = resolve(args.path)
  if (!existsSync(root)) { console.error(`no such path: ${root}`); process.exit(1) }
  const project = basename(root)

  if (args.verb === 'scan') {
    const { terminal } = await runScan(root, args)
    console.log(terminal)
  } else if (args.verb === 'forge') {
    const { anomalies, brief, terminal } = await runScan(root, args)
    console.log(terminal)
    const sha = git('rev-parse HEAD', root).trim()
    const skillPath = forgeSkill(root, project, args.role, anomalies)
    writeMemory(root, { sha, role: args.role, anomalies, brief })
    console.log(`\nforged: ${skillPath}\nwrote:  ${join(root, '.smith')}/`)
  } else if (args.verb === 'diff') {
    console.log('diff is phase 2 — not implemented in MVP')
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1) })
}
