import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assembleManifest, writeManifest, readManifest } from '../lib/manifest.mjs'

test('assembleManifest builds the versioned shape', () => {
  const m = assembleManifest({ project: 'myapp', sha: 'abc1234',
    entries: [{ skill: 'smith-overview', purpose: 'p', trigger: 'always', evidence: [], confidence: 'high' }],
    exposure: { text: 'x', file: '.env', confidence: 'high' } })
  assert.equal(m.version, 1)
  assert.equal(m.project, 'myapp')
  assert.equal(m.scanned_sha, 'abc1234')
  assert.equal(m.skills.length, 1)
  assert.equal(m.exposure.file, '.env')
})

test('writeManifest then readManifest round-trips', () => {
  const d = mkdtempSync(join(tmpdir(), 'lsm-'))
  try {
    const m = assembleManifest({ project: 'p', sha: 's', entries: [], exposure: null })
    writeManifest(d, m)
    const back = readManifest(d)
    assert.equal(back.version, 1)
    assert.equal(back.project, 'p')
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('readManifest returns null when absent', () => {
  const d = mkdtempSync(join(tmpdir(), 'lsm-'))
  try { assert.equal(readManifest(d), null) } finally { rmSync(d, { recursive: true, force: true }) }
})
