import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeForensics, parseAuthorChurn, parseCommits, githubLogin } from '../lib/forensics.mjs'

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

const coupledLog = ['@@@a', 'x.js', 'y.js', '@@@b', 'x.js', 'y.js', '@@@a', 'x.js', 'y.js'].join('\n')

test('computeForensics surfaces change coupling for files that co-change', () => {
  const fr = computeForensics(coupledLog)
  const pair = fr.coupling[0]
  assert.ok(pair && [pair.a, pair.b].sort().join() === 'x.js,y.js')
  assert.equal(pair.count, 3)
})

test('githubLogin extracts username from noreply commit emails', () => {
  assert.equal(githubLogin(['123+octocat@users.noreply.github.com']), 'octocat')
  assert.equal(githubLogin(['dougwilson@users.noreply.github.com']), 'dougwilson')
  assert.equal(githubLogin(['real@example.com']), null)
})

test('parseCommits captures author and email; topContributors carry a login', () => {
  const log = '@@@Doug|123+dougwilson@users.noreply.github.com\nsrc/a.js\n@@@Doug|123+dougwilson@users.noreply.github.com\nsrc/a.js'
  assert.equal(parseCommits(log)[0].email, '123+dougwilson@users.noreply.github.com')
  const fr = computeForensics(log)
  assert.equal(fr.topContributors[0].login, 'dougwilson')
})

test('computeForensics counts contributors and single-owner ratio', () => {
  const fr = computeForensics(coupledLog)
  assert.equal(fr.contributors, 2)
  assert.ok(fr.topContributors.length >= 1)
  assert.ok(fr.singleOwnerRatio >= 0 && fr.singleOwnerRatio <= 1)
})
