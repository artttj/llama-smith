# Continuous Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a forged skill in sync with the repo. Detect scan-relevant change cheaply, run an incremental re-scan only when it matters, report what cited claims went stale, and refresh the skill-health view — without alert fatigue and without a heavy always-on daemon.

**Architecture:** A pure orchestration module `lib/continuous.mjs` decides rescan-or-skip, computes the staleness diff, and builds a report object. A thin `scripts/watch.mjs` owns the trigger (commit hook / interval / one-shot), the debounce timing, the call into the existing `runPipeline`, and all I/O. It reuses `lib/incremental.mjs` for change detection and relevance gating, and `lib/freshness.mjs` for staleness grading — nothing in those modules is reinvented.

**Tech Stack:** Node 20+, native `node:test`, zero dependencies. New logic is pure and clock-injected so the loop is testable without a live daemon or live Ollama.

---

## File Map

| File | Role | Action |
|------|------|--------|
| `lib/continuous.mjs` | Pure decision + diff logic | Create. Exports `shouldRescan`, `stalenessDiff`, `buildReport`. No timers, no `runPipeline`, no filesystem writes. |
| `scripts/watch.mjs` | Watch CLI / trigger owner | Create. `--once`, `--interval <ms>`, `--install-hook`, `--notify-cmd <sh>`. The only file with side effects. |
| `hooks/post-commit` | Git trigger template | Create. One-line shim calling `watch.mjs --once`. Installed by `--install-hook`, never auto-installed. |
| `test/continuous.test.mjs` | Unit tests | Create. Pure tests for the decision + diff logic and the injected-clock debounce. |
| `test/watch.test.mjs` | CLI tests | Create. Tests `--once` against a temp repo with a stub pipeline, and `--install-hook`. |
| `lib/incremental.mjs` | Reused | No change in v1. (Architecture caching is a flagged follow-up.) |
| `lib/freshness.mjs` | Reused | No change. |
| `lib/pipeline.mjs` | Reused | No change in v1. |

---

## First Milestone — simplest thing that works

**Cron re-scan + staleness report.** Before any loop, daemon, or hook, ship a single `--once` path:

`node scripts/watch.mjs <repo> --once` →
1. `readCache(root)` and `fileHashes` + `diffHashes` to get the change set.
2. Gate with `relevantChanged(changedSet, [SCAN_PATTERNS])`.
3. If nothing relevant: print `watch: no scan-relevant change` and refresh `.smith/health.json` from `repoFreshness`. Exit 0.
4. If relevant: call `runPipeline(root, { incremental: true })`, compute `stalenessDiff`, print a one-line report, write `.smith/health.json`. Exit 0.

That is the whole value of #1 in one command a human or a `cron`/`launchd` entry can call. It is Tasks 1–3 below. The interval loop (Task 4) and the commit hook (Task 5) are conveniences layered on top of this proven core. Do not build the daemon before the `--once` path is green.

---

### Task 1: Pure staleness diff

**Files:**
- Create: `lib/continuous.mjs`
- Test: `test/continuous.test.mjs` (new)

- [ ] **Step 1: Write the failing test**

Create `test/continuous.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stalenessDiff } from '../lib/continuous.mjs'

const f = (smith, file, text, severity = 'medium') => ({ smith, file, text, severity })

test('stalenessDiff lists cited claims whose files changed', () => {
  const prev = [f('deploy', 'deploy.sh', 'no rollback'), f('secret', 'config.js', 'hardcoded key')]
  const next = prev
  const changedSet = new Set(['deploy.sh'])
  const out = stalenessDiff(prev, next, changedSet, { status: 'stale', changedCited: 1 })
  assert.equal(out.staleClaims.length, 1)
  assert.equal(out.staleClaims[0].file, 'deploy.sh')
  assert.equal(out.status, 'stale')
})

test('stalenessDiff reports added and removed findings by stable key', () => {
  const prev = [f('deploy', 'deploy.sh', 'no rollback')]
  const next = [f('secret', 'config.js', 'hardcoded key')]
  const out = stalenessDiff(prev, next, new Set(), { status: 'aging', changedCited: 0 })
  assert.equal(out.added.length, 1)
  assert.equal(out.added[0].file, 'config.js')
  assert.equal(out.removed.length, 1)
  assert.equal(out.removed[0].file, 'deploy.sh')
})

test('stalenessDiff is empty and quiet when nothing moved', () => {
  const same = [f('deploy', 'deploy.sh', 'no rollback')]
  const out = stalenessDiff(same, same, new Set(), { status: 'fresh', changedCited: 0 })
  assert.equal(out.staleClaims.length, 0)
  assert.equal(out.added.length, 0)
  assert.equal(out.removed.length, 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/continuous.test.mjs`
