// The production pipeline: investigator swarm (multi-round for stable recall)
// → Oracle validation → code-only churn → multi-file skill forge.
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { scanRepo, scanArchitecture, SCAN_PATTERNS } from './scan.mjs'
import { validateFindings, keepSupported, ORACLE_MODEL } from './oracle.mjs'
import { collectChurn, topHotspots } from './churn.mjs'
import { computeForensics } from './forensics.mjs'
import { git, headSha, listFiles } from './git.mjs'
import { parseMakefile, parsePackageScripts, parseComposerScripts, parseWorkflowCommands, classifyCommand } from './commands.mjs'
import { detectStack, detectTech, detectEntrypoints, detectBoundaries } from './project.mjs'
import { buildSkillFiles, writeSkillFolder, adaptLessons } from './skill.mjs'
import { readLessons } from './lessons-store.mjs'
import { recordScan, escalate, readHistory, writeHistory } from './escalation.mjs'
import { fileHashes, diffHashes, relevantChanged, partitionFindings, readCache, writeCache } from './incremental.mjs'
import { semanticDedupe, embedTexts, EMBED_MODEL } from './semantic.mjs'

const SEVR = { high: 0, medium: 1, low: 2 }
const normTxt = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const tokens = s => new Set(normTxt(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length > 2))
// Same-issue heuristic: share ~45%+ of content words (Jaccard). Tuned on real
// paraphrases ("no rollback for npm/JSR" two ways) vs distinct same-file findings,
// which share only a couple of generic words. Deterministic, not semantic — loose
// paraphrases that reword everything still slip through; a true embedding/LLM
// dedup pass is the robust upgrade.
function similar(a, b) {
  const A = tokens(a), B = tokens(b)
  if (!A.size || !B.size) return false
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter) >= 0.45
}

// Dedup across rounds: exact AND paraphrase duplicates that share a smith+file,
// keeping the higher-severity / more detailed phrasing. Distinct issues survive.
export function dedupeFindings(list) {
  const kept = []
  for (const f of list) {
    const i = kept.findIndex(k => k.smith === f.smith && (k.file || '') === (f.file || '') && similar(k.text, f.text))
    if (i === -1) { kept.push(f); continue }
    const cur = kept[i]
    const better = (SEVR[f.severity] ?? 1) < (SEVR[cur.severity] ?? 1)
      || (f.severity === cur.severity && f.text.length > cur.text.length)
    if (better) kept[i] = f
  }
  return kept
}

// Embedding-based dedup with a safe lexical fallback: a missing embedding model
// or a downed endpoint degrades to the sync Jaccard pass instead of failing.
export async function dedupeFindingsSemantic(list, { host, model = EMBED_MODEL } = {}) {
  try {
    return await semanticDedupe(list, { embedFn: texts => embedTexts(texts, { model, host }) })
  } catch (e) {
    console.warn(`semantic dedup unavailable (${e?.message || 'unknown'}) — falling back to lexical`)
    return dedupeFindings(list)
  }
}

// The swarm is stochastic — a single round can miss findings (drizzle swung 7→0).
// Run R rounds concurrently (the lanes already prove Ollama serves in parallel),
// then union+dedup for stable recall.
export async function runScanRounds(root, opts = {}, rounds = 2) {
  const results = await Promise.all(Array.from({ length: rounds }, () => scanRepo(root, opts)))
  const union = results.flatMap(r => r.findings)
  return opts.semantic ? await dedupeFindingsSemantic(union, { host: opts.host }) : dedupeFindings(union)
}

// One year of `git log --name-only` with author markers, shared by churn and
// forensics so the history is walked once. Churn ignores the @@@author lines.
export function historyLog(root) {
  return git(['log', '--name-only', '--pretty=format:@@@%an|%ae', '--since=1 year ago'], root)
}
export function codeHotspots(log) {
  return topHotspots(collectChurn(log.replace(/^@@@.*$/gm, '')), { limit: 8 })
}

// Deterministic: real build/test/deploy commands from the repo's manifests and
// CI workflows. No LLM, never invented. Each command is classified and cited.
export function extractCommands(root, files = listFiles(root)) {
  const out = []
  const readFull = f => { try { const p = join(root, f); return statSync(p).size > 1024 * 1024 ? '' : readFileSync(p, 'utf8') } catch { return '' } }
  const add = (cmd, raw, file) => out.push({ cmd, raw: String(raw || '').slice(0, 120), file, kind: classifyCommand(`${cmd} ${raw || ''}`) })
  if (files.includes('package.json')) for (const [k, v] of Object.entries(parsePackageScripts(readFull('package.json')))) add(`npm run ${k}`, v, 'package.json')
  if (files.includes('composer.json')) for (const [k, v] of Object.entries(parseComposerScripts(readFull('composer.json')))) add(`composer ${k}`, v, 'composer.json')
  const mk = files.find(f => /^[Mm]akefile$/.test(f))
  if (mk) for (const t of parseMakefile(readFull(mk))) add(`make ${t}`, '', mk)
  for (const wf of files.filter(f => /^\.github\/workflows\/.+\.ya?ml$/.test(f)))
    for (const c of parseWorkflowCommands(readFull(wf))) out.push({ cmd: c, raw: '', file: wf, kind: classifyCommand(c) })
  return dedupeCommands(out).slice(0, 40)
}

// Collapse identical commands (CI matrices repeat the same step many times).
export function dedupeCommands(cmds) {
  const seen = new Set()
  return cmds.filter(c => { const k = c.cmd.trim(); if (seen.has(k)) return false; seen.add(k); return true })
}

