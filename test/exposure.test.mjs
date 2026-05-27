import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findExposures, topExposure } from '../lib/exposure.mjs'

test('detects an AWS key and never returns the value', () => {
  const files = [{ file: '.env', content: 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n' }]
  const ex = findExposures(files)
  assert.equal(ex.length, 1)
  assert.equal(ex[0].file, '.env')
  assert.match(ex[0].text, /AWS/)
  assert.doesNotMatch(JSON.stringify(ex[0]), /AKIAIOSFODNN7EXAMPLE/)
})

test('detects generic high-entropy assignment to a secret-named var', () => {
  const files = [{ file: 'config.php', content: "$apiToken = 'sk_live_8fkd93kfj20dkfj20fkd02';" }]
  const ex = findExposures(files)
  assert.ok(ex.some(e => /token|secret|key/i.test(e.text)))
})

test('topExposure returns highest-severity or null', () => {
  assert.equal(topExposure([]), null)
  const t = topExposure([{ text: 'a', file: 'x', confidence: 'low' }, { text: 'b', file: 'y', confidence: 'high' }])
  assert.equal(t.text, 'b')
})
