import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSmithFindings, mergeFindings } from '../lib/scan.mjs'
import { dedupeFindings } from '../lib/pipeline.mjs'

test('parseSmithFindings extracts anomalies, defaults severity, tags the smith', () => {
  const raw = '{"anomalies":[{"severity":"high","text":"hardcoded IP","file":"a.yml"},{"text":"no rollback"}]}'
  const out = parseSmithFindings(raw, 'deploy')
  assert.equal(out.length, 2)
  assert.equal(out[0].smith, 'deploy')
  assert.equal(out[0].severity, 'high')
  assert.equal(out[1].severity, 'medium', 'missing severity defaults to medium')
  assert.equal(out[1].file, null)
})

test('parseSmithFindings strips think blocks and tolerates surrounding prose', () => {
  const raw = '<think>reasoning</think> here: {"anomalies":[{"severity":"low","text":"x"}]} done'
  assert.equal(parseSmithFindings(raw, 'cron').length, 1)
})

test('parseSmithFindings returns [] on garbage or empty', () => {
  assert.deepEqual(parseSmithFindings('', 'deploy'), [])
  assert.deepEqual(parseSmithFindings('no json here', 'deploy'), [])
})

test('mergeFindings sorts high → medium → low', () => {
  const sorted = mergeFindings([{ severity: 'low' }, { severity: 'high' }, { severity: 'medium' }])
  assert.deepEqual(sorted.map(f => f.severity), ['high', 'medium', 'low'])
})

test('dedupeFindings collapses identical findings; keeps a different smith', () => {
  const a = { smith: 'deploy', severity: 'high', file: 'r.yml', text: 'hardcoded IP 1.2.3.4 in the release step' }
  const b = { smith: 'deploy', severity: 'high', file: 'r.yml', text: 'hardcoded IP 1.2.3.4 in the release step' }
  const c = { smith: 'cron', severity: 'low', file: 'r.yml', text: 'hardcoded IP 1.2.3.4 in the release step' }
  assert.equal(dedupeFindings([a, b, c]).length, 2)
})

test('dedupeFindings merges paraphrases of the same issue, keeping higher severity', () => {
  const a = { smith: 'deploy', severity: 'medium', file: null, text: 'No rollback procedure exists for either npm or JSR publishes' }
  const b = { smith: 'deploy', severity: 'high', file: null, text: 'No rollback or unpublish mechanism exists for JSR or npm releases' }
  const out = dedupeFindings([a, b])
  assert.equal(out.length, 1, 'paraphrases of the same finding collapse')
  assert.equal(out[0].severity, 'high', 'keeps the higher-severity phrasing')
})

test('dedupeFindings keeps genuinely distinct findings on the same file', () => {
  const a = { smith: 'deploy', severity: 'high', file: 'r.yml', text: 'hardcoded IP address in the SSH deploy step' }
  const b = { smith: 'deploy', severity: 'low', file: 'r.yml', text: 'release triggers on any tag without semver filtering' }
  assert.equal(dedupeFindings([a, b]).length, 2)
})
