import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vibeScore } from '../lib/vibe.mjs'

test('clean manifest scores 100 / pristine', () => {
  const v = vibeScore({ anomalies: [], exposure: null })
  assert.equal(v.total, 100)
  assert.equal(v.label, 'PRISTINE')
})

test('gotchas deduct from their mapped dimension', () => {
  const v = vibeScore({ anomalies: [{ domain: 'CRON' }, { domain: 'DRIFT' }], exposure: null })
  assert.equal(v.dims.hygiene, 25 - 12)
  assert.equal(v.dims.safety, 25)
})

test('exposure hits safety by confidence', () => {
  assert.equal(vibeScore({ exposure: { confidence: 'high' } }).dims.safety, 10)
  assert.equal(vibeScore({ exposure: { confidence: 'low' } }).dims.safety, 20)
})

test('faceplant lessons erode fragility', () => {
  const v = vibeScore({ anomalies: [] }, { lessons: [{ kind: 'faceplant' }, { kind: 'gotcha' }] })
  assert.equal(v.dims.fragility, 25 - 4)
})

test('runtime stays full + unverified until probed; penalty applies when verified', () => {
  assert.equal(vibeScore({}).runtimeVerified, false)
  assert.equal(vibeScore({}).dims.runtime, 25)
  assert.equal(vibeScore({}, { runtimeVerified: true, runtimePenalty: 19 }).dims.runtime, 6)
})

test('a rough repo lands in a low tier', () => {
  const v = vibeScore(
    { anomalies: [{ domain: 'DEPLOY' }, { domain: 'CRON' }, { domain: 'DRIFT' }], exposure: { confidence: 'high' } },
    { lessons: [{ kind: 'faceplant' }, { kind: 'faceplant' }] }
  )
  assert.ok(v.total < 90)
  assert.ok(['PRISTINE', 'SOLID', 'SMELLS FUNNY', 'NEEDS HELP', 'DUMPSTER FIRE'].includes(v.label))
})
