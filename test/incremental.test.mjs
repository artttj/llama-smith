import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileHashes, diffHashes, relevantChanged, partitionFindings, readCache, writeCache } from '../lib/incremental.mjs'

const withTmp = fn => {
  const dir = mkdtempSync(join(tmpdir(), 'smith-inc-'))
  try { return fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('fileHashes: identical content hashes equal, different content differs, stable across calls', () => {
  withTmp(dir => {
    writeFileSync(join(dir, 'a.txt'), 'same bytes')
    writeFileSync(join(dir, 'b.txt'), 'same bytes')
    writeFileSync(join(dir, 'c.txt'), 'other bytes')
    const h1 = fileHashes(dir, ['a.txt', 'b.txt', 'c.txt'])
    assert.equal(h1['a.txt'], h1['b.txt'], 'identical files share a hash')
    assert.notEqual(h1['a.txt'], h1['c.txt'], 'different content differs')
    const h2 = fileHashes(dir, ['a.txt', 'b.txt', 'c.txt'])
    assert.deepEqual(h1, h2, 'stable across calls')
  })
})

test('fileHashes: editing content changes the hash, skips unreadable files', () => {
  withTmp(dir => {
    writeFileSync(join(dir, 'a.txt'), 'v1')
    const before = fileHashes(dir, ['a.txt', 'missing.txt'])
    assert.ok(before['a.txt'])
    assert.ok(!('missing.txt' in before), 'unreadable file skipped')
    writeFileSync(join(dir, 'a.txt'), 'v2')
    const after = fileHashes(dir, ['a.txt'])
    assert.notEqual(before['a.txt'], after['a.txt'])
  })
})

test('diffHashes: classifies changed, added, removed, unchanged', () => {
  const prev = { keep: '1', edit: 'old', gone: '3' }
  const cur = { keep: '1', edit: 'new', born: '4' }
  const d = diffHashes(prev, cur)
  assert.deepEqual(d.changed, ['edit'])
  assert.deepEqual(d.added, ['born'])
  assert.deepEqual(d.removed, ['gone'])
  assert.deepEqual(d.unchanged, ['keep'])
})

test('diffHashes: defaults to empty maps', () => {
  assert.deepEqual(diffHashes(), { changed: [], added: [], removed: [], unchanged: [] })
})

test('relevantChanged: true when a changed file matches any pattern array', () => {
  const deploy = [/\.github\/workflows\/.*\.ya?ml$/, /^Dockerfile$/]
  const arch = [/readme/i]
  assert.equal(relevantChanged(['.github/workflows/ci.yml'], [deploy, arch]), true)
  assert.equal(relevantChanged(['README.md'], [deploy]), false, 'irrelevant file does not match deploy patterns')
  assert.equal(relevantChanged(['README.md'], [deploy, arch]), true, 'matched by the arch array')
  assert.equal(relevantChanged([], [deploy, arch]), false)
})

test('partitionFindings: preserves unchanged-file findings, invalidates changed and null-file', () => {
  const prev = [
    { smith: 'deploy', file: 'stable.yml', text: 'keep me' },
    { smith: 'deploy', file: 'touched.yml', text: 'drop me' },
    { smith: 'secret', file: null, text: 'no file — re-derive' },
  ]
  const changed = new Set(['touched.yml'])
  const { preserved, invalidated } = partitionFindings(prev, changed)
  assert.deepEqual(preserved.map(f => f.text), ['keep me'])
  assert.deepEqual(invalidated.map(f => f.text), ['drop me', 'no file — re-derive'])
  assert.equal(prev.length, 3, 'input array unchanged')
  assert.notEqual(preserved, prev)
})

test('partitionFindings: defaults to empty list', () => {
  const { preserved, invalidated } = partitionFindings(undefined, new Set())
  assert.deepEqual(preserved, [])
  assert.deepEqual(invalidated, [])
})

test('readCache: null when no cache exists; writeCache → readCache round-trips', () => {
  withTmp(dir => {
    assert.equal(readCache(dir), null)
    const cache = {
      sha: 'abc123', scannedAt: '2026-05-30T00:00:00.000Z',
      fileHashes: { 'a.txt': 'h1' },
      findings: [{ smith: 'deploy', severity: 'high', file: 'a.yml', text: 'x' }],
    }
    writeCache(dir, cache)
    assert.deepEqual(readCache(dir), cache)
  })
})

test('readCache: returns null on corrupt JSON', () => {
  withTmp(dir => {
    mkdirSync(join(dir, '.smith'), { recursive: true })
    writeFileSync(join(dir, '.smith', 'scan-cache.json'), '{ not json')
    assert.equal(readCache(dir), null)
  })
})
