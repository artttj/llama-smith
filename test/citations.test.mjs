import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkCitations } from '../lib/citations.mjs'

test('all citations known → ok', () => {
  const body = 'Run build (← Makefile) and deploy (← docker-compose.yml).'
  const r = checkCitations(body, ['Makefile', 'docker-compose.yml'])
  assert.equal(r.ok, true)
  assert.deepEqual(r.unknownCitations, [])
})

test('citation to a non-evidence file is flagged', () => {
  const body = 'Run secret stuff (← /etc/passwd).'
  const r = checkCitations(body, ['Makefile'])
  assert.equal(r.ok, false)
  assert.ok(r.unknownCitations.includes('/etc/passwd'))
})

test('no citations → ok with empty list', () => {
  const r = checkCitations('plain prose, nothing cited', ['Makefile'])
  assert.equal(r.ok, true)
  assert.deepEqual(r.cited, [])
})