export async function runPipeline(root, opts = {}) {
  const project = basename(root)
  const files = listFiles(root)
  const oracleModel = opts.local ? ORACLE_MODEL.replace(/:cloud$/, '') : ORACLE_MODEL

  // Missed-finding hints (recorded via --missed) bias the swarm toward re-checking
  // what it previously missed; they only matter on the full-scan path.
  const missedHints = readLessons(root).filter(l => l.kind === 'missed' || l.source === 'missed').map(l => l.text)
  const scanOpts = { ...opts, missedHints }

  // Incremental: hash the working tree and compare against the last run's cache.
  // If nothing scan-relevant changed we reuse cached findings and skip the swarm
  // + Oracle entirely. Relevance is conservative (any relevant change → full
  // scan); transitive effects beyond the relevance patterns are NOT detected.
  const inc = opts.incremental ? prepareIncremental(root, files) : null
  const reuse = inc && inc.cache && !relevantChanged(inc.changedSet, [SCAN_PATTERNS])

  let supported, dropped
  if (reuse) {
    supported = inc.cache.findings || []
    dropped = []
    console.log(`incremental: no scan-relevant changes since ${inc.cache.scannedAt} — reused ${supported.length} findings`)
  } else {
    const ops = await runScanRounds(root, scanOpts, opts.scanOnly ? 1 : (opts.rounds || 2))
    const validated = opts.oracle === false
      ? ops.map(f => ({ ...f, oracle: { supported: true, reason: 'oracle disabled' } }))
      : await validateFindings(root, ops, { host: opts.host, model: oracleModel })
    const fresh = keepSupported(validated)
    dropped = validated.filter(f => f.oracle?.supported === false)
    // Merge cached findings still valid (file unchanged) with the fresh scan,
    // then dedup so a reused finding and its rescanned twin don't double up.
    supported = inc
      ? dedupeFindings([...partitionFindings(inc.cache?.findings || [], new Set(inc.changedSet)).preserved, ...fresh])
      : fresh
  }
  const architecture = opts.scanOnly ? [] : await mapArchitecture(root, opts, oracleModel)
  const log = historyLog(root)
  const hotspots = codeHotspots(log)
  const forensics = computeForensics(log)
  const commands = extractCommands(root, files)
  const stack = detectStack(root, files)
  const tech = detectTech(root, files)
  const entrypoints = detectEntrypoints(root, files)
  const boundaries = detectBoundaries(root, files)
  // On the incremental reuse path the analysis is the cached one, so keep its
  // original timestamp — refreshing it here would make the freshness badge
  // perpetually report a stale scan as fresh.
  const scannedAt = reuse ? (inc.cache.scannedAt || new Date().toISOString()) : new Date().toISOString()
  // Persist scan history and escalate findings that keep reappearing across scans.
  const history = recordScan(readHistory(root), supported, { scannedAt })
  const escalated = escalate(supported, history, {})
  writeHistory(root, history)
  const sha = headSha(root)
  // The forged skill omits the vendor "overview" claim (SKILL.md's own description
  // already says what the project is), but the dashboard record keeps the FULL
  // architecture — repoBlurb uses the overview as the rich card/page description.
  const structuralArchitecture = architecture.filter(a => a.area !== 'overview')
  const findings = { project, sha, scannedAt, repoPath: root, stack, tech, architecture, opsFindings: escalated, hotspots, forensics, commands, entrypoints, boundaries, droppedByOracle: dropped.length }
  mkdirSync(join(root, '.smith'), { recursive: true })
  writeFileSync(join(root, '.smith', 'findings.json'), JSON.stringify(findings, null, 2))
  writeFileSync(join(root, '.smith', 'anomalies.json'), JSON.stringify(escalated, null, 2))  // back-compat (demo harness)
  // Cache the pre-escalation findings: escalation is history-driven, so reuse runs
  // must re-derive it rather than inherit already-bumped severities.
  if (opts.incremental) writeCache(root, { sha, scannedAt, fileHashes: inc.curHashes, findings: supported })
  let skillPath = null
  if (!opts.scanOnly) {
    const lessons = adaptLessons(readLessons(root))
    const built = buildSkillFiles(
      { repo: project, fullName: project, opsFindings: escalated, newCodeHotspots: hotspots },
      { name: `${project}-smith`, lessons, scannedAt: scannedAt.slice(0, 10), stack, architecture: structuralArchitecture, commands, entrypoints, boundaries, forensics }
    )
    skillPath = writeSkillFolder(root, built)
  }
  return { project, supported: escalated, dropped, architecture, hotspots, skillPath, json: findings }
}

// Hash the tree once and diff against the cache so runPipeline only orchestrates.
// changedSet is changed + added + removed — the files whose presence or content
// differs from the cached run, which is what relevance and finding-invalidation
// both key off.
function prepareIncremental(root, files) {
  const curHashes = fileHashes(root, files)
  const cache = readCache(root)
  const diff = cache ? diffHashes(cache.fileHashes, curHashes) : null
  const changedSet = diff ? [...diff.changed, ...diff.added, ...diff.removed] : []
  return { curHashes, cache, changedSet }
}

// Map the application's architecture, then hold every claim to the Oracle: a
// claim survives only if it cites a real file and that file backs it. Uncited
// claims are dropped here so "every claim cites a file" holds for architecture
// too — the Oracle fail-opens on a missing file, so it cannot enforce this.
async function mapArchitecture(root, opts, oracleModel) {
  const cited = (await scanArchitecture(root, opts)).filter(a => a.file)
  if (!cited.length || opts.oracle === false) return cited
  const validated = await validateFindings(root, cited.map(a => ({ ...a, text: a.claim })), { host: opts.host, model: oracleModel })
  return keepSupported(validated).map(a => ({ area: a.area, claim: a.claim, file: a.file }))
}
