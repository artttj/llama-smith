import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cosineSimilarity, semanticDedupe } from '../lib/semantic.mjs'
import { dedupeFindings } from '../lib/pipeline.mjs'

test('cosineSimilarity: identical vectors → 1, orthogonal → 0, zero vector → 0 (no NaN)', () => {
  assert.equal(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1)
  assert.equal(cosineSimilarity([1, 0, 0], [0, 1, 0]), 0)
  const z = cosineSimilarity([0, 0, 0], [1, 2, 3])
  assert.equal(z, 0)
  assert.ok(!Number.isNaN(z))
})

const vec = { same: [1, 0, 0], near: [0.99, 0.14, 0], far: [0, 1, 0] }
const embedFrom = map => texts => Promise.resolve(texts.map(t => map[t]))

test('semanticDedupe collapses near-identical same-smith/file findings, keeping higher severity', async () => {
  const a = { smith: 'deploy', severity: 'medium', file: 'r.yml', text: 'A' }
  const b = { smith: 'deploy', severity: 'high', file: 'r.yml', text: 'B' }
  const out = await semanticDedupe([a, b], { embedFn: embedFrom({ A: vec.same, B: vec.near }) })
  assert.equal(out.length, 1)
  assert.equal(out[0].severity, 'high')
})

test('semanticDedupe keeps findings with distant vectors', async () => {
  const a = { smith: 'deploy', severity: 'high', file: 'r.yml', text: 'A' }
  const b = { smith: 'deploy', severity: 'low', file: 'r.yml', text: 'B' }
  const out = await semanticDedupe([a, b], { embedFn: embedFrom({ A: vec.same, B: vec.far }) })
  assert.equal(out.length, 2)
})

test('semanticDedupe never merges different smiths even with identical vectors', async () => {
  const a = { smith: 'deploy', severity: 'high', file: 'r.yml', text: 'A' }
  const b = { smith: 'cron', severity: 'high', file: 'r.yml', text: 'B' }
  const out = await semanticDedupe([a, b], { embedFn: embedFrom({ A: vec.same, B: vec.same }) })
  assert.equal(out.length, 2)
})

test('semanticDedupe returns a new array and leaves the input untouched', async () => {
  const input = [
    { smith: 'deploy', severity: 'medium', file: 'r.yml', text: 'A' },
    { smith: 'deploy', severity: 'high', file: 'r.yml', text: 'B' }
  ]
  const out = await semanticDedupe(input, { embedFn: embedFrom({ A: vec.same, B: vec.near }) })
  assert.notEqual(out, input)
  assert.equal(input.length, 2, 'input array unchanged')
})

// Pure fallback test: a throwing embedFn rejects semanticDedupe, and the lexical
// path (dedupeFindings) is what dedupeFindingsSemantic returns on that error.
// No real Ollama is contacted.
test('semanticDedupe rejects on embed error so the caller can fall back to lexical', async () => {
  const a = { smith: 'deploy', severity: 'medium', file: null, text: 'No rollback procedure exists for either npm or JSR publishes' }
  const b = { smith: 'deploy', severity: 'high', file: null, text: 'No rollback or unpublish mechanism exists for JSR or npm releases' }
  await assert.rejects(
    semanticDedupe([a, b], { embedFn: () => { throw new Error('boom') } }),
    /boom/
  )
  const lexical = dedupeFindings([a, b])
  assert.equal(lexical.length, 1, 'lexical fallback collapses the paraphrases')
  assert.equal(lexical[0].severity, 'high')
})
