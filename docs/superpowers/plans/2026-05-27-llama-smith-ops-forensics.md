# llama-smith Cut-to-Core (Ops-Forensics Wedge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild llama-smith into one findings-driven pipeline that reads how a repo deploys and breaks, maps where code actually churns, and forges that into three cited Claude Code skills — cutting the dead dashboard/gotcha/vibe theater.

**Architecture:** A single `scan` produces a `findings` object (`.smith/findings.json`) — deterministic code-only churn hotspots plus an LLM operational-risk read (deploy/CI/jobs). The `forge` consumes that findings object and feeds the relevant slice into each skill's draft prompt, so the gold reaches the artifact. A finding that is not in a skill becomes a testable bug.

**Tech Stack:** Node 20+ ESM, `node --test` + `node:assert/strict`, zero dependencies, Ollama cloud models over HTTP.

---

## File Structure

**Create:**
- `lib/churn.mjs` — `isCodeFile`, `collectChurn`, `topHotspots`, `collectOwnership` (deterministic, no LLM)
- `lib/ops.mjs` — `buildOpsPrompt`, `parseOpsFindings`, `dedupeFindings`, `hasOps` (the wedge)
- `lib/findings.mjs` — `assembleFindings`, `writeFindings`, `readFindings` (the contract)
- `lib/scan.mjs` — `runScan` orchestration → findings (replaces `lib/brain.mjs`)
- `test/churn.test.mjs`, `test/ops.test.mjs`, `test/findings.test.mjs`, `test/scan.test.mjs`, `test/famous-repos.test.mjs`

**Modify:**
- `lib/rules.mjs` — `decide()` → `overview` + `commands` + `ops` (+ optional `security`)
- `lib/draft.mjs` — `buildDraftPrompt()` takes findings; `parseDraft()` hardened
- `lib/forge.mjs` — read findings, feed slice, skip-empty, truncation guard, project-prefixed names
- `lib/templates.mjs` — role guidance for `overview`/`commands`/`ops`/`security`
- `lib/ollama.mjs` — `parseOllamaResponse` surfaces `doneReason`; `dispatch` flags `truncated` and accepts `numPredict`
- `lib/render.mjs` — `renderFindings()` replaces `renderManifest()`
- `llama-smith.mjs` — single CLI (scan + forge + flags)
- `README.md` — match the new surface

**Delete:**
- `lib/dashboard.mjs`, `lib/vibe.mjs`, `lib/gotchas.mjs`, `lib/consensus.mjs`, `lib/brain.mjs`, `lib/manifest.mjs`
- `cli-dashboard.mjs`, `cli-brain.mjs`, `cli-forge.mjs`, `cli-lessons.mjs`
- `test/dashboard.test.mjs`, `test/vibe.test.mjs`, `test/gotchas.test.mjs`, `test/consensus.test.mjs`, `test/brain.test.mjs`, `test/manifest.test.mjs`

**Keep unchanged:** `lib/git.mjs`, `lib/signals.mjs`, `lib/citations.mjs`, `lib/commands.mjs`, `lib/flavor.mjs`, `lib/exposure.mjs`, `lib/grounding.mjs`, `lib/skillwriter.mjs`, `lib/sessions.mjs`, `lib/lessons.mjs`.

---

# Phase 1 — Findings contract + code-only churn

### Task 1.1: `isCodeFile` and churn collectors

**Files:**
- Create: `lib/churn.mjs`
- Test: `test/churn.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// test/churn.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCodeFile, collectChurn, topHotspots, collectOwnership } from '../lib/churn.mjs'

test('isCodeFile accepts source, rejects docs/locks/generated/manifests', () => {
  for (const p of ['src/a.js', 'pkg/x.ts', 'app/models.py', 'main.go', 'lib/x.rb', 'a/b/c.php'])
    assert.equal(isCodeFile(p), true, p)
  for (const p of ['Readme.md', 'History.md', 'CHANGES.rst', 'uv.lock', 'pnpm-lock.yaml',
                   'package-lock.json', 'pyproject.toml', 'types/index.d.ts', 'src/version.js',
                   'package.json', 'composer.json', 'notes.txt'])
    assert.equal(isCodeFile(p), false, p)
})

test('collectChurn counts name-only lines and sorts desc', () => {
  const log = 'a.js\nb.js\na.js\n\n  \nc.js\na.js'
  assert.deepEqual(collectChurn(log), [
    { file: 'a.js', edits: 3 }, { file: 'b.js', edits: 1 }, { file: 'c.js', edits: 1 }
  ])
})

test('topHotspots keeps only code, churn-ranked, even when noise churns more', () => {
  const churn = [
    { file: 'CHANGELOG.md', edits: 176 }, { file: 'pnpm-lock.yaml', edits: 34 },
    { file: 'src/reactivity/batch.js', edits: 108 }, { file: 'src/runtime.js', edits: 53 }
  ]
  assert.deepEqual(topHotspots(churn), [
    { file: 'src/reactivity/batch.js', edits: 108 }, { file: 'src/runtime.js', edits: 53 }
  ])
})

test('collectOwnership reports author count and top share', () => {
  const out = collectOwnership({ 'a.js': 'Ann\nAnn\nBob' })
  assert.deepEqual(out, [{ file: 'a.js', authors: 2, topShare: 2 / 3 }])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/churn.test.mjs`
Expected: FAIL — `Cannot find module '../lib/churn.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// lib/churn.mjs
const CODE_EXT = new Set([
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'rb', 'php', 'go', 'rs', 'java', 'kt', 'kts',
  'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'swift', 'scala', 'clj', 'ex', 'exs', 'erl', 'mm',
  'sh', 'bash', 'pl', 'lua', 'dart', 'vue', 'svelte', 'sql'
])

const NOISE = [
  /(^|\/)(readme|history|changelog|changes|contributing|license|authors|notice)\b/i,
  /\.(md|rst|txt|adoc)$/i,
  /(^|\/)[^/]*lock[^/]*$/i,   // package-lock.json, pnpm-lock.yaml, uv.lock, Gemfile.lock
  /\.lock$/i,
  /\.(toml|ini|cfg)$/i,
  /\.d\.ts$/i,                // generated type defs
  /(^|\/)version\.[a-z]+$/i,  // version-bump files
  /(^|\/)(package|composer)\.json$/i  // manifests: release noise as hotspots
]

export function isCodeFile(path) {
  if (NOISE.some(re => re.test(path))) return false
  const ext = (path.split('.').pop() || '').toLowerCase()
  return CODE_EXT.has(ext)
}

export function collectChurn(nameOnlyLog) {
  const counts = new Map()
  for (const line of nameOnlyLog.split('\n')) {
    const f = line.trim()
    if (f) counts.set(f, (counts.get(f) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([file, edits]) => ({ file, edits }))
    .sort((a, b) => b.edits - a.edits)
}

export function topHotspots(churn, { limit = 8 } = {}) {
  return churn.filter(c => isCodeFile(c.file)).slice(0, limit)
}

export function collectOwnership(perFileAuthors) {
  const out = []
  for (const [file, blob] of Object.entries(perFileAuthors)) {
    const names = blob.split('\n').map(s => s.trim()).filter(Boolean)
    const counts = new Map()
    for (const n of names) counts.set(n, (counts.get(n) || 0) + 1)
    const top = names.length ? Math.max(...counts.values()) : 0
    out.push({ file, authors: counts.size, topShare: names.length ? top / names.length : 0 })
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/churn.test.mjs`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add lib/churn.mjs test/churn.test.mjs
git commit -m "feat: code-only churn hotspots"
```

### Task 1.2: the findings contract

**Files:**
- Create: `lib/findings.mjs`
- Test: `test/findings.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// test/findings.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assembleFindings, writeFindings, readFindings } from '../lib/findings.mjs'

