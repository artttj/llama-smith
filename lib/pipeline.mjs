// The production pipeline: investigator swarm (multi-round for stable recall)
// → Oracle validation → code-only churn → multi-file skill forge.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { scanRepo } from './scan.mjs'
import { validateFindings, keepSupported, ORACLE_MODEL } from './oracle.mjs'
import { collectChurn, topHotspots } from './churn.mjs'
import { git, headSha } from './git.mjs'
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

export function codeHotspots(root) {
  const log = git('log --name-only --pretty=format: --since="1 year ago"', root)
  return topHotspots(collectChurn(log), { limit: 8 })
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
  const hotspots = codeHotspots(root)
  const scannedAt = new Date().toISOString()
  const findings = { project, sha: headSha(root), scannedAt, opsFindings: supported, hotspots, droppedByOracle: dropped.length }
  mkdirSync(join(root, '.smith'), { recursive: true })
  writeFileSync(join(root, '.smith', 'findings.json'), JSON.stringify(findings, null, 2))
  writeFileSync(join(root, '.smith', 'anomalies.json'), JSON.stringify(supported, null, 2))  // back-compat (demo harness)
  let skillPath = null
  if (!opts.scanOnly) {
    const lessons = adaptLessons(readLessons(root))
    const built = buildSkillFiles(
      { repo: project, fullName: project, opsFindings: supported, newCodeHotspots: hotspots },
      { name: `${project}-smith`, lessons, scannedAt: scannedAt.slice(0, 10) }
    )
    skillPath = writeSkillFolder(root, built)
  }
  return { project, supported, dropped, hotspots, skillPath, json: findings }
}
