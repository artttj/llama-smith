import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendLesson, readLessons } from '../lib/lessons-store.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'ls-lessons-'))

test('a correction enters at HIGH confidence', () => {
  const root = tmp()
  try {
    appendLesson(root, { text: 'deploy from production, not main', source: 'correction' })
    const [l] = readLessons(root)
    assert.equal(l.confidence, 0.9)
    assert.equal(l.count, 1)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('an observation enters LOW and graduates as it recurs', () => {
  const root = tmp()
  try {
    appendLesson(root, { text: 'reindex after a deploy', source: 'observation' })
    assert.equal(readLessons(root)[0].confidence, 0.4)
    // recur a few times
    appendLesson(root, { text: 'reindex after a deploy', source: 'observation' })
    appendLesson(root, { text: 'Reindex  after a   deploy', source: 'observation' }) // normalized dedup
    const [l] = readLessons(root)
    assert.equal(l.count, 3, 'deduped by normalized text')
    assert.ok(l.confidence > 0.4, 'confidence climbs with recurrence')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('a correction pins HIGH even over a prior observation', () => {
  const root = tmp()
  try {
    appendLesson(root, { text: 'use the makefile target', source: 'observation' })
    appendLesson(root, { text: 'use the makefile target', source: 'correction' })
    assert.equal(readLessons(root)[0].confidence, 0.9)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('readLessons returns [] for a repo with no store', () => {
  const root = tmp()
  try { assert.deepEqual(readLessons(root), []) }
  finally { rmSync(root, { recursive: true, force: true }) }
})