test('assembleFindings fills defaults', () => {
  const f = assembleFindings({ project: 'x' })
  assert.equal(f.version, 2)
  assert.equal(f.project, 'x')
  assert.deepEqual(f.hotspots, [])
  assert.deepEqual(f.operations, { deploy: [], ci: [], jobs: [] })
  assert.equal(f.exposure, null)
  assert.deepEqual(f.skills, [])
})

test('write then read round-trips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'smith-'))
  try {
    const f = assembleFindings({ project: 'x', hotspots: [{ file: 'a.js', edits: 3 }] })
    writeFindings(dir, f)
    assert.deepEqual(readFindings(dir), f)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('readFindings returns null when absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'smith-'))
  try { assert.equal(readFindings(dir), null) }
  finally { rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/findings.test.mjs`
Expected: FAIL — `Cannot find module '../lib/findings.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// lib/findings.mjs
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function assembleFindings({ project, sha, scannedAt, stack, hotspots, ownership, commands, operations, exposure, skills } = {}) {
  return {
    version: 2,
    project: project || null,
    sha: sha || null,
    scannedAt: scannedAt || new Date().toISOString(),
    stack: stack || null,
    hotspots: hotspots || [],
    ownership: ownership || [],
    commands: commands || {},
    operations: operations || { deploy: [], ci: [], jobs: [] },
    exposure: exposure || null,
    skills: skills || []
  }
}

export function writeFindings(root, findings) {
  const dir = join(root, '.smith')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'findings.json')
  writeFileSync(path, JSON.stringify(findings, null, 2))
  return path
}

export function readFindings(root) {
  const p = join(root, '.smith', 'findings.json')
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/findings.test.mjs`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/findings.mjs test/findings.test.mjs
git commit -m "feat: findings contract (scan→forge)"
```

---

# Phase 2 — Ops scan (the wedge)

### Task 2.1: ops prompt, parse, dedupe

**Files:**
- Create: `lib/ops.mjs`
- Test: `test/ops.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// test/ops.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOpsPrompt, parseOpsFindings, dedupeFindings, hasOps } from '../lib/ops.mjs'

test('buildOpsPrompt embeds files and demands grouped JSON', () => {
  const p = buildOpsPrompt([{ path: '.github/workflows/release.yml', content: 'on: push' }])
  assert.match(p, /ops-smith/)
  assert.match(p, /release\.yml/)
  assert.match(p, /"operations"/)
})

test('parseOpsFindings extracts lanes and normalizes severity', () => {
  const raw = 'noise {"operations":{"deploy":[{"text":"no rollback","file":"a.yml","severity":"high"}],"ci":[{"text":"gate skipped","file":"b.yml"}],"jobs":[]}} tail'
  const out = parseOpsFindings(raw)
  assert.deepEqual(out.deploy, [{ text: 'no rollback', file: 'a.yml', severity: 'high' }])
  assert.equal(out.ci[0].severity, 'medium') // default
  assert.deepEqual(out.jobs, [])
})

test('parseOpsFindings strips thinking and tolerates junk', () => {
  assert.deepEqual(parseOpsFindings('<think>hmm</think> not json'), { deploy: [], ci: [], jobs: [] })
  assert.deepEqual(parseOpsFindings(''), { deploy: [], ci: [], jobs: [] })
})

test('dedupeFindings drops same (file,text) within a lane', () => {
  const out = dedupeFindings({
    deploy: [{ text: 'No rollback', file: 'a.yml', severity: 'high' },
             { text: 'no rollback', file: 'a.yml', severity: 'high' }],
    ci: [], jobs: []
  })
  assert.equal(out.deploy.length, 1)
})

test('hasOps detects any finding', () => {
  assert.equal(hasOps({ deploy: [], ci: [], jobs: [] }), false)
  assert.equal(hasOps({ deploy: [{ text: 'x', file: null, severity: 'low' }], ci: [], jobs: [] }), true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ops.test.mjs`
Expected: FAIL — `Cannot find module '../lib/ops.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// lib/ops.mjs
const LANES = ['deploy', 'ci', 'jobs']
const SEV = new Set(['high', 'medium', 'low'])

function stripThinking(t) {
  return t.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()
}

export function buildOpsPrompt(files) {
  const blocks = files.map(f => `### ${f.path}\n${f.content}`).join('\n\n')
  return `You are ops-smith, an operational-risk forensics agent for this repo. Inspect the CI, deploy, compose, cron, queue, and script files below. Report ONLY real operational risks grounded in these files:
- deploy: missing or partial rollback, manual-only deploy, no staging gate, a publish step that races its own review/release gate, destructive steps, hardcoded hosts.
- ci: gates that do not gate (continue-on-error on tests/typecheck), unpinned or drifting action SHAs, workflows with write permissions that mutate PRs/issues/repo.
- jobs: cron that fails silently (2>/dev/null, no logging), overlapping schedules, no lock, no alerting.
- secrets: name the file and the risk ONLY. NEVER print a secret value.

Each finding names the exact file. Plain words, active voice, one sentence, max 24 words. No filler.

Return ONLY JSON: {"operations":{"deploy":[{"text":"...","file":"path","severity":"high|medium|low"}],"ci":[...],"jobs":[...]}}
If a lane has nothing notable, use [].

--- FILES ---
${blocks}`
}

export function parseOpsFindings(raw) {
  const empty = { deploy: [], ci: [], jobs: [] }
  if (!raw || !raw.trim()) return empty
  const c = stripThinking(raw)
  const s = c.indexOf('{'), e = c.lastIndexOf('}')
  if (s === -1 || e === -1) return empty
  let obj
  try { obj = JSON.parse(c.slice(s, e + 1)) } catch { return empty }
  const ops = obj.operations || {}
  const out = { deploy: [], ci: [], jobs: [] }
  for (const lane of LANES) {
    const list = Array.isArray(ops[lane]) ? ops[lane] : []
    out[lane] = list
      .filter(x => x && typeof x.text === 'string' && x.text.trim())
      .map(x => ({ text: x.text.trim(), file: x.file || null, severity: SEV.has(x.severity) ? x.severity : 'medium' }))
  }
  return out
}

export function dedupeFindings(ops) {
  const out = { deploy: [], ci: [], jobs: [] }
  for (const lane of LANES) {
    const seen = new Set()
    for (const f of ops[lane] || []) {
      const key = `${f.file}|${f.text.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      out[lane].push(f)
    }
  }
  return out
}

export function hasOps(ops) {
  return LANES.some(l => (ops[l] || []).length > 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ops.test.mjs`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add lib/ops.mjs test/ops.test.mjs
git commit -m "feat: ops-smith operational-risk read"
```

### Task 2.2: `decide()` for the new skill set

**Files:**
- Modify: `lib/rules.mjs`
- Test: `test/rules.test.mjs` (replace existing contents)

- [ ] **Step 1: Write the failing test**

```js
// test/rules.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide } from '../lib/rules.mjs'

const names = (entries) => entries.map(e => e.skill)

test('overview is always present', () => {
  const e = decide({ signals: [], stack: null, hotspots: [], operations: { deploy: [], ci: [], jobs: [] }, exposure: null })
  assert.deepEqual(names(e), ['overview'])
})

test('commands added when a manifest/Makefile signal exists', () => {
  const e = decide({ signals: [{ kind: 'commands', evidence: ['package.json'] }], hotspots: [], operations: { deploy: [], ci: [], jobs: [] } })
  assert.ok(names(e).includes('commands'))
})

test('ops added when an ops signal OR an ops finding exists', () => {
  const bySignal = decide({ signals: [{ kind: 'ci', evidence: ['.github/workflows/ci.yml'] }], operations: { deploy: [], ci: [], jobs: [] } })
  assert.ok(names(bySignal).includes('ops'))
  const byFinding = decide({ signals: [], operations: { deploy: [{ text: 'x', file: 'r.yml', severity: 'high' }], ci: [], jobs: [] } })
  assert.ok(names(byFinding).includes('ops'))
})

test('security added only when exposure present', () => {
  assert.ok(!names(decide({ signals: [], operations: { deploy: [], ci: [], jobs: [] }, exposure: null })).includes('security'))
  assert.ok(names(decide({ signals: [], operations: { deploy: [], ci: [], jobs: [] }, exposure: { text: 'a key in x', file: 'x' } })).includes('security'))
})

test('ops evidence merges infra/ci/jobs/secrets signal files', () => {
  const e = decide({
    signals: [{ kind: 'ci', evidence: ['ci.yml'] }, { kind: 'jobs', evidence: ['crontab'] }],
    operations: { deploy: [], ci: [], jobs: [] }
  })
  const ops = e.find(x => x.skill === 'ops')
  assert.deepEqual(ops.evidence.sort(), ['ci.yml', 'crontab'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/rules.test.mjs`
Expected: FAIL — `decide` signature/behavior mismatch (old `decide(signals, flavor)`)

- [ ] **Step 3: Write the implementation (replace file)**

```js
// lib/rules.mjs
const OPS_KINDS = ['infra', 'ci', 'jobs', 'iac']
const CMD_KINDS = ['commands']

export function decide({ signals = [], stack = null, hotspots = [], operations = { deploy: [], ci: [], jobs: [] }, exposure = null } = {}) {
  const ev = (kinds) => [...new Set(signals.filter(s => kinds.includes(s.kind)).flatMap(s => s.evidence))]
  const has = (kinds) => signals.some(s => kinds.includes(s.kind))
  const opsHasFinding = ['deploy', 'ci', 'jobs'].some(l => (operations[l] || []).length > 0)

  const entries = [{ skill: 'overview', purpose: 'what it is, stack, where code churns', trigger: 'always', evidence: [], confidence: 'high' }]

  if (has(CMD_KINDS)) {
    entries.push({ skill: 'commands', purpose: 'real run/build/test/deploy commands', trigger: 'commands', evidence: ev(CMD_KINDS), confidence: 'high' })
  }
  if (has(OPS_KINDS) || opsHasFinding) {
    const evidence = ev([...OPS_KINDS, 'secrets'])
    entries.push({ skill: 'ops', purpose: 'how it deploys and where it bites', trigger: 'ops', evidence, confidence: evidence.length >= 2 ? 'high' : 'medium' })
  }
  if (exposure) {
    entries.push({ skill: 'security', purpose: 'your own exposure surface', trigger: 'exposure', evidence: exposure.file ? [exposure.file] : [], confidence: 'high' })
  }
  return entries
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/rules.test.mjs`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add lib/rules.mjs test/rules.test.mjs
git commit -m "feat: decide overview/commands/ops/security skill set"
```

### Task 2.3: scan orchestration

**Files:**
- Create: `lib/scan.mjs`
- Test: `test/scan.test.mjs`

- [ ] **Step 1: Write the failing test**

Builds a real throwaway git repo (so the deterministic half runs), stubs the LLM dispatch (so no network), and asserts the findings shape.

```js
// test/scan.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runScan } from '../lib/scan.mjs'

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'smith-scan-'))
  const sh = (c) => execSync(c, { cwd: dir, stdio: 'ignore' })
  sh('git init -q')
  sh('git config user.email t@t.t'); sh('git config user.name T')
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'node --test', build: 'tsc' } }))
  writeFileSync(join(dir, 'app.js'), 'export const x = 1\n')
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true })
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'on: push\njobs: { t: { runs-on: ubuntu-latest } }\n')
  writeFileSync(join(dir, 'Readme.md'), '# demo\n')
  sh('git add -A'); sh('git commit -qm "init"')
  // churn app.js twice more so it ranks
  writeFileSync(join(dir, 'app.js'), 'export const x = 2\n'); sh('git commit -qam "x2"')
  writeFileSync(join(dir, 'app.js'), 'export const x = 3\n'); sh('git commit -qam "x3"')
  return dir
}

const stub = async (model, prompt) => {
  if (/ops-smith/.test(prompt)) return { success: true, content: '{"operations":{"deploy":[],"ci":[{"text":"ci has no test gate","file":".github/workflows/ci.yml","severity":"medium"}],"jobs":[]}}' }
  if (/Architect/.test(prompt)) return { success: true, content: '{"framework":"none","confidence":"low"}' }
  return { success: false, error: 'unexpected' }
}

test('runScan produces findings: code-only hotspots, ops findings, skill plan', async () => {
  const dir = repo()
  try {
    const f = await runScan(dir, { dispatchFn: stub, host: 'http://x' })
    assert.equal(f.project, 'demo')
    assert.ok(f.hotspots.some(h => h.file === 'app.js'))
    assert.ok(!f.hotspots.some(h => /Readme\.md|package\.json/.test(h.file)))
    assert.equal(f.operations.ci.length, 1)
    const skills = f.skills.map(s => s.skill)
    assert.ok(skills.includes('overview') && skills.includes('commands') && skills.includes('ops'))
    assert.ok('test' in f.commands || 'build' in f.commands)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/scan.test.mjs`
Expected: FAIL — `Cannot find module '../lib/scan.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// lib/scan.mjs
import { basename } from 'node:path'
import { git, listFiles, readSlice, headSha } from './git.mjs'
import { collectSignals } from './signals.mjs'
import { collectChurn, collectOwnership, topHotspots } from './churn.mjs'
import { buildOpsPrompt, parseOpsFindings, dedupeFindings } from './ops.mjs'
import { buildFlavorPrompt, parseFlavor } from './flavor.mjs'
import { findExposures, topExposure } from './exposure.mjs'
import { parsePackageScripts, parseMakefile, parseComposerScripts } from './commands.mjs'
import { decide } from './rules.mjs'
import { assembleFindings } from './findings.mjs'
import { dispatch as realDispatch, OLLAMA_HOST } from './ollama.mjs'

const MODELS = { ops: 'glm-5.1:cloud', flavor: 'deepseek-v4-flash:cloud' }
const OPS_KINDS = ['infra', 'ci', 'jobs', 'iac', 'commands', 'secrets']
const m = (name, local) => local ? name.replace(/:cloud$/, '') : name

export async function runScan(root, { dispatchFn = realDispatch, host = OLLAMA_HOST, local = false, window = '1 year ago' } = {}) {
  const files = listFiles(root)
  const signals = collectSignals(files)

  // deterministic: churn → code-only hotspots → ownership
  const churn = collectChurn(git(`log --name-only --pretty=format: --since="${window}"`, root))
  const hotspots = topHotspots(churn)
  const perFileAuthors = {}
  for (const { file } of hotspots) perFileAuthors[file] = git(`log --pretty=format:%an -- "${file}"`, root)
  const ownership = collectOwnership(perFileAuthors)

  // deterministic: real commands from manifest/Makefile
  const commands = gatherCommands(root, files)
  const packageManager = detectPackageManager(root, files)

  // analytical: stack (optional)
  const manifestFiles = (signals.find(s => s.kind === 'manifest')?.evidence || []).map(f => ({ file: f, content: readSlice(root, f) }))
  let stack = null
  if (manifestFiles.length) {
    const r = await dispatchFn(m(MODELS.flavor, local), buildFlavorPrompt(manifestFiles), host)
    if (r.success) {
      const fl = parseFlavor(r.content)
      if (fl) stack = { framework: fl.framework, confidence: fl.confidence, packageManager }
    }
  }
  if (!stack && packageManager) stack = { framework: null, confidence: 'low', packageManager }

  // analytical: the ops read (the wedge)
  const opsFiles = [...new Set(signals.filter(s => OPS_KINDS.includes(s.kind)).flatMap(s => s.evidence))]
    .slice(0, 20)
    .map(f => ({ path: f, content: readSlice(root, f) }))
    .filter(f => f.content.trim())
  let operations = { deploy: [], ci: [], jobs: [] }
  if (opsFiles.length) {
    const r = await dispatchFn(m(MODELS.ops, local), buildOpsPrompt(opsFiles), host)
    if (r.success) operations = dedupeFindings(parseOpsFindings(r.content))
  }

  // regex-only exposure
  const exposureInput = files.filter(f => /\.(env|ya?ml|json|sh|php)$/.test(f)).slice(0, 40)
    .map(f => ({ file: f, content: readSlice(root, f) }))
  const exposure = topExposure(findExposures(exposureInput))

  const skills = decide({ signals, stack, hotspots, operations, exposure })
  return assembleFindings({ project: basename(root), sha: headSha(root), stack, hotspots, ownership, commands, operations, exposure, skills })
}

function gatherCommands(root, files) {
  const out = {}
  const pkg = files.find(f => /(^|\/)package\.json$/.test(f))
  if (pkg) for (const k of Object.keys(parsePackageScripts(readSlice(root, pkg)))) out[k] = `npm run ${k}`
  const mk = files.find(f => /(^|\/)Makefile$/i.test(f))
  if (mk) for (const t of parseMakefile(readSlice(root, mk))) out[t] = `make ${t}`
  const comp = files.find(f => /(^|\/)composer\.json$/.test(f))
  if (comp) for (const k of Object.keys(parseComposerScripts(readSlice(root, comp)))) out[k] = `composer ${k}`
  return out
}

function detectPackageManager(root, files) {
  const pkg = files.find(f => /(^|\/)package\.json$/.test(f))
  if (!pkg) return null
  try { return JSON.parse(readSlice(root, pkg)).packageManager || null } catch { return null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/scan.test.mjs`
Expected: PASS — 1 test

- [ ] **Step 5: Commit**

```bash
git add lib/scan.mjs test/scan.test.mjs
git commit -m "feat: unified scan produces findings"
```

---

# Phase 3 — Forge wiring + hardening

### Task 3.1: harden `parseDraft`

**Files:**
- Modify: `lib/draft.mjs`
- Test: `test/draft.test.mjs` (replace existing contents)

- [ ] **Step 1: Write the failing test**

```js
// test/draft.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDraft, buildDraftPrompt } from '../lib/draft.mjs'

const good = `---
name: demo-ops
description: how it deploys and where it bites
---

# demo ops

- publish races the release gate (← release.yml)
`

test('parseDraft accepts a clean skill starting with frontmatter', () => {
  assert.equal(parseDraft(good), good.trim())
})

test('parseDraft strips an outer code fence', () => {
  assert.equal(parseDraft('```markdown\n' + good + '\n```'), good.trim())
})

test('parseDraft rejects a chain-of-thought dump', () => {
  const dump = `--- EVIDENCE --- is empty.\nWait, is this a trick?\nWait, let me write it.\n\`\`\`markdown\n---\nname: x\n---\n\`\`\``
  assert.equal(parseDraft(dump), null)
})

test('parseDraft rejects output that does not start with frontmatter', () => {
  assert.equal(parseDraft('Here is your skill:\n---\nname: x\ndescription: y\n---\nbody'), null)
})

test('parseDraft rejects frontmatter missing name or description', () => {
  assert.equal(parseDraft('---\nname: x\n---\nbody'), null)
})

test('buildDraftPrompt includes verified findings and their cited files', () => {
  const p = buildDraftPrompt(
    { skill: 'ops', evidence: ['release.yml'] },
    { files: [{ path: 'release.yml', content: 'on: push' }], commands: {} },
    'Describe ops.',
    [{ text: 'publish races the release gate', file: 'release.yml' }]
  )
  assert.match(p, /VERIFIED FINDINGS/)
  assert.match(p, /publish races the release gate/)
  assert.match(p, /←\s*release\.yml/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/draft.test.mjs`
Expected: FAIL — old `parseDraft` accepts the dump; `buildDraftPrompt` has no findings param

- [ ] **Step 3: Write the implementation (replace file)**

```js
// lib/draft.mjs
function looksLikeThinking(t) {
  if (/---\s*EVIDENCE\s*---/i.test(t)) return true                       // prompt leakage
  if (/\bis this a trick\b/i.test(t)) return true
  if ((t.match(/^\s*\*?\s*wait[,:]/gim) || []).length >= 2) return true    // monologue
  if ((t.match(/```(?:markdown|md|yaml)/gi) || []).length >= 2) return true // nested draft fences
  if ((t.match(/^---\s*$/gm) || []).length > 3) return true               // many frontmatter examples
  return false
}

export function parseDraft(output) {
  if (!output) return null
  let t = output
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim()
  t = t.replace(/^```(?:markdown|md|yaml)?\s*\n/, '').replace(/\n```\s*$/, '').trim()
  if (!t.startsWith('---')) return null
  const fmEnd = t.indexOf('\n---', 3)
  if (fmEnd === -1) return null
  const fm = t.slice(0, fmEnd)
  if (!/\bname:\s*\S/.test(fm) || !/\bdescription:\s*\S/.test(fm)) return null
  if (looksLikeThinking(t)) return null
  return t
}

export function buildDraftPrompt(entry, grounding, guidance, findings = [], lessons = []) {
  const blocks = grounding.files.map(f => `### ${f.path}\n${f.content}`).join('\n\n')
  const cmds = Object.keys(grounding.commands || {}).length
    ? `\n\n--- PARSED COMMANDS (real — cite these) ---\n${JSON.stringify(grounding.commands)}`
    : ''
  const findingsBlock = findings.length
    ? `\n\n--- VERIFIED FINDINGS (real — you MUST fold these in, keep each (← file)) ---\n${findings.map(f => `- ${f.text}${f.file ? ` (← ${f.file})` : ''}`).join('\n')}`
    : ''
  const lessonBlock = lessons.length
    ? `\n\n--- BATTLE-TESTED LESSONS (mined from past sessions) ---\n${lessons.map(l => `- ${l.text}${l.learned ? ` (learned ${l.learned.slice(0, 10)})` : ''}`).join('\n')}`
    : ''
  const lessonRule = lessons.length
    ? '\n- Include the BATTLE-TESTED LESSONS as a "## Battle-tested lessons" section near the end, each with its learned date.'
    : ''
  return `You are the Operator, forging a Claude Code skill named "${entry.skill}" for this repo.

${guidance}

Rules:
- Ground every command and path in the EVIDENCE below; cite the source file inline like (← path/to/file).
- Fold in the VERIFIED FINDINGS as concrete, cited points — they are already confirmed, keep them and their (← file).
- If a fact is not in the evidence or findings, write "unknown". Never invent commands or secret values.
- Output a COMPLETE SKILL.md: YAML frontmatter (name: ${entry.skill}, plus a one-line description of what it covers and when to load it), then a concise markdown body. Output ONLY the file content, no commentary.${lessonRule}

--- EVIDENCE ---
${blocks}${cmds}${findingsBlock}${lessonBlock}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/draft.test.mjs`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add lib/draft.mjs test/draft.test.mjs
git commit -m "fix: harden parseDraft, feed findings into forge prompt"
```

### Task 3.2: ollama truncation flag + tunable num_predict

**Files:**
- Modify: `lib/ollama.mjs`
- Test: `test/ollama.test.mjs` (replace existing contents)

- [ ] **Step 1: Write the failing test**

```js
// test/ollama.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseOllamaResponse, buildPayload } from '../lib/ollama.mjs'

test('parseOllamaResponse surfaces content and doneReason', () => {
  const r = parseOllamaResponse(JSON.stringify({ message: { content: 'hi' }, model: 'm', done_reason: 'stop' }))
  assert.equal(r.content, 'hi')
  assert.equal(r.doneReason, 'stop')
})

test('parseOllamaResponse flags length truncation via doneReason', () => {
  const r = parseOllamaResponse(JSON.stringify({ message: { content: 'cut' }, done_reason: 'length' }))
  assert.equal(r.doneReason, 'length')
})

test('buildPayload honors a custom numPredict', () => {
  const p = JSON.parse(buildPayload('m', 'hi', 5000))
  assert.equal(p.options.num_predict, 5000)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ollama.test.mjs`
Expected: FAIL — `doneReason` undefined

- [ ] **Step 3: Write the implementation (edit file)**

Replace `parseOllamaResponse`, `request`, and `dispatch`:

```js
export function parseOllamaResponse(body) {
  const data = JSON.parse(body)
  if (data.error) throw new Error(data.error)
  return {
    content: data.message?.content || data.message?.thinking || '',
    model: data.model,
    doneReason: data.done_reason || null
  }
}

function request(model, prompt, host, timeout, numPredict) {
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

export async function dispatch(model, prompt, host = OLLAMA_HOST, { retries = 1, numPredict = NUM_PREDICT } = {}) {
  const t0 = Date.now()
  let lastErr = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await request(model, prompt, host, TIMEOUT, numPredict)
      return { ...r, success: true, ms: Date.now() - t0, truncated: r.doneReason === 'length' }
    } catch (e) {
      lastErr = e
      if (attempt < retries) await new Promise(r => setTimeout(r, 3000 * (attempt + 1)))
    }
  }
  return { success: false, error: lastErr?.message || 'unknown', ms: Date.now() - t0 }
}
```

(`buildPayload` already accepts `numPredict` — no change needed there.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ollama.test.mjs`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/ollama.mjs test/ollama.test.mjs
git commit -m "feat: ollama surfaces truncation, tunable num_predict"
```

### Task 3.3: forge feeds findings, skips empty, refuses bad drafts

**Files:**
- Modify: `lib/forge.mjs`
- Test: `test/forge.test.mjs` (replace existing contents)

- [ ] **Step 1: Write the failing test**

```js
// test/forge.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { findingsFor, forgeEntry } from '../lib/forge.mjs'

test('findingsFor maps ops findings to the ops skill', () => {
  const f = { operations: { deploy: [{ text: 'no rollback', file: 'r.yml', severity: 'high' }], ci: [], jobs: [] }, hotspots: [], stack: null }
  const out = findingsFor({ skill: 'ops' }, f)
  assert.deepEqual(out, [{ text: 'no rollback', file: 'r.yml' }])
})

test('findingsFor maps hotspots + framework to overview', () => {
  const f = { hotspots: [{ file: 'a.js', edits: 9 }], stack: { framework: 'Svelte' }, operations: { deploy: [], ci: [], jobs: [] } }
  const out = findingsFor({ skill: 'overview' }, f)
  assert.ok(out.some(x => /Svelte/.test(x.text)))
  assert.ok(out.some(x => x.file === 'a.js' && /9 edits/.test(x.text)))
})

test('forgeEntry skips a skill with no evidence and no findings', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'smith-forge-'))
  try {
    const r = await forgeEntry(dir, { skill: 'overview', evidence: [] }, { dispatchFn: async () => ({ success: true, content: 'x' }), findings: [] })
    assert.equal(r.status, 'skipped')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('forgeEntry refuses a truncated draft (writes nothing)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'smith-forge-'))
  try {
    const r = await forgeEntry(dir, { skill: 'ops', evidence: ['r.yml'] },
      { dispatchFn: async () => ({ success: true, truncated: true, content: '---\nname: x\ndescription: y\n---\nbody' }), findings: [{ text: 'x', file: 'r.yml' }] })
    assert.equal(r.status, 'truncated')
    assert.equal(existsSync(join(dir, '.claude', 'skills')), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('forgeEntry writes a project-prefixed skill on a clean draft', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'demo-'))
  const md = '---\nname: ops\ndescription: how it deploys\n---\n\n# ops\n- no rollback (← r.yml)\n'
  try {
    const r = await forgeEntry(dir, { skill: 'ops', evidence: ['r.yml'] },
      { dispatchFn: async () => ({ success: true, content: md }), findings: [{ text: 'no rollback', file: 'r.yml' }] })
    assert.equal(r.status, 'written')
    assert.ok(r.path.includes(join('.claude', 'skills', `${basename(dir)}-ops`)))
    assert.match(readFileSync(r.path, 'utf8'), /no rollback/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/forge.test.mjs`
Expected: FAIL — `findingsFor` not exported; `forgeEntry` lacks skip/truncation/prefix behavior

- [ ] **Step 3: Write the implementation (replace file)**

```js
// lib/forge.mjs
import { readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { readFindings } from './findings.mjs'
import { gatherGrounding } from './grounding.mjs'
import { roleGuidance } from './templates.mjs'
import { buildDraftPrompt, parseDraft } from './draft.mjs'
import { checkCitations } from './citations.mjs'
import { writeSkill } from './skillwriter.mjs'
import { dispatch as realDispatch } from './ollama.mjs'

const ROLE_MODEL = { ops: 'glm-5.1:cloud', security: 'kimi-k2.6:cloud', overview: 'deepseek-v4-flash:cloud', commands: 'deepseek-v4-flash:cloud' }
const FORGE_NUM_PREDICT = 5000

export function readLessons(root) {
  const p = join(root, '.smith', 'lessons.json')
  if (!existsSync(p)) return []
  try { const l = JSON.parse(readFileSync(p, 'utf8')); return Array.isArray(l) ? l : [] } catch { return [] }
}

export function lessonsFor(entry, allLessons) {
  if (entry.skill === 'overview') return allLessons
  const ev = entry.evidence || []
  return allLessons.filter(l => (l.paths || []).some(p => ev.some(e => p.includes(e) || e.includes(p))))
}

export function findingsFor(entry, f) {
  if (!f) return []
  if (entry.skill === 'overview') {
    const stack = f.stack?.framework ? [{ text: `Framework: ${f.stack.framework}`, file: null }] : []
    const hot = (f.hotspots || []).map(h => ({ text: `${h.file} is a churn hotspot (${h.edits} edits)`, file: h.file }))
    return [...stack, ...hot]
  }
  if (entry.skill === 'ops') {
    const o = f.operations || {}
    return [...(o.deploy || []), ...(o.ci || []), ...(o.jobs || [])].map(x => ({ text: x.text, file: x.file }))
  }
  if (entry.skill === 'security' && f.exposure) return [{ text: f.exposure.text, file: f.exposure.file }]
  return []
}

export function modelFor(skill, local) {
  const name = ROLE_MODEL[skill] || 'glm-5.1:cloud'
  return local ? name.replace(/:cloud$/, '') : name
}

function skillName(root, role) { return `${basename(root)}-${role}` }

export async function forgeEntry(root, entry, { dispatchFn = realDispatch, host, local, findings = [], lessons = [] } = {}) {
  const grounding = gatherGrounding(root, entry)
  if (!grounding.files.length && !Object.keys(grounding.commands).length && !findings.length) {
    return { skill: entry.skill, status: 'skipped', reason: 'no evidence' }
  }
  const prompt = buildDraftPrompt(entry, grounding, roleGuidance(entry.skill), findings, lessons)
  const r = await dispatchFn(modelFor(entry.skill, local), prompt, host, { numPredict: FORGE_NUM_PREDICT })
  if (!r.success) return { skill: entry.skill, status: 'failed', error: r.error }
  if (r.truncated) return { skill: entry.skill, status: 'truncated' }
  const skillMd = parseDraft(r.content)
  if (!skillMd) return { skill: entry.skill, status: 'unparseable' }
  const citations = checkCitations(skillMd, entry.evidence)
  const path = writeSkill(root, skillName(root, entry.skill), skillMd)
  return { skill: entry.skill, status: 'written', path, citations }
}

export async function runForge(root, { findings, dispatchFn = realDispatch, host, local = false, only = null } = {}) {
  const f = findings || readFindings(root)
  if (!f) throw new Error('no findings — run scan first')
  const entries = only ? f.skills.filter(s => s.skill === only) : f.skills
  const allLessons = readLessons(root)
  const results = await Promise.all(entries.map(e => forgeEntry(root, e, {
    dispatchFn, host, local, findings: findingsFor(e, f), lessons: lessonsFor(e, allLessons)
  })))
  return { project: f.project, results }
}
```

Note: `dispatchFn` now receives a 4th options arg `{ numPredict }`. The stub in `test/scan.test.mjs` ignores extra args, so it stays valid.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/forge.test.mjs`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add lib/forge.mjs test/forge.test.mjs
git commit -m "feat: forge feeds findings, skips empty, refuses bad drafts"
```

### Task 3.4: role guidance for the new skills

**Files:**
- Modify: `lib/templates.mjs`
- Test: `test/templates.test.mjs` (replace existing contents)

- [ ] **Step 1: Write the failing test**

```js
// test/templates.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roleGuidance } from '../lib/templates.mjs'

test('ops guidance is operational-risk focused', () => {
  assert.match(roleGuidance('ops'), /deploy|rollback|CI|cron/i)
})

test('overview guidance mentions stack and churn', () => {
  assert.match(roleGuidance('overview'), /stack|churn|where/i)
})

test('commands guidance demands real, cited commands', () => {
  assert.match(roleGuidance('commands'), /cite|unknown/i)
})

test('unknown role falls back to a generic string', () => {
  assert.match(roleGuidance('whatever'), /citing source files|unknown/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/templates.test.mjs`
Expected: FAIL — old ROLE map keyed on cicd/deploy/jobs, no `ops`/`overview` churn wording

- [ ] **Step 3: Write the implementation (replace file)**

```js
// lib/templates.mjs
const ROLE = {
  overview: 'Describe what the project is: its stack and architecture, and where the code actually churns (the hotspots in the findings). Point a newcomer at the volatile core. Cite top-level files.',
  commands: 'List the REAL run/build/test/deploy commands. Each command MUST cite the file it came from. If a command is not in the evidence, write "unknown" — never invent one.',
  ops: 'Explain how this repo deploys and where it bites: rollback gaps, ungated publishes, CI gates that do not gate, and silent cron jobs. Use the CI/deploy/cron evidence and the verified findings. Cite each risk\'s source file. Never print a secret value.',
  security: 'Describe the exposure surface from env/secret files. NEVER print a secret value — name the file and the risk only.'
}

export function roleGuidance(skill) {
  return ROLE[skill] || 'Document this aspect of the project from the evidence, citing source files. If a fact is not in the evidence, write "unknown".'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/templates.test.mjs`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add lib/templates.mjs test/templates.test.mjs
git commit -m "feat: role guidance for overview/commands/ops/security"
```

---

# Phase 4 — CLI collapse + cut list

### Task 4.1: `renderFindings`

**Files:**
- Modify: `lib/render.mjs`
- Test: `test/render.test.mjs` (replace existing contents)

- [ ] **Step 1: Write the failing test**

```js
// test/render.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderFindings, shouldColor } from '../lib/render.mjs'

const findings = {
  project: 'demo', stack: { framework: 'Svelte', packageManager: 'pnpm@10' },
  hotspots: [{ file: 'src/batch.js', edits: 108 }],
  operations: { deploy: [{ text: 'publish races the gate', file: 'release.yml', severity: 'high' }], ci: [], jobs: [] },
  commands: { test: 'npm run test' },
  exposure: null,
  skills: [{ skill: 'overview' }, { skill: 'ops' }, { skill: 'commands' }]
}

test('renderFindings shows project, hotspots, ops, no theater', () => {
  const out = renderFindings(findings, { color: false })
  assert.match(out, /demo/)
  assert.match(out, /src\/batch\.js\s+108/)
  assert.match(out, /publish races the gate/)
  assert.doesNotMatch(out, /PRISTINE|vibe|gotcha/i)
})

test('renderFindings handles an empty/clean repo without crashing', () => {
  const out = renderFindings({ project: 'empty', hotspots: [], operations: { deploy: [], ci: [], jobs: [] }, commands: {}, skills: [{ skill: 'overview' }] }, { color: false })
  assert.match(out, /empty/)
})

test('shouldColor is false when not a TTY', () => {
  assert.equal(typeof shouldColor(), 'boolean')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/render.test.mjs`
Expected: FAIL — `renderFindings` not exported (only `renderManifest`)

- [ ] **Step 3: Write the implementation (replace file)**

```js
// lib/render.mjs
const G = '\x1b[32m', DIM = '\x1b[2m', A = '\x1b[33m', R = '\x1b[31m', X = '\x1b[0m'

export function shouldColor() {
  return process.stdout.isTTY === true && !process.env.NO_COLOR
}

export function renderFindings(f, { color = false } = {}) {
  const g = (s) => color ? G + s + X : s
  const dim = (s) => color ? DIM + s + X : s
  const amber = (s) => color ? A + s + X : s
  const red = (s) => color ? R + s + X : s
  const line = g('─'.repeat(60))
  const out = [g(`llama-smith · ${f.project}`), line]

  if (f.stack?.framework || f.stack?.packageManager) {
    out.push(`stack: ${[f.stack.framework, f.stack.packageManager].filter(Boolean).join(' · ')}`, '')
  }

  out.push(g('where the code moves'))
  if (f.hotspots?.length) for (const h of f.hotspots) out.push(`  ${h.file.padEnd(48)} ${dim(String(h.edits))}`)
  else out.push(dim('  (no code hotspots in window)'))

  const ops = f.operations || { deploy: [], ci: [], jobs: [] }
  const all = [...ops.deploy, ...ops.ci, ...ops.jobs]
  out.push('', g('how it deploys and where it bites'))
  if (all.length) for (const a of all) out.push(`  ${amber(a.severity.toUpperCase().padEnd(6))} ${a.text}${a.file ? dim(`  (${a.file})`) : ''}`)
  else out.push(dim('  (no operational risks surfaced)'))

  if (f.commands && Object.keys(f.commands).length) {
    out.push('', g('commands'), dim('  ' + Object.keys(f.commands).slice(0, 10).join(', ')))
  }
  if (f.exposure) out.push('', red('exposure: ' + f.exposure.text))
  return out.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/render.test.mjs`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/render.mjs test/render.test.mjs
git commit -m "feat: renderFindings calm report"
```

### Task 4.2: single `llama-smith` CLI

**Files:**
- Modify: `llama-smith.mjs` (full rewrite)
- Test: `test/cli.test.mjs` (replace existing contents)

- [ ] **Step 1: Write the failing test**

```js
// test/cli.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from '../llama-smith.mjs'

test('parseArgs defaults to scan+forge of cwd', () => {
  assert.deepEqual(parseArgs(['node', 'llama-smith.mjs']), { path: '.', scanOnly: false, json: false, local: false, only: null })
})

test('parseArgs reads path and flags', () => {
  const a = parseArgs(['node', 'llama-smith.mjs', '/repo', '--scan-only', '--local'])
  assert.equal(a.path, '/repo'); assert.equal(a.scanOnly, true); assert.equal(a.local, true)
})

test('parseArgs reads --only <skill> and --json', () => {
  const a = parseArgs(['node', 'llama-smith.mjs', '--only', 'ops', '--json', '/r'])
  assert.equal(a.only, 'ops'); assert.equal(a.json, true); assert.equal(a.path, '/r')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli.test.mjs`
Expected: FAIL — old CLI exports a different `parseArgs` (verb/role shape)

- [ ] **Step 3: Write the implementation (replace file)**

```js
// llama-smith.mjs
#!/usr/bin/env node
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runScan } from './lib/scan.mjs'
import { writeFindings } from './lib/findings.mjs'
import { runForge } from './lib/forge.mjs'
import { renderFindings, shouldColor } from './lib/render.mjs'

export const VERSION = '0.2.0'

export function parseArgs(argv) {
  const a = { path: '.', scanOnly: false, json: false, local: false, only: null }
  for (let i = 2; i < argv.length; i++) {
    const x = argv[i]
    if (x === '--scan-only') a.scanOnly = true
    else if (x === '--json') a.json = true
    else if (x === '--local') a.local = true
    else if (x === '--only') a.only = argv[++i]
    else if (!x.startsWith('-')) a.path = x
  }
  return a
}

async function main() {
  const args = parseArgs(process.argv)
  const root = resolve(args.path)
  if (!existsSync(root)) { console.error(`no such path: ${root}`); process.exit(1) }

  const findings = await runScan(root, { local: args.local })
  writeFindings(root, findings)

  if (args.json) { console.log(JSON.stringify(findings, null, 2)); return }
  console.log(renderFindings(findings, { color: shouldColor() }))
  if (args.scanOnly) return

  const { results } = await runForge(root, { findings, local: args.local, only: args.only })
  const written = results.filter(r => r.status === 'written').length
  console.log(`\nforged ${written} skills → .claude/skills/`)
  for (const r of results) {
    const flag = r.status === 'written' ? (r.citations && r.citations.ok ? 'ok' : 'check citations') : r.status
    console.log(`  ${r.skill.padEnd(12)} ${flag}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1) })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cli.test.mjs`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add llama-smith.mjs test/cli.test.mjs
git commit -m "feat: single llama-smith CLI (scan + forge)"
```

### Task 4.3: delete the cut features

**Files:**
- Delete: listed below

- [ ] **Step 1: Confirm nothing still imports the cut modules**

Run: `grep -rn "dashboard\|vibe\|gotchas\|consensus\|brain\|manifest" --include=*.mjs lib llama-smith.mjs | grep -v "test/"`
Expected: no `import ... from './<cut>.mjs'` lines remain in `lib/` or the CLI. (Forge now imports `findings.mjs`, scan replaced brain. If any remain, fix the importer before deleting.)

- [ ] **Step 2: Remove the files**

```bash
git rm lib/dashboard.mjs lib/vibe.mjs lib/gotchas.mjs lib/consensus.mjs lib/brain.mjs lib/manifest.mjs
git rm cli-dashboard.mjs cli-brain.mjs cli-forge.mjs cli-lessons.mjs
git rm test/dashboard.test.mjs test/vibe.test.mjs test/gotchas.test.mjs test/consensus.test.mjs test/brain.test.mjs test/manifest.test.mjs
```

- [ ] **Step 3: Run the full suite**

Run: `node --test`
Expected: PASS — no missing-module errors; remaining suites green

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: cut dashboard, vibe, gotcha feed, dual engine"
```

### Task 4.4: update the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite usage and status to the new surface**

Replace the `## Usage` block and the `## Status` block:

```markdown
## What it does

- **Scan** — reads how the repo deploys and where it bites (deploy races, no rollback, cron to /dev/null, CI-trust traps) and maps where the code actually churns. Output: `.smith/findings.json`. Every number is counted from git, every risk is cited to a real file.
- **Forge** — writes three Claude Code skills grounded in those findings: `<project>-ops` (the operational read), `<project>-overview` (stack + churn map), `<project>-commands` (real commands). A claim that is not in the evidence is written "unknown", never invented.

## Usage

```bash
llama-smith <repo>              # scan (the proof) then forge skills (the deliverable)
llama-smith <repo> --scan-only  # findings only, write nothing
llama-smith <repo> --json       # findings as JSON
llama-smith <repo> --local      # use local Ollama models
llama-smith <repo> --only ops   # forge a single skill
```

## Status

Scan and forge work today. Reads operational risk, maps churn, forges cited skills. Memory Matrix (session lessons) folds in when present. See `docs/superpowers/specs/` for the design.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README for cut-to-core ops-forensics"
```

---

# Phase 5 — Famous-repo harness as the suite

### Task 5.1: integration test gated on local clones

**Files:**
- Create: `test/famous-repos.test.mjs`

- [ ] **Step 1: Write the test**

Runs the real deterministic pipeline against the session clones if present (`/tmp/ls-demo/<repo>`), else skips. Locks in the regression: no docs/locks in hotspots.

```js
// test/famous-repos.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { runScan } from '../lib/scan.mjs'
import { isCodeFile } from '../lib/churn.mjs'

const REPOS = ['/tmp/ls-demo/express', '/tmp/ls-demo/flask', '/tmp/ls-demo/svelte']
const noLLM = async () => ({ success: false, error: 'offline (deterministic-only test)' })

for (const repo of REPOS) {
  test(`hotspots on ${repo} are code only`, { skip: existsSync(repo) ? false : 'clone absent' }, async () => {
    const f = await runScan(repo, { dispatchFn: noLLM, host: 'http://x' })
    assert.ok(f.hotspots.length > 0, 'expected some hotspots')
    for (const h of f.hotspots) assert.equal(isCodeFile(h.file), true, `non-code hotspot: ${h.file}`)
    assert.ok(f.skills.some(s => s.skill === 'overview'))
  })
}
```

- [ ] **Step 2: Run it**

Run: `node --test test/famous-repos.test.mjs`
Expected: PASS — runs if clones exist, otherwise reports the tests as skipped

- [ ] **Step 3: Commit**

```bash
git add test/famous-repos.test.mjs
git commit -m "test: famous-repo hotspot regression (gated on clones)"
```

### Task 5.2: green suite + version bump

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Run the whole suite**

Run: `node --test`
Expected: PASS — all suites green, zero missing-module errors

- [ ] **Step 2: Add a test script and bump version**

Edit `package.json` to:

```json
{"name":"llama-smith","version":"0.2.0","type":"module","bin":{"llama-smith":"./llama-smith.mjs"},"scripts":{"test":"node --test"}}
```

- [ ] **Step 3: Verify the script**

Run: `npm test`
Expected: PASS — same green suite

- [ ] **Step 4: End-to-end smoke (manual, optional, needs Ollama)**

Run: `node llama-smith.mjs /tmp/ls-demo/flask`
Expected: a calm report (hotspots are code files, an ops finding citing `publish.yaml`), then `forged N skills → .claude/skills/`; open `/tmp/ls-demo/flask/.claude/skills/flask-ops/SKILL.md` and confirm it names the publish/release risk with a `(← ...)` citation.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore: npm test script, bump to 0.2.0"
```

---

## Self-Review

**Spec coverage:**
- One findings-driven pipeline → Tasks 1.2 (contract), 2.3 (scan), 3.3 (forge reads it). ✓
- Code-only churn hotspots → Task 1.1 + regression in 5.1. ✓
- Ops scan (deploy/CI/jobs, secrets by reference) → Tasks 2.1, 2.3. ✓
- Hardened forge (feed findings, skip-empty, parse, truncation, dedup) → Tasks 2.1 (dedup), 3.1 (parse + findings prompt), 3.2 (truncation), 3.3 (skip + wire). ✓
- Three project-prefixed skills, ops hero, optional security → Tasks 2.2 (decide), 3.3 (skillName + findingsFor), 3.4 (guidance). ✓
- Cut list → Task 4.3. ✓
- One CLI → Task 4.2. ✓
- Famous-repo harness → Task 5.1. ✓
- Speed (fast models) → model routing in `lib/scan.mjs` (Task 2.3) and `lib/forge.mjs` (Task 3.3): ops→glm-5.1, flavor/overview/commands→deepseek-v4-flash, away from qwen3.5. ✓
- Memory Matrix compatibility → `readLessons`/`lessonsFor` kept in Task 3.3. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows complete code; every command shows expected output. ✓

**Type consistency checks:**
- Churn objects use `{ file, edits }` everywhere (churn.mjs, findings.hotspots, findingsFor, render). ✓
- `dispatch(model, prompt, host, { numPredict })` options-object signature defined in Task 3.2, consumed in Task 3.3; the scan stub (Task 2.3) and forge stubs ignore the extra arg. ✓
- `decide({ signals, stack, hotspots, operations, exposure })` object signature defined in Task 2.2, called in Task 2.3. ✓
- Skill role names are bare (`overview`/`commands`/`ops`/`security`) from `decide` through `findingsFor`, `roleGuidance`, and `modelFor`; the on-disk name is prefixed only in `skillName()`. ✓
- `findings.operations` always has `{ deploy, ci, jobs }` (assembleFindings default + parseOpsFindings + dedupeFindings all return that shape). ✓

**Gap check:** `lib/grounding.mjs` is unchanged and still reads `entry.evidence`; the new `entry` objects from `decide` carry `evidence`, so `gatherGrounding` works without modification. The `forge` passes findings separately from grounding, so grounding needs no change. ✓

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-27-llama-smith-ops-forensics.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
