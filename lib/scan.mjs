// The investigator swarm — three Smiths read how a repo deploys, leaks, and
// schedules, in parallel. No deterministic "scar" theater (churn is computed
// separately in the pipeline); kimi-k2.6 is reserved for the Oracle.
import { basename } from 'node:path'
import { dispatch } from './ollama.mjs'
import { listFiles, readSlice } from './git.mjs'

export const INVESTIGATORS = {
  deploy: 'glm-5.1:cloud',
  secret: 'deepseek-v4-pro:cloud',
  cron: 'qwen3.5:cloud',
}
// The architecture Smith is descriptive, not forensic — it maps what the app is
// and how it's built, so it runs once (not per recall round) on a strong model.
export const ARCHITECT_MODEL = 'glm-5.1:cloud'
const MAX_CONTEXT_FILES = 16

const PROMPTS = {
  deploy: `You are deploy-smith, a release forensics agent. Inspect the provided repo files (Makefile, CI configs, docker-compose, Dockerfile, deploy scripts, package/composer scripts). Determine how this project deploys and rolls back. Report ANOMALIES only: missing/partial rollback (e.g. skips media or db), manual-only deploy, no staging gate, destructive deploy steps, hardcoded hosts.`,
  secret: `You are secret-smith, a secrets-exposure agent. Inspect CI configs, env files, shell scripts, and compose files. Find secrets echoed into logs, committed credential values, tokens in plain text, or unsafe env handling. NEVER repeat a secret value — describe only the location and the risk.`,
  cron: `You are cron-smith, a background-jobs agent. Inspect crontab files, scheduler/queue config, compose cron services, and CI scheduled workflows. Find jobs that fail silently (2>/dev/null, no logging), overlapping schedules, jobs with no alerting, or long-running jobs with no lock.`,
}
const OUTPUT_RULE = `\nReturn ONLY JSON, no prose: {"anomalies":[{"kind":"<lane>","severity":"high|medium|low","text":"...","file":"path or null"}]}. If nothing notable, return {"anomalies":[]}.`
const MAX_MISSED_HINTS = 8

// Assemble one lane's full prompt. Pure: lane brief + output rule + repo context,
// plus a re-check block for findings the swarm missed on prior runs.
export function lanePrompt(lane, ctx, missedHints = []) {
  const base = `${PROMPTS[lane]}${OUTPUT_RULE}\n\n--- REPO CONTEXT ---\n${ctx}`
  if (!missedHints.length) return base
  const block = missedHints.slice(0, MAX_MISSED_HINTS).map(h => `- ${h}`).join('\n')
  return `${base}\n\nPREVIOUSLY MISSED — specifically re-check for these, they were missed before:\n${block}`
}

const RELEVANT = {
  deploy: [/^makefile$/i, /\.mk$/, /docker-compose.*\.ya?ml$/, /dockerfile/i, /deploy.*\.sh$/, /bitbucket-pipelines\.yml$/, /\.gitlab-ci\.yml$/, /\.github\/workflows\/.*\.ya?ml$/, /Procfile$/, /package\.json$/, /composer\.json$/, /fly\.toml$/, /vercel\.json$/, /bin\/(deploy|magento|console)/],
  secret: [/\.github\/workflows\/.*\.ya?ml$/, /\.env(\..*)?$/, /docker-compose.*\.ya?ml$/, /\.sh$/, /bitbucket-pipelines\.yml$/, /config.*\.(php|yml|yaml|json|env)$/],
  cron: [/crontab/i, /cron/i, /\.github\/workflows\/.*\.ya?ml$/, /supervisor.*\.conf$/, /docker-compose.*\.ya?ml$/, /schedule/i, /queue/i],
}

export function buildContext(root, files, patterns, limit = MAX_CONTEXT_FILES) {
  const matched = files.filter(f => patterns.some(re => re.test(f))).slice(0, limit)
  const parts = []
  for (const f of matched) {
    const body = readSlice(root, f)
    if (body.trim()) parts.push(`### FILE: ${f}\n${body}`)
  }
  return parts.join('\n\n') || '(no matching files found)'
}

// A compact two-level layout so the architecture pass sees monorepo shape
// (apps/*, packages/*) it would otherwise miss from a flat file match.
export function repoLayout(files) {
  const dirs = new Map()
  for (const f of files) {
    const seg = f.split('/').slice(0, 2).join('/')
    dirs.set(seg, (dirs.get(seg) || 0) + 1)
  }
  return [...dirs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([d, n]) => `${d} (${n})`).join('\n')
}

const stripThinking = t => t.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()

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
      text: a.text.trim(), file: a.file || null,
    }))
  } catch { return [] }
}

const SEV = { high: 0, medium: 1, low: 2 }
export const mergeFindings = all => [...all].sort((a, b) => (SEV[a.severity] ?? 1) - (SEV[b.severity] ?? 1))

