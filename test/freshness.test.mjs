import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeFreshness, freshnessBadge, repoFreshness } from '../lib/freshness.mjs'

const NOW = new Date('2026-05-30T00:00:00Z')
const daysAgo = n => new Date(NOW.getTime() - n * 86400000).toISOString()

test('fresh: recent scan, no cited file changed', () => {
  const f = computeFreshness({ scannedAt: daysAgo(2), citedFiles: ['src/a.ts'] }, { now: NOW, changedFiles: ['src/b.ts'] })
  assert.equal(f.status, 'fresh')
  assert.equal(f.daysSince, 2)
  assert.equal(f.changedCited, 0)
})

test('stale: a cited file changed even when the scan is recent', () => {
  const f = computeFreshness({ scannedAt: daysAgo(1), citedFiles: ['src/a.ts', 'src/c.ts'] }, { now: NOW, changedFiles: ['src/a.ts'] })
  assert.equal(f.status, 'stale')
  assert.equal(f.changedCited, 1)
})

test('stale: daysSince beyond the stale threshold', () => {
  const f = computeFreshness({ scannedAt: daysAgo(18), citedFiles: [] }, { now: NOW, changedFiles: [] })
  assert.equal(f.status, 'stale')
  assert.equal(f.daysSince, 18)
})

test('aging: ten days, nothing cited changed', () => {
  const f = computeFreshness({ scannedAt: daysAgo(10), citedFiles: ['src/a.ts'] }, { now: NOW, changedFiles: [] })
  assert.equal(f.status, 'aging')
  assert.equal(f.daysSince, 10)
})

test('unknown: missing scannedAt', () => {
  const f = computeFreshness({ citedFiles: ['src/a.ts'] }, { now: NOW, changedFiles: ['src/a.ts'] })
  assert.equal(f.status, 'unknown')
  assert.equal(f.daysSince, null)
})

test('unknown: invalid scannedAt', () => {
  assert.equal(computeFreshness({ scannedAt: 'not-a-date' }, { now: NOW }).status, 'unknown')
})

test('freshnessBadge encodes status word and matching color', () => {
  const fresh = freshnessBadge(computeFreshness({ scannedAt: daysAgo(2) }, { now: NOW }))
  assert.ok(fresh.includes('skill-fresh'))
  assert.ok(fresh.includes('3ddc84'))

  const stale = freshnessBadge(computeFreshness({ scannedAt: daysAgo(18), citedFiles: ['x'] }, { now: NOW, changedFiles: ['x'] }))
  assert.ok(stale.includes('stale'))
  assert.ok(stale.includes('e0563f'))
  assert.ok(stale.includes('claims'))

  const unknown = freshnessBadge(computeFreshness({}, { now: NOW }))
  assert.ok(unknown.includes('skill-unknown'))
  assert.ok(unknown.includes('8a8f87'))
})

test('repoFreshness returns null without .smith/findings.json', () => {
  const root = mkdtempSync(join(tmpdir(), 'ls-freshness-'))
  try { assert.equal(repoFreshness(root), null) }
  finally { rmSync(root, { recursive: true, force: true }) }
})
