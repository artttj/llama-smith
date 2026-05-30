import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from '../llama-smith.mjs'

const args = (...rest) => parseArgs(['node', 'llama-smith.mjs', ...rest])

test('--base and --head parse to their values on the diff verb', () => {
  const a = args('diff', '--base', 'v1.0', '--head', 'v2.0')
  assert.equal(a.verb, 'diff')
  assert.equal(a.base, 'v1.0')
  assert.equal(a.head, 'v2.0')
})

test('--base and --head default to HEAD~1 / HEAD', () => {
  const a = args('diff')
  assert.equal(a.base, 'HEAD~1')
  assert.equal(a.head, 'HEAD')
})

test('a flag-like token is not swallowed as a --base value', () => {
  const a = args('diff', '--base', '--head', 'main')
  assert.equal(a.base, 'HEAD~1', '--base does not consume the following --head flag')
  assert.equal(a.head, 'main')
})

test('--port accepts a valid port', () => {
  assert.equal(args('serve', '--port', '8080').port, 8080)
})

test('--port falls back to 7777 for out-of-range or non-numeric values', () => {
  assert.equal(args('serve', '--port', '-1').port, 7777, 'negative rejected (does not crash listen)')
  assert.equal(args('serve', '--port', '99999').port, 7777, 'above 65535 rejected')
  assert.equal(args('serve', '--port', 'abc').port, 7777, 'non-numeric rejected')
  assert.equal(args('serve').port, 7777, 'absent flag keeps default')
})
