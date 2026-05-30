// PR-time scanning — analyze one diff range instead of the whole repo. The swarm
// runs only on the files the change touches; deterministic risk checks layer on
// top so a PR scan still says something useful even when the LLM path is skipped.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { git, headSha, listFiles } from './git.mjs'
import { buildContext, scanContext, mergeFindings, RELEVANT, SCAN_PATTERNS } from './scan.mjs'
import { validateFindings, keepSupported, ORACLE_MODEL } from './oracle.mjs'
import { computeForensics } from './forensics.mjs'
import { historyLog } from './pipeline.mjs'

export function changedFilesInRange(root, base = 'HEAD~1', head = 'HEAD') {
  return git(['diff', '--name-only', `${base}...${head}`], root)
    .split('\n').map(s => s.trim()).filter(Boolean)
}

const relevantChanged = (changed, patterns) => changed.some(f => patterns.some(re => re.test(f)))

const ENV_FILE = /\.env(\..*)?$/
const ENV_EXAMPLE = /\.env\.(example|sample)$/

// Pure, deterministic PR risk checks — no LLM. Each returns findings tagged
// smith:'pr'. They catch the risks a diff makes obvious but a content scan can miss:
// touching a knowledge-silo file, changing release plumbing, or adding an env
// reference with no committed template for it.
export function prRiskChecks(changedFiles, { singleOwnerFiles = [], allFiles = [] } = {}) {
  const owned = new Set(singleOwnerFiles)
  const findings = []
  for (const f of changedFiles)
    if (owned.has(f)) findings.push({ smith: 'pr', severity: 'medium', text: `touches a single-owner file — only one person knows ${f}`, file: f })
  for (const f of changedFiles)
    if (RELEVANT.deploy.some(re => re.test(f))) findings.push({ smith: 'pr', severity: 'low', text: 'deploy/CI workflow changed — verify rollback coverage', file: f })
  const touchedEnv = changedFiles.find(f => ENV_FILE.test(f))
  if (touchedEnv && !allFiles.some(f => ENV_EXAMPLE.test(f)))
    findings.push({ smith: 'pr', severity: 'medium', text: 'env file changed without a committed .env.example', file: touchedEnv })
  return findings
}

export async function runPRScan(root, { base = 'HEAD~1', head = 'HEAD', oracle = true, host, local = false } = {}) {
  const changed = changedFilesInRange(root, base, head)
  if (!changed.length) return { base, head, changed: [], findings: [], note: 'no changes in range' }

  const all = listFiles(root)
  const allSet = new Set(all)
  const changedTracked = changed.filter(f => allSet.has(f))

  let swarm = []
  if (relevantChanged(changed, SCAN_PATTERNS)) {
    const ctx = {
      deploy: buildContext(root, changedTracked, RELEVANT.deploy),
      secret: buildContext(root, changedTracked, RELEVANT.secret),
      cron: buildContext(root, changedTracked, RELEVANT.cron),
    }
    const r = await scanContext(root, ctx, { local, host })
    swarm = r.findings
    if (oracle !== false && swarm.length) {
      const model = local ? ORACLE_MODEL.replace(/:cloud$/, '') : ORACLE_MODEL
      swarm = keepSupported(await validateFindings(root, swarm, { host, model }))
    }
  }

  const singleOwnerFiles = computeForensics(historyLog(root)).singleOwner.map(r => r.file)
  const risk = prRiskChecks(changed, { singleOwnerFiles, allFiles: all })
  const findings = mergeFindings([...swarm, ...risk])

  const result = { base, head, sha: headSha(root), changed, findings, scannedAt: new Date().toISOString() }
  mkdirSync(join(root, '.smith'), { recursive: true })
  writeFileSync(join(root, '.smith', 'pr-findings.json'), JSON.stringify(result, null, 2))
  return result
}
