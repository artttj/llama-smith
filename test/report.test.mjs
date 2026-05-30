import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const LS = join(__dirname, '..')

test('repo page includes re-scan button with absolute path command', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ls-report-'))
  const data = [{
    repo: 'kerge',
    repoPath: '/Users/art/projects/kerge',
    stack: 'JS',
    commits: 42,
    opsFindings: [],
    architecture: [],
    forensics: { busFactor: 2, risk: 'MODERATE', contributors: 3, topContributors: [] },
    commands: [],
    entrypoints: [],
    boundaries: [],
    scannedAt: new Date().toISOString(),
  }]
  const jsonPath = join(tmp, 'data.json')
  writeFileSync(jsonPath, JSON.stringify(data))
  const outDir = join(tmp, 'reports')

  execFileSync('node', ['scripts/report.mjs', jsonPath, outDir], { cwd: LS })

  const html = readFileSync(join(outDir, 'kerge.html'), 'utf8')
  assert.ok(html.includes('rescan-btn'), 'button class present')
  assert.ok(html.includes('data-cmd='), 'data-cmd attribute present')
  assert.ok(html.includes('/Users/art/projects/kerge'), 'repoPath in command')
  assert.ok(html.includes('id="toast"'), 'toast div present')
  assert.ok(html.includes('role="status"'), 'toast has status role')

  rmSync(tmp, { recursive: true, force: true })
})

test('repo page falls back to relative command when repoPath is absent', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ls-report-'))
  const data = [{
    repo: 'bare-repo',
    stack: 'JS',
    commits: 10,
    opsFindings: [],
    architecture: [],
    forensics: null,
    commands: [],
    entrypoints: [],
    boundaries: [],
    scannedAt: new Date().toISOString(),
  }]
  const jsonPath = join(tmp, 'data.json')
  writeFileSync(jsonPath, JSON.stringify(data))
  const outDir = join(tmp, 'reports')

  execFileSync('node', ['scripts/report.mjs', jsonPath, outDir], { cwd: LS })

  const html = readFileSync(join(outDir, 'bare-repo.html'), 'utf8')
  assert.ok(html.includes('rescan-btn'), 'button present for repo name fallback')
  assert.ok(html.includes('cd ../bare-repo'), 'relative fallback in command')

  rmSync(tmp, { recursive: true, force: true })
})

test('repo page quotes paths containing spaces', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ls-report-'))
  const data = [{
    repo: 'my project',
    repoPath: '/Users/art/my projects/kerge',
    stack: 'JS',
    commits: 10,
    opsFindings: [],
    architecture: [],
    forensics: null,
    commands: [],
    entrypoints: [],
    boundaries: [],
    scannedAt: new Date().toISOString(),
  }]
  const jsonPath = join(tmp, 'data.json')
  writeFileSync(jsonPath, JSON.stringify(data))
  const outDir = join(tmp, 'reports')

  execFileSync('node', ['scripts/report.mjs', jsonPath, outDir], { cwd: LS })

  const html = readFileSync(join(outDir, 'my_project.html'), 'utf8')
  assert.ok(html.includes('my projects'), 'repoPath with spaces present in command')
  assert.ok(html.includes('&quot;'), 'quotes escaped as HTML entities')

  rmSync(tmp, { recursive: true, force: true })
})
