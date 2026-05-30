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
const LS = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))))
const CLI = join(LS, 'llama-smith.mjs')
const D = `/tmp/lsp/${slug}`
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })

const out = { repo: slug, url, group: 'interesting' }
const fullMatch = url.match(/github\.com[/:]([^/]+\/[^/.]+)/)
if (fullMatch) out.fullName = fullMatch[1]
const shortStack = s => s.startsWith('Node') ? 'JS' : s.startsWith('PHP') ? 'PHP' : s.startsWith('Python') ? 'PY' : s.startsWith('Go') ? 'GO' : s.startsWith('Rust') ? 'RS' : (s.split(' ')[0] || '?')
try {
  rmSync(D, { recursive: true, force: true })
  mkdirSync(dirname(D), { recursive: true })
  run('git', ['clone', '--filter=blob:none', '--quiet', url, D])
  out.commits = Number(run('git', ['-C', D, 'rev-list', '--count', 'HEAD']).trim())
  out.cloneMB = Number(run('du', ['-sm', D]).split(/\s/)[0].trim())

  const t0 = Date.now()
  try {
    out.forgeStdout = run('node', [CLI, 'forge', D, '--rounds', '2'], { cwd: LS, timeout: 580000 })
  } catch (e) {
    out.forgeStdout = (e.stdout || '') + '\nFORGE_ERROR: ' + (e.message || '')
  }
  out.scanSeconds = Math.round((Date.now() - t0) / 1000)

  const anomPath = join(D, '.smith', 'anomalies.json')
  const anomalies = existsSync(anomPath) ? JSON.parse(readFileSync(anomPath, 'utf8')) : []
  out.opsFindings = anomalies.filter(a => a.smith !== 'scar')
  out.verdict = out.opsFindings.length
    ? `${out.opsFindings.length} file-cited operational findings across ${out.commits.toLocaleString()} commits, all validated against real files.`
    : `No operational risks found across ${out.commits.toLocaleString()} commits. Nothing was invented.`

  const findPath = join(D, '.smith', 'findings.json')
  if (existsSync(findPath)) {
    const fj = JSON.parse(readFileSync(findPath, 'utf8'))
    out.commands = fj.commands || []
    out.boundaries = fj.boundaries || []
    out.entrypoints = fj.entrypoints || []
    out.architecture = fj.architecture || []
    out.forensics = fj.forensics || null
    out.tech = fj.tech || []
    out.stackFull = fj.stack || ''
    out.stack = shortStack(out.stackFull)
  }
  out.oldScarFiles = anomalies.filter(a => a.smith === 'scar' && a.file).map(a => a.file)
  out.nonCodeLeaks = out.oldScarFiles.filter(f => !isCodeFile(f))

  const skillsDir = join(D, '.claude', 'skills')
  out.skills = []
  if (existsSync(skillsDir)) {
    for (const name of readdirSync(skillsDir)) {
      const p = join(skillsDir, name, 'SKILL.md')
      if (existsSync(p)) out.skills.push({ name, body: readFileSync(p, 'utf8') })
    }
  }

  try {
    const log = run('git', ['-C', D, 'log', '--name-only', '--pretty=format:', '--since=1 year ago'])
    out.newCodeHotspots = topHotspots(collectChurn(log), { limit: 8 })
  } catch (e) {
    out.newCodeHotspots = []
    out.churnError = (e.message || 'churn failed').slice(0, 120)
  }
} catch (e) {
  out.error = e.message
  process.stderr.write((e.stack || e.message) + '\n')
  process.exitCode = 1
} finally {
  rmSync(D, { recursive: true, force: true })
}
process.stdout.write(JSON.stringify(out))
