// One-repo probe for the real-repo test harness.
// Usage: node scripts/probe.mjs <git-url> <slug>
// Clones blobless (full history, HEAD blobs only), runs the real forge,
// reads structured anomalies + the forged skill, computes the NEW code-only
// hotspots, flags non-code leaks from the OLD scar path, cleans up, prints JSON.
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, rmSync, readdirSync, realpathSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectChurn, topHotspots, isCodeFile } from '../lib/churn.mjs'

const [, , url, slug] = process.argv
// Canonicalize: macOS /var → /private/var. llama-smith.mjs's self-invocation
// guard compares its canonical import.meta.url to argv[1]; a symlinked path
// silently no-ops main(). realpathSync makes them match.
const LS = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))))
const CLI = join(LS, 'llama-smith.mjs')
// Clone under a dir whose basename IS the slug so the forged skill is named
// "<slug>-devops" instead of "<tmpdir>-devops".
const D = `/tmp/lsp/${slug}`
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })

const out = { repo: slug, url }
try {
  rmSync(D, { recursive: true, force: true })
  mkdirSync(dirname(D), { recursive: true })
  run('git', ['clone', '--filter=blob:none', '--quiet', url, D])
  out.commits = Number(run('git', ['-C', D, 'rev-list', '--count', 'HEAD']).trim())
  out.cloneMB = Number(run('du', ['-sm', D]).split(/\s/)[0].trim())

  const t0 = Date.now()
  try {
    out.forgeStdout = run('node', [CLI, 'forge', D, '--rounds', '1'], { cwd: LS, timeout: 290000 })
  } catch (e) {
    out.forgeStdout = (e.stdout || '') + '\nFORGE_ERROR: ' + (e.message || '')
  }
  out.scanSeconds = Math.round((Date.now() - t0) / 1000)

  const anomPath = join(D, '.smith', 'anomalies.json')
  const anomalies = existsSync(anomPath) ? JSON.parse(readFileSync(anomPath, 'utf8')) : []
  out.opsFindings = anomalies.filter(a => a.smith !== 'scar')
  out.oldScarFiles = anomalies.filter(a => a.smith === 'scar' && a.file).map(a => a.file)
  out.nonCodeLeaks = out.oldScarFiles.filter(f => !isCodeFile(f))

  // forged skill artifact (capture BEFORE churn so a churn failure never loses it)
  const skillsDir = join(D, '.claude', 'skills')
  out.skills = []
  if (existsSync(skillsDir)) {
    for (const name of readdirSync(skillsDir)) {
      const p = join(skillsDir, name, 'SKILL.md')
      if (existsSync(p)) out.skills.push({ name, body: readFileSync(p, 'utf8') })
    }
  }

  // code-only churn — partial clones can hit missing objects; tolerate it like the tool's git() does
  try {
    const log = run('git', ['-C', D, 'log', '--name-only', '--pretty=format:', '--since=1 year ago'])
    out.newCodeHotspots = topHotspots(collectChurn(log), { limit: 8 })
  } catch (e) {
    out.newCodeHotspots = []
    out.churnError = (e.message || 'churn failed').slice(0, 120)
  }
} catch (e) {
  out.error = e.message
} finally {
  rmSync(D, { recursive: true, force: true })
}
process.stdout.write(JSON.stringify(out))
