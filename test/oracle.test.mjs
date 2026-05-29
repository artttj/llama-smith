import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseVerdict, keepSupported, validateFindings } from '../lib/oracle.mjs'

test('parseVerdict reads a clean supported verdict', () => {
  const v = parseVerdict('{"supported": true, "reason": "the file shows it"}')
  assert.equal(v.supported, true)
  assert.equal(v.reason, 'the file shows it')
})

test('parseVerdict reads an unsupported verdict', () => {
  const v = parseVerdict('sure: {"supported": false, "reason": "not in file"}')
  assert.equal(v.supported, false)
})

test('parseVerdict strips think blocks and tolerates surrounding prose', () => {
  const v = parseVerdict('<think>hmm</think> verdict: {"supported": false, "reason": "x"} done')
  assert.equal(v.supported, false)
})

test('parseVerdict fails OPEN on unparseable output (never silently drop a real finding)', () => {
  const v = parseVerdict('the model rambled with no json')
  assert.equal(v.supported, true)
  assert.match(v.reason, /unparseable/)
})

test('validateFindings handles no-file, escaping, and missing files without calling the model', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ls-oracle-'))
  try {
    const out = await validateFindings(root, [
      { smith: 'deploy', text: 'a', file: null },
      { smith: 'deploy', text: 'b', file: '../../../../etc/passwd' },
      { smith: 'deploy', text: 'c', file: 'does-not-exist.yml' },
    ])
    assert.equal(out[0].oracle.supported, true)            // no file to check → kept
    assert.equal(out[1].oracle.supported, false)           // path traversal → dropped
    assert.match(out[1].oracle.reason, /escapes the repo/)
    assert.equal(out[2].oracle.supported, false)           // cited file absent → dropped
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('keepSupported drops only explicit-false verdicts', () => {
  const validated = [
    { text: 'a', oracle: { supported: true } },
    { text: 'b', oracle: { supported: false } },
    { text: 'c', oracle: { supported: true, reason: 'oracle error — kept' } },
  ]
  const kept = keepSupported(validated)
  assert.deepEqual(kept.map(f => f.text), ['a', 'c'])
})
