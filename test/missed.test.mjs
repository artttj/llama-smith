import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendLesson, readLessons } from '../lib/lessons-store.mjs'
import { lanePrompt } from '../lib/scan.mjs'
import { parseArgs } from '../llama-smith.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'ls-missed-'))

test('a missed finding enters at MISSED confidence and is tagged kind:missed', () => {
  const root = tmp()
  try {
    appendLesson(root, { text: 'hardcoded key in src/config.js', source: 'missed' })
    const [l] = readLessons(root)
    assert.equal(l.confidence, 0.7)
    assert.equal(l.kind, 'missed')
    assert.equal(l.source, 'missed')
    assert.equal(l.count, 1)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('a missed finding stays kind:missed even when caller passes a kind', () => {
  const root = tmp()
  try {
    appendLesson(root, { text: 'no rollback for the worker queue', source: 'missed', kind: 'decision' })
    assert.equal(readLessons(root)[0].kind, 'missed')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('a missed finding graduates as it recurs, keeping kind:missed', () => {
  const root = tmp()
  try {
    appendLesson(root, { text: 'cron job has no alerting', source: 'missed' })
    appendLesson(root, { text: 'cron job has no alerting', source: 'missed' })
    appendLesson(root, { text: 'Cron  job has   no alerting', source: 'missed' }) // normalized dedup
    const [l] = readLessons(root)
    assert.equal(l.count, 3, 'deduped by normalized text')
    assert.ok(l.confidence > 0.7, 'confidence climbs with recurrence')
    assert.equal(l.kind, 'missed')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('parseArgs captures --missed as the full string and keeps verb run', () => {
  const args = parseArgs(['node', 'llama-smith.mjs', '--missed', 'hardcoded key in src/config.js'])
  assert.equal(args.missed, 'hardcoded key in src/config.js')
  assert.equal(args.verb, 'run')
})

test('parseArgs leaves missed falsy without the flag', () => {
  const args = parseArgs(['node', 'llama-smith.mjs', 'scan', '.'])
  assert.ok(!args.missed)
})

test('parseArgs treats a flag-like next token as a missing --missed value', () => {
  const args = parseArgs(['node', 'llama-smith.mjs', '--missed', '--json'])
  assert.ok(!args.missed)
  assert.equal(args.json, true)
})

test('lanePrompt embeds hints under the PREVIOUSLY MISSED marker', () => {
  const p = lanePrompt('deploy', 'CTX', ['check src/config.js for keys'])
  assert.match(p, /PREVIOUSLY MISSED/)
  assert.match(p, /check src\/config\.js for keys/)
})

test('lanePrompt with no hints omits the PREVIOUSLY MISSED marker', () => {
  const p = lanePrompt('deploy', 'CTX')
  assert.doesNotMatch(p, /PREVIOUSLY MISSED/)
  assert.match(p, /CTX/)
})
