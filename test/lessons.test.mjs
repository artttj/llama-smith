import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLessonPrompt, parseLessons } from '../lib/lessons.mjs'

test('buildLessonPrompt embeds moments, project, and asks for grounded JSON', () => {
  const p = buildLessonPrompt([{ kind: 'error', ts: '2026-02-14T01:13:00Z', text: 'rollback failed' }], 'myapp')
  assert.match(p, /myapp/)
  assert.match(p, /rollback failed/)
  assert.match(p, /2026-02-14T01:13/)
  assert.match(p, /JSON/)
  assert.match(p, /faceplant/)
})

test('parseLessons reads up to 8 lessons with kind, paths, confidence, learned', () => {
  const raw = '{"lessons":[{"text":"a — b","kind":"use-x-not-y","paths":["Makefile"],"confidence":"high","learned":"2026-02-14T01:13:00Z"}]}'
  const l = parseLessons(raw)
  assert.equal(l.length, 1)
  assert.equal(l[0].kind, 'use-x-not-y')
  assert.deepEqual(l[0].paths, ['Makefile'])
  assert.equal(l[0].learned, '2026-02-14T01:13:00Z')
})

test('parseLessons defaults bad kind to gotcha and tolerates junk', () => {
  assert.equal(parseLessons('{"lessons":[{"text":"x","kind":"weird"}]}')[0].kind, 'gotcha')
  assert.deepEqual(parseLessons('rambling'), [])
})