Expected: FAIL — `stalenessDiff is not a function` / import error.

- [ ] **Step 3: Write minimal implementation**

Create `lib/continuous.mjs`. Reuse `findingKey` from escalation so identity matches how findings are tracked across scans elsewhere:

```javascript
// Continuous mode: pure decision + diff logic. No timers, no runPipeline, no
// filesystem. scripts/watch.mjs injects the clock and the pipeline runner so the
// loop is testable without a live daemon or live Ollama. Change detection and
// relevance gating come from lib/incremental.mjs; staleness grading from
// lib/freshness.mjs — neither is reinvented here.
import { findingKey } from './escalation.mjs'

// Which cited claims now point at code that moved, plus findings that appeared
// or vanished since the cached scan. Deltas key on findingKey (smith+file+text)
// so they match escalation's identity, not raw object equality.
export function stalenessDiff(prevFindings = [], nextFindings = [], changedSet = new Set(), freshness = {}) {
  const changed = changedSet instanceof Set ? changedSet : new Set(changedSet)
  const prevKeys = new Map(prevFindings.map(f => [findingKey(f), f]))
  const nextKeys = new Map(nextFindings.map(f => [findingKey(f), f]))
  const added = [...nextKeys].filter(([k]) => !prevKeys.has(k)).map(([, f]) => f)
  const removed = [...prevKeys].filter(([k]) => !nextKeys.has(k)).map(([, f]) => f)
  const staleClaims = nextFindings.filter(f => f.file && changed.has(f.file))
  return { status: freshness.status ?? 'unknown', changedCited: freshness.changedCited ?? 0, staleClaims, added, removed }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/continuous.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/continuous.mjs test/continuous.test.mjs
git commit -m "feat: pure staleness diff for continuous mode"
```

---

### Task 2: Debounce + relevance decision

**Files:**
- Modify: `lib/continuous.mjs`
- Test: `test/continuous.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `test/continuous.test.mjs`:

```javascript
import { shouldRescan } from '../lib/continuous.mjs'
import { SCAN_PATTERNS } from '../lib/scan.mjs'

test('shouldRescan is false when no scan-relevant file changed', () => {
  const d = shouldRescan(['README.md', 'docs/x.md'], { patterns: [SCAN_PATTERNS], debounceMs: 0, lastRunAt: 0, now: 1000 })
  assert.equal(d.run, false)
  assert.equal(d.reason, 'no-relevant-change')
})

test('shouldRescan is true when a relevant file changed and debounce elapsed', () => {
  const d = shouldRescan(['deploy.sh'], { patterns: [SCAN_PATTERNS], debounceMs: 1000, lastRunAt: 0, now: 5000 })
  assert.equal(d.run, true)
})