const ARCH_AREAS = ['overview', 'modules', 'dataflow', 'datamodel', 'entrypoints', 'abstractions']
const ARCH_RELEVANT = [
  /readme/i, /(^|\/)AGENTS\.md$/i, /(^|\/)CLAUDE\.md$/i,
  /(^|\/)package\.json$/, /^composer\.json$/, /^pyproject\.toml$/, /^go\.mod$/, /^Cargo\.toml$/, /(^|\/)app\.json$/, /app\.config\.[jt]s$/,
  /(^|\/)(index|main|app|server|cli|bootstrap|mod)\.[a-z]+$/i, /(^|\/)src\/[^/]+\.[a-z]+$/i,
  /(^|\/)(app|lib|cmd|internal|pkg)\/[^/]+\.[a-z]+$/i, /artisan$/, /manage\.py$/,
  /(^|\/)migrations?\//i, /\.sql$/, /(^|\/)db\//i, /schema\.[a-z]+$/i, /drizzle\.config/i, /prisma\/schema/i,
  /(^|\/)(repositor(y|ies)|service|store|model|schema)s?\.[a-z]+$/i, /\/(data|domain|infrastructure)\/[^/]+\.[a-z]+$/i,
]
const ARCH_PROMPT = `You are architecture-smith, a senior engineer onboarding to this repo. From the provided files, explain what this application IS, what it DOES, and how it is built — the knowledge a newcomer needs that they could NOT get from a directory listing alone.

Report concise, factual map items. Describe capabilities and responsibilities ("X handles the OAuth token lifecycle"), never file trees. Cover, only where the files support it:
- overview: what the app is and the problem it solves
- modules: the main modules/layers and what each is responsible for
- dataflow: how a request or job flows through the system, entrypoint to output
- datamodel: the core data entities or domain models, how they relate, AND where they are persisted (database, migrations, files)
- entrypoints: the files where execution starts
- abstractions: the few core types or concepts a newcomer must understand

In a monorepo, name which workspace package (apps/*, packages/*) owns each thing. Existing AGENTS.md / README files are authoritative — prefer them.
Each item MUST cite ONE concrete file that demonstrates it. Do not invent; omit what the files do not show.`
const ARCH_OUTPUT = `\nReturn ONLY JSON, no prose: {"map":[{"area":"overview|modules|dataflow|datamodel|entrypoints|abstractions","claim":"...","file":"path"}]}. Every item needs a real file path. If you cannot tell, return {"map":[]}.`

export function parseArchitecture(raw) {
  if (!raw || !raw.trim()) return []
  const c = stripThinking(raw)
  const s = c.indexOf('{'), e = c.lastIndexOf('}')
  if (s === -1 || e === -1) return []
  try {
    const obj = JSON.parse(c.slice(s, e + 1))
    const list = Array.isArray(obj.map) ? obj.map : []
    return list.filter(a => a && typeof a.claim === 'string' && a.claim.trim()).map(a => ({
      area: ARCH_AREAS.includes(a.area) ? a.area : 'overview',
      claim: a.claim.trim(), file: a.file || null,
    }))
  } catch { return [] }
}

// One descriptive pass: map the application's architecture, cited to files.
export async function scanArchitecture(root, { local = false, host } = {}) {
  const files = listFiles(root)
  const model = local ? ARCHITECT_MODEL.replace(/:cloud$/, '') : ARCHITECT_MODEL
  const prompt = `${ARCH_PROMPT}${ARCH_OUTPUT}\n\n--- REPO (${basename(root)}) ---\n## LAYOUT (dir → file count)\n${repoLayout(files)}\n\n${buildContext(root, files, ARCH_RELEVANT, 24)}`
  const r = await dispatch(model, prompt, host)
  return r.success ? parseArchitecture(r.content) : []
}

const models = local => {
  const m = { ...INVESTIGATORS }
  if (local) for (const k of Object.keys(m)) m[k] = m[k].replace(/:cloud$/, '')
  return m
}

// One swarm pass: the three lanes dispatch concurrently. Returns merged findings + lane telemetry.
export async function scanRepo(root, { local = false, host, missedHints = [] } = {}) {
  const files = listFiles(root)
  const m = models(local)
  const label = `(${basename(root)})\n`
  const ctx = {
    deploy: label + buildContext(root, files, RELEVANT.deploy),
    secret: label + buildContext(root, files, RELEVANT.secret),
    cron: label + buildContext(root, files, RELEVANT.cron),
  }
  const mk = lane => lanePrompt(lane, ctx[lane], missedHints)
  const [d, s, c] = await Promise.all([
    dispatch(m.deploy, mk('deploy'), host),
    dispatch(m.secret, mk('secret'), host),
    dispatch(m.cron, mk('cron'), host),
  ])
  const findings = mergeFindings([
    ...(d.success ? parseSmithFindings(d.content, 'deploy') : []),
    ...(s.success ? parseSmithFindings(s.content, 'secret') : []),
    ...(c.success ? parseSmithFindings(c.content, 'cron') : []),
  ])
  const lanes = [
    { smith: 'deploy', model: m.deploy, ok: d.success, ms: d.ms },
    { smith: 'secret', model: m.secret, ok: s.success, ms: s.ms },
    { smith: 'cron', model: m.cron, ok: c.success, ms: c.ms },
  ]
  return { findings, lanes }
}
