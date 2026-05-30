import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prRiskChecks, changedFilesInRange } from '../lib/prscan.mjs'

test('prRiskChecks flags a touched single-owner file', () => {
  const out = prRiskChecks(['src/auth.ts'], { singleOwnerFiles: ['src/auth.ts'], allFiles: ['src/auth.ts'] })
  assert.equal(out.length, 1)
  assert.equal(out[0].smith, 'pr')
  assert.equal(out[0].severity, 'medium')
  assert.equal(out[0].file, 'src/auth.ts')
})

test('prRiskChecks flags a deploy/CI workflow change', () => {
  const out = prRiskChecks(['.github/workflows/deploy.yml'], { allFiles: ['.github/workflows/deploy.yml'] })
  assert.equal(out.length, 1)
  assert.equal(out[0].severity, 'low')
  assert.match(out[0].text, /rollback coverage/)
  assert.equal(out[0].file, '.github/workflows/deploy.yml')
})

test('prRiskChecks flags an .env change when no .env.example is committed', () => {
  const out = prRiskChecks(['.env'], { allFiles: ['.env', 'README.md'] })
  assert.equal(out.length, 1)
  assert.match(out[0].text, /\.env\.example/)
  assert.equal(out[0].severity, 'medium')
})

test('prRiskChecks does NOT flag an .env change when .env.example is present', () => {
  const out = prRiskChecks(['.env'], { allFiles: ['.env', '.env.example'] })
  assert.deepEqual(out, [])
})

test('prRiskChecks returns [] for innocuous changes', () => {
  const out = prRiskChecks(['README.md', 'src/util.ts'], { singleOwnerFiles: ['src/other.ts'], allFiles: ['README.md', 'src/util.ts'] })
  assert.deepEqual(out, [])
})

test('changedFilesInRange returns [] when not a git repo', () => {
  const d = mkdtempSync(join(tmpdir(), 'prscan-'))
  try {
    assert.deepEqual(changedFilesInRange(d), [])
    assert.deepEqual(changedFilesInRange(d, 'main', 'feature'), [])
  } finally { rmSync(d, { recursive: true, force: true }) }
})
