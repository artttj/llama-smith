// The production pipeline: investigator swarm (multi-round for stable recall)
// → Oracle validation → code-only churn → multi-file skill forge.
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { scanRepo, scanArchitecture } from './scan.mjs'
import { validateFindings, keepSupported, ORACLE_MODEL } from './oracle.mjs'
import { collectChurn, topHotspots } from './churn.mjs'
import { computeForensics } from './forensics.mjs'
import { git, headSha, listFiles } from './git.mjs'
import { parseMakefile, parsePackageScripts, parseComposerScripts, parseWorkflowCommands, classifyCommand } from './commands.mjs'
import { detectStack, detectEntrypoints, detectBoundaries } from './project.mjs'
import { buildSkillFiles, writeSkillFolder, adaptLessons } from './skill.mjs'
import { readLessons } from './lessons-store.mjs'

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

// The swarm is stochastic — a single round can miss findings (drizzle swung 7→0).
// Run R rounds concurrently (the lanes already prove Ollama serves in parallel),
// then union+dedup for stable recall.
export async function runScanRounds(root, opts = {}, rounds = 2) {
  const results = await Promise.all(Array.from({ length: rounds }, () => scanRepo(root, opts)))
  return dedupeFindings(results.flatMap(r => r.findings))
}

// One year of `git log --name-only` with author markers, shared by churn and
// forensics so the history is walked once. Churn ignores the @@@author lines.
export function historyLog(root) {
  return git('log --name-only --pretty=format:@@@%an|%ae --since="1 year ago"', root)
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
  const ops = await runScanRounds(root, opts, opts.scanOnly ? 1 : (opts.rounds || 2))
  const oracleModel = opts.local ? ORACLE_MODEL.replace(/:cloud$/, '') : ORACLE_MODEL
  const validated = opts.oracle === false
    ? ops.map(f => ({ ...f, oracle: { supported: true, reason: 'oracle disabled' } }))
    : await validateFindings(root, ops, { host: opts.host, model: oracleModel })
  const supported = keepSupported(validated)
  const dropped = validated.filter(f => f.oracle?.supported === false)
  const architecture = opts.scanOnly ? [] : await mapArchitecture(root, opts, oracleModel)
  const log = historyLog(root)
  const hotspots = codeHotspots(log)
  const forensics = computeForensics(log)
  const files = listFiles(root)
  const commands = extractCommands(root, files)
  const stack = detectStack(root, files)
  const entrypoints = detectEntrypoints(root, files)
  const boundaries = detectBoundaries(root, files)
  const scannedAt = new Date().toISOString()
  const findings = { project, sha: headSha(root), scannedAt, stack, architecture, opsFindings: supported, hotspots, forensics, commands, entrypoints, boundaries, droppedByOracle: dropped.length }
  mkdirSync(join(root, '.smith'), { recursive: true })
  writeFileSync(join(root, '.smith', 'findings.json'), JSON.stringify(findings, null, 2))
  writeFileSync(join(root, '.smith', 'anomalies.json'), JSON.stringify(supported, null, 2))  // back-compat (demo harness)
  let skillPath = null
  if (!opts.scanOnly) {
    const lessons = adaptLessons(readLessons(root))
    const built = buildSkillFiles(
      { repo: project, fullName: project, opsFindings: supported, newCodeHotspots: hotspots },
      { name: `${project}-smith`, lessons, scannedAt: scannedAt.slice(0, 10), stack, architecture, commands, entrypoints, boundaries, forensics }
    )
    skillPath = writeSkillFolder(root, built)
  }
  return { project, supported, dropped, architecture, hotspots, skillPath, json: findings }
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