test('shouldRescan is false inside the debounce window even if relevant', () => {
  const d = shouldRescan(['deploy.sh'], { patterns: [SCAN_PATTERNS], debounceMs: 30000, lastRunAt: 1000, now: 2000 })
  assert.equal(d.run, false)
  assert.equal(d.reason, 'debounced')
})
```

(Pick a path that matches a real `SCAN_PATTERNS` entry; confirm `deploy.sh` matches by checking `lib/scan.mjs` `RELEVANT.deploy`, otherwise use a known match like a `.github/workflows/*.yml` path.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/continuous.test.mjs`
Expected: FAIL — `shouldRescan is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `lib/continuous.mjs`, reusing the relevance gate from incremental verbatim:

```javascript
import { relevantChanged } from './incremental.mjs'

// Decide rescan-or-skip. Same relevance expression runPipeline uses
// (lib/pipeline.mjs:101). Debounce is clock-injected so the daemon is testable
// without sleeping.
export function shouldRescan(changedFiles = [], { patterns, debounceMs = 30000, lastRunAt = 0, now = Date.now() } = {}) {
  if (!changedFiles.length) return { run: false, reason: 'no-change' }
  if (!relevantChanged(changedFiles, patterns)) return { run: false, reason: 'no-relevant-change' }
  if (now - lastRunAt < debounceMs) return { run: false, reason: 'debounced' }
  return { run: true, reason: 'relevant-change' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/continuous.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/continuous.mjs test/continuous.test.mjs
git commit -m "feat: relevance-gated debounce decision for continuous mode"
```

---

### Task 3: `--once` watch CLI (the first milestone)

**Files:**
- Create: `scripts/watch.mjs`
- Modify: `lib/continuous.mjs` (add `buildReport`)
- Test: `test/watch.test.mjs` (new), `test/continuous.test.mjs`

- [ ] **Step 1: Write the failing test for `buildReport`**

Add to `test/continuous.test.mjs`:

```javascript
import { buildReport } from '../lib/continuous.mjs'

test('buildReport summarizes a quiet no-op', () => {
  const r = buildReport({ decision: { run: false, reason: 'no-relevant-change' }, diff: null, freshness: { status: 'fresh', daysSince: 1 } })
  assert.equal(r.notify, false)
  assert.match(r.line, /no scan-relevant change/i)
})

test('buildReport flags drift when claims went stale', () => {
  const diff = { status: 'stale', changedCited: 2, staleClaims: [{ file: 'deploy.sh' }, { file: 'config.js' }], added: [], removed: [] }
  const r = buildReport({ decision: { run: true }, diff, freshness: { status: 'stale', daysSince: 3 } })
  assert.equal(r.notify, true)
  assert.match(r.line, /2 cited/i)
})

test('buildReport stays quiet when a rescan confirms everything still holds', () => {
  const diff = { status: 'fresh', changedCited: 0, staleClaims: [], added: [], removed: [] }
  const r = buildReport({ decision: { run: true }, diff, freshness: { status: 'fresh', daysSince: 0 } })
  assert.equal(r.notify, false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/continuous.test.mjs`
Expected: FAIL — `buildReport is not a function`.

- [ ] **Step 3: Implement `buildReport`**

Add to `lib/continuous.mjs`. Notify only when drift crosses the threshold (stale status, stale claims, or any added/removed). A confirming rescan is silent — this is the alert-fatigue guard from the spec.

```javascript
export function buildReport({ decision, diff, freshness }) {
  if (!decision.run || !diff) {
    return { notify: false, line: `watch: no scan-relevant change (skill ${freshness?.status ?? 'unknown'}, ${freshness?.daysSince ?? '?'}d)`, diff: null }
  }
  const drift = diff.staleClaims.length > 0 || diff.added.length > 0 || diff.removed.length > 0 || diff.status === 'stale'
  const parts = []
  if (diff.staleClaims.length) parts.push(`${diff.staleClaims.length} cited claim(s) on changed files`)
  if (diff.added.length) parts.push(`+${diff.added.length} finding(s)`)
  if (diff.removed.length) parts.push(`-${diff.removed.length} finding(s)`)
  const line = drift
    ? `watch: drift — ${parts.join(', ') || diff.status} (skill ${diff.status})`
    : `watch: rescanned, no drift (skill ${diff.status})`
  return { notify: drift, line, diff }
}
```

- [ ] **Step 4: Write the failing CLI test**

Create `test/watch.test.mjs`. Test `--once` against a temp git repo, injecting a stub pipeline so no Ollama is needed. `scripts/watch.mjs` must accept an injected runner for testability (export `runOnce(root, opts, { runPipeline })`), with the real `runPipeline` as the default.

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runOnce } from '../scripts/watch.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ls-watch-'))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir })
  writeFileSync(join(dir, 'README.md'), '# x')
  execFileSync('git', ['add', '.'], { cwd: dir })
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir })
  return dir
}

test('runOnce stays quiet and refreshes health when no relevant change', async () => {
  const dir = tempRepo()
  // Seed a findings.json + scan-cache.json so freshness/incremental have a baseline.
  mkdirSync(join(dir, '.smith'), { recursive: true })
  writeFileSync(join(dir, '.smith', 'findings.json'), JSON.stringify({ scannedAt: new Date().toISOString(), sha: '', opsFindings: [], architecture: [] }))
  writeFileSync(join(dir, '.smith', 'scan-cache.json'), JSON.stringify({ fileHashes: {}, findings: [] }))
  let pipelineCalls = 0
  const stub = async () => { pipelineCalls++; return { json: { opsFindings: [] } } }
  const report = await runOnce(dir, {}, { runPipeline: stub })
  // README.md is not scan-relevant; the stub pipeline must not have run.
  assert.equal(pipelineCalls, 0)
  assert.equal(report.notify, false)
  assert.ok(existsSync(join(dir, '.smith', 'health.json')))
  rmSync(dir, { recursive: true, force: true })
})

test('runOnce rescans and reports drift when a relevant file is added', async () => {
  const dir = tempRepo()
  mkdirSync(join(dir, '.smith'), { recursive: true })
  writeFileSync(join(dir, '.smith', 'findings.json'), JSON.stringify({ scannedAt: new Date().toISOString(), sha: '', opsFindings: [], architecture: [] }))
  writeFileSync(join(dir, '.smith', 'scan-cache.json'), JSON.stringify({ fileHashes: {}, findings: [] }))
  // Add a scan-relevant file (a CI workflow) and stage it so listFiles sees it.
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true })
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'name: ci')
  execFileSync('git', ['add', '.'], { cwd: dir })
  const stub = async () => ({ json: { opsFindings: [{ smith: 'deploy', file: '.github/workflows/ci.yml', text: 'no rollback', severity: 'medium' }] } })
  const report = await runOnce(dir, { debounceMs: 0 }, { runPipeline: stub })
  assert.equal(report.notify, true)
  rmSync(dir, { recursive: true, force: true })
})
```

(Confirm the chosen relevant path matches `SCAN_PATTERNS` from `lib/scan.mjs`; `.github/workflows/ci.yml` should match the deploy/CI patterns — verify against `lib/scan.mjs` `RELEVANT.deploy` and adjust if needed.)

- [ ] **Step 5: Implement `scripts/watch.mjs`**

```javascript
#!/usr/bin/env node
// Continuous Skill watcher. Detects scan-relevant change cheaply (lib/incremental),
// runs an incremental re-scan only when it matters (runPipeline), reports staleness
// (lib/continuous + lib/freshness), and refreshes .smith/health.json. The pure
// decision + diff logic lives in lib/continuous.mjs; this file owns triggers and I/O.
//   node scripts/watch.mjs <repo> --once
//   node scripts/watch.mjs <repo> --interval 600000
//   node scripts/watch.mjs <repo> --install-hook
import { resolve, join } from 'node:path'
import { existsSync, writeFileSync, readFileSync, mkdirSync, copyFileSync, chmodSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runPipeline as realPipeline } from '../lib/pipeline.mjs'
import { fileHashes, diffHashes, readCache } from '../lib/incremental.mjs'
import { SCAN_PATTERNS } from '../lib/scan.mjs'
import { listFiles } from '../lib/git.mjs'
import { repoFreshness, freshnessBadge } from '../lib/freshness.mjs'
import { shouldRescan, stalenessDiff, buildReport } from '../lib/continuous.mjs'

const DEBOUNCE_MS = 30_000
const INTERVAL_MS = 600_000

// One evaluation cycle. Pure-ish: pipeline + clock are injectable for tests.
export async function runOnce(root, opts = {}, deps = {}) {
  const runPipeline = deps.runPipeline || realPipeline
  const now = deps.now ?? Date.now()
  const cache = readCache(root)
  const cur = fileHashes(root, listFiles(root))
  const diff = cache ? diffHashes(cache.fileHashes, cur) : { changed: [], added: Object.keys(cur), removed: [] }
  const changedSet = [...diff.changed, ...diff.added, ...diff.removed]
  const decision = shouldRescan(changedSet, { patterns: [SCAN_PATTERNS], debounceMs: opts.debounceMs ?? DEBOUNCE_MS, lastRunAt: opts.lastRunAt ?? 0, now })

  let stale = null
  if (decision.run) {
    const prevFindings = cache?.findings || []
    const res = await runPipeline(root, { incremental: true })
    const fresh = repoFreshness(root) || {}
    stale = stalenessDiff(prevFindings, res.json.opsFindings || [], new Set(changedSet), fresh)
  }
  const freshness = repoFreshness(root) || { status: 'unknown', daysSince: null }
  writeHealth(root, freshness)
  const report = buildReport({ decision, diff: stale, freshness })
  console.log(report.line)
  if (report.notify && opts.notifyCmd) { try { execSync(opts.notifyCmd, { env: { ...process.env, LS_DRIFT: report.line } }) } catch {} }
  return report
}

function writeHealth(root, freshness) {
  mkdirSync(join(root, '.smith'), { recursive: true })
  writeFileSync(join(root, '.smith', 'health.json'), JSON.stringify(freshness, null, 2))
}

function installHook(root) {
  const hooksDir = join(root, '.git', 'hooks')
  if (!existsSync(hooksDir)) { console.error('not a git repo (no .git/hooks)'); process.exit(1) }
  const ls = fileURLToPath(new URL('./watch.mjs', import.meta.url))
  const dest = join(hooksDir, 'post-commit')
  writeFileSync(dest, `#!/bin/sh\nnode "${ls}" "${root}" --once\n`)
  chmodSync(dest, 0o755)
  console.log(`installed post-commit hook → ${dest}`)
}

function parse(argv) {
  const o = { path: '.', once: false, interval: null, install: false, notifyCmd: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--once') o.once = true
    else if (a === '--install-hook') o.install = true
    else if (a === '--interval' && argv[i + 1]) o.interval = parseInt(argv[++i], 10) || INTERVAL_MS
    else if (a === '--notify-cmd' && argv[i + 1]) o.notifyCmd = argv[++i]
    else if (!a.startsWith('-')) o.path = a
  }
  return o
}

async function main() {
  const o = parse(process.argv)
  const root = resolve(o.path)
  if (!existsSync(root)) { console.error(`no such path: ${root}`); process.exit(1) }
  if (o.install) return installHook(root)
  if (o.interval) {
    let lastRunAt = 0
    const tick = async () => { const r = await runOnce(root, { interval: o.interval, lastRunAt, notifyCmd: o.notifyCmd }); if (r.diff) lastRunAt = Date.now() }
    await tick()
    setInterval(tick, o.interval)
    return
  }
  await runOnce(root, { notifyCmd: o.notifyCmd })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1) })
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/continuous.test.mjs test/watch.test.mjs`
Expected: PASS

- [ ] **Step 7: Manual smoke of the first milestone**

```bash
node llama-smith.mjs <some-repo> --incremental        # establish a baseline cache + findings
node scripts/watch.mjs <some-repo> --once             # expect: "no scan-relevant change"
# edit a deploy/CI file in that repo, then:
node scripts/watch.mjs <some-repo> --once             # expect: rescan + drift line, .smith/health.json refreshed
```

- [ ] **Step 8: Commit**

```bash
git add scripts/watch.mjs lib/continuous.mjs test/watch.test.mjs test/continuous.test.mjs
git commit -m "feat: watch --once with relevance-gated rescan and staleness report"
```

---

### Task 4: Interval loop (foreground daemon)

**Files:**
- Modify: `scripts/watch.mjs` (the `--interval` branch from Task 3 — verify, do not re-add)
- Test: `test/watch.test.mjs`

- [ ] **Step 1: Write the failing test for debounce across ticks**

The interval loop itself is not unit-tested with real timers. Instead test the decision logic that the loop relies on: that `lastRunAt` threading prevents a second rescan inside the window. Add to `test/watch.test.mjs`:

```javascript
test('runOnce respects injected lastRunAt to suppress a too-soon rescan', async () => {
  const dir = tempRepo()
  mkdirSync(join(dir, '.smith'), { recursive: true })
  writeFileSync(join(dir, '.smith', 'findings.json'), JSON.stringify({ scannedAt: new Date().toISOString(), sha: '', opsFindings: [], architecture: [] }))
  writeFileSync(join(dir, '.smith', 'scan-cache.json'), JSON.stringify({ fileHashes: {}, findings: [] }))
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true })
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'name: ci')
  execFileSync('git', ['add', '.'], { cwd: dir })
  let calls = 0
  const stub = async () => { calls++; return { json: { opsFindings: [] } } }
  await runOnce(dir, { debounceMs: 60000, lastRunAt: Date.now(), now: Date.now() + 1000 }, { runPipeline: stub })
  assert.equal(calls, 0, 'debounced inside the window')
  rmSync(dir, { recursive: true, force: true })
})
```

- [ ] **Step 2: Run test, verify it passes** (logic already implemented in Task 3)

Run: `node --test test/watch.test.mjs`
Expected: PASS. If it fails, the `lastRunAt`/`now` threading in `runOnce` is wrong — fix `runOnce`, not the test.

- [ ] **Step 3: Manual smoke of the loop**

```bash
node scripts/watch.mjs <some-repo> --interval 5000
# touch a deploy file once; confirm exactly one rescan line, not one per tick.
# Ctrl-C to stop.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/watch.mjs test/watch.test.mjs
git commit -m "feat: foreground interval loop with cross-tick debounce"
```

---

### Task 5: Git post-commit hook installer

**Files:**
- Create: `hooks/post-commit` (template, for reference)
- Modify: `scripts/watch.mjs` (the `installHook` from Task 3 — verify)
- Test: `test/watch.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `test/watch.test.mjs`:

```javascript
import { runOnce } from '../scripts/watch.mjs'
// installHook is exercised via the CLI to keep watch.mjs's export surface small.

test('--install-hook writes an executable post-commit calling watch --once', () => {
  const dir = tempRepo()
  execFileSync('node', [join(__dirname, '..', 'scripts', 'watch.mjs'), dir, '--install-hook'])
  const hook = join(dir, '.git', 'hooks', 'post-commit')
  assert.ok(existsSync(hook))
  const body = readFileSync(hook, 'utf8')
  assert.match(body, /watch\.mjs/)
  assert.match(body, /--once/)
  rmSync(dir, { recursive: true, force: true })
})
```

- [ ] **Step 2: Run test, verify it passes** (installer implemented in Task 3)

Run: `node --test test/watch.test.mjs`
Expected: PASS.

- [ ] **Step 3: Add the reference template**

Create `hooks/post-commit` as documentation of what gets installed (the installer writes an absolute-path version; this file is the human-readable template):

```sh
#!/bin/sh
# Installed by: node scripts/watch.mjs <repo> --install-hook
# Re-evaluates skill freshness after each commit; rescans only on relevant change.
node "$(git rev-parse --show-toplevel)/../llama-smith/scripts/watch.mjs" "$(git rev-parse --show-toplevel)" --once
```

- [ ] **Step 4: Commit**

```bash
git add scripts/watch.mjs hooks/post-commit test/watch.test.mjs
git commit -m "feat: post-commit hook installer for continuous mode"
```

---

### Task 6: Full suite + README note

**Files:**
- Modify: `README.md` (document the `watch` verb and the architecture-not-cached caveat)
- Test: whole suite

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all existing tests plus the new `continuous` and `watch` tests pass.

- [ ] **Step 2: Document the feature and the honest caveat**

Add a short `watch` section to `README.md`:
- `node scripts/watch.mjs <repo> --once` — one evaluation (cron/launchd friendly).
- `--interval <ms>` — foreground loop.
- `--install-hook` — post-commit trigger for this checkout.
- The caveat from the spec: incremental does **not** cache architecture (`lib/pipeline.mjs:121`), so a triggered rescan re-maps architecture each time. Note it as a known cost and a planned follow-up.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document watch mode and architecture-cache caveat"
```

---

## Follow-up (explicitly out of v1)

- **Cache architecture in incremental.** Extend `lib/incremental.mjs` + the `reuse` branch in `lib/pipeline.mjs` to cache `findings.architecture` and invalidate only when an `ARCH_RELEVANT` file changes. This is the one place watch is not yet cheap. Both manual `--incremental` and watch benefit.
- **`--watch-fs`** raw file-watcher trigger behind a flag, once the loop is proven.
- **Two-scan confirmation for `removed`** to absorb swarm flicker.
- **`--notify-cmd` recipes** (desktop / Slack) as docs, not built-in transports.

---

## Test strategy

- **Pure unit tests carry the load.** `stalenessDiff`, `shouldRescan`, and `buildReport` are pure and fully tested in `test/continuous.test.mjs` — no daemon, no Ollama, no clock.
- **Clock is injected.** Debounce is tested by passing `now` / `lastRunAt`, never by sleeping. Matches the repo's existing pattern (escalation logic is pure and takes `scannedAt`, `lib/escalation.mjs:33`).
- **Pipeline is injected.** `runOnce(root, opts, { runPipeline })` lets `test/watch.test.mjs` stub the scan, so the CLI path is tested end to end against a real temp git repo without invoking Ollama.
- **Relevance gate is tested against real `SCAN_PATTERNS`** by importing them from `lib/scan.mjs`, so the gate can't silently drift from what `runPipeline` uses.
- **The interval loop is not unit-tested with real timers** — its correctness reduces to the debounce decision, which is covered. The loop wiring is smoke-tested manually (Task 4 Step 3).

---

## Self-Review

**Spec coverage check:**
- [x] Trigger: commit hook (Task 5) + interval/once (Tasks 3–4); `fs.watch` explicitly deferred — spec "Trigger options"
- [x] Reuses `lib/incremental.mjs` (`fileHashes`/`diffHashes`/`relevantChanged`/`readCache`) for cheap detection — Tasks 2–3
- [x] Reuses `lib/freshness.mjs` (`repoFreshness`/`freshnessBadge`) for staleness + health.json — Task 3
- [x] Staleness-diff surface (stale cited claims + added/removed) — Task 1
- [x] Notification strategy: one-per-batch, threshold, quiet refresh — Task 3 `buildReport`
- [x] Cost control: relevance gate + debounce + incremental — Tasks 2–3
- [x] Honest caveat: architecture not cached by incremental — flagged in spec, README (Task 6), follow-up
- [x] First milestone (cron rescan + staleness report) shipped before the daemon — Tasks 1–3

**Reuse check:** No re-implementation of hashing, diffing, relevance, freshness grading, or finding identity. `findingKey` (escalation), `relevantChanged` (incremental), `repoFreshness`/`freshnessBadge` (freshness), and `runPipeline` (pipeline) are all called, not copied.

**Placeholder scan:** none.

**Type consistency:** `shouldRescan`, `stalenessDiff`, `buildReport`, `runOnce` names are consistent across spec, tasks, and tests.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-30-continuous-skill.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Build order is strict: Tasks 1→2→3 deliver the first milestone (the value of #1 in one command); 4→5 add convenience triggers; 6 closes the suite and docs.
