import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeForensics, parseAuthorChurn } from '../lib/forensics.mjs'

const log = [
  '@@@alice', 'src/auth.js', 'src/db.js',
  '@@@alice', 'src/auth.js',
  '@@@bob', 'src/api.js', 'README.md',
  '@@@alice', 'src/auth.js',
].join('\n')

test('parseAuthorChurn maps files to authors per commit', () => {
  const fa = parseAuthorChurn(log)
  assert.deepEqual(fa['src/auth.js'], ['alice', 'alice', 'alice'])
  assert.equal(fa['src/api.js'][0], 'bob')
})

test('computeForensics flags single-owner code files and ignores docs', () => {
  const fr = computeForensics(log)
  const owned = fr.singleOwner.map(s => s.file)
  assert.ok(owned.includes('src/auth.js'))
  assert.ok(!fr.singleOwner.some(s => s.file === 'README.md'), 'docs excluded')
})

test('computeForensics reports a bus factor, risk tier, and module ownership', () => {
  const fr = computeForensics(log)
  assert.ok(fr.busFactor >= 1)
  assert.ok(['CRITICAL', 'HIGH', 'MODERATE', 'GOOD'].includes(fr.risk))
  assert.ok(fr.modules.some(m => m.module === 'src' && m.owner === 'alice'))
})
