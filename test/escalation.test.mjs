import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findingKey, recordScan, escalate, readHistory, writeHistory, ESCALATE_AFTER } from '../lib/escalation.mjs'

const AT = '2026-05-30T00:00:00.000Z'
const LATER = '2026-06-02T00:00:00.000Z'
const f = (over = {}) => ({ smith: 'deploy', file: 'r.yml', text: 'hardcoded secret', severity: 'low', ...over })

test('findingKey is stable for identical findings and differs across smith/file/text', () => {
  assert.equal(findingKey(f()), findingKey(f()))
  assert.equal(findingKey(f({ text: 'HARDCODED   SECRET' })), findingKey(f()), 'normalizes case and whitespace')
  assert.notEqual(findingKey(f({ smith: 'cron' })), findingKey(f()))
  assert.notEqual(findingKey(f({ file: 'other.yml' })), findingKey(f()))
  assert.notEqual(findingKey(f({ text: 'different finding' })), findingKey(f()))
})

test('recordScan adds new keys with count 1 and does not mutate the input', () => {
  const hist = {}
  const next = recordScan(hist, [f()], { scannedAt: AT })
  const key = findingKey(f())
  assert.equal(next[key].count, 1)
  assert.equal(next[key].firstSeen, AT)
  assert.equal(next[key].lastSeen, AT)
  assert.deepEqual(hist, {}, 'input history untouched')
  assert.notEqual(next, hist)
})

test('recordScan increments count and updates lastSeen on reappearance', () => {
  const first = recordScan({}, [f()], { scannedAt: AT })
  const second = recordScan(first, [f()], { scannedAt: LATER })
  const key = findingKey(f())
  assert.equal(second[key].count, 2)
  assert.equal(second[key].firstSeen, AT, 'firstSeen preserved')
  assert.equal(second[key].lastSeen, LATER)
  assert.equal(first[key].count, 1, 'prior history untouched')
})

test('escalate does not bump a finding below threshold', () => {
  const findings = [f()]
  let hist = recordScan({}, findings, { scannedAt: AT })
  assert.deepEqual(escalate(findings, hist, {}), findings, 'count 1 unchanged')
  hist = recordScan(hist, findings, { scannedAt: LATER })
  const out = escalate(findings, hist, {})
  assert.equal(out[0].severity, 'low')
  assert.equal(out[0].escalated, undefined, 'count 2 not marked')
})

test('escalate bumps low to medium and medium to high at threshold', () => {
  const low = [f({ severity: 'low' })]
  const med = [f({ text: 'weak permissions', severity: 'medium' })]
  let hist = {}
  for (let i = 0; i < ESCALATE_AFTER; i++) hist = recordScan(hist, [...low, ...med], { scannedAt: AT })
  const [bumpedLow] = escalate(low, hist, {})
  const [bumpedMed] = escalate(med, hist, {})
  assert.equal(bumpedLow.severity, 'medium')
  assert.equal(bumpedLow.escalated, true)
  assert.equal(bumpedLow.seenCount, ESCALATE_AFTER)
  assert.equal(bumpedMed.severity, 'high')
  assert.equal(bumpedMed.escalated, true)
})

test('escalate does not touch already-high findings and returns new objects', () => {
  const high = [f({ severity: 'high' })]
  let hist = {}
  for (let i = 0; i < ESCALATE_AFTER; i++) hist = recordScan(hist, high, { scannedAt: AT })
  const out = escalate(high, hist, {})
  assert.equal(out[0].severity, 'high')
  assert.equal(out[0].escalated, undefined, 'no double-bump')

  const low = [f({ severity: 'low' })]
  let lhist = {}
  for (let i = 0; i < ESCALATE_AFTER; i++) lhist = recordScan(lhist, low, { scannedAt: AT })
  const lout = escalate(low, lhist, {})
  assert.notEqual(lout[0], low[0], 'returns a new object')
  assert.equal(low[0].severity, 'low', 'input finding untouched')
  assert.equal(low[0].escalated, undefined)
})

test('readHistory returns {} when missing; writeHistory then readHistory round-trips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'smith-esc-'))
  try {
    assert.deepEqual(readHistory(dir), {})
    const hist = recordScan({}, [f()], { scannedAt: AT })
    writeHistory(dir, hist)
    assert.ok(existsSync(join(dir, '.smith', 'history.json')))
    assert.deepEqual(readHistory(dir), hist)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
