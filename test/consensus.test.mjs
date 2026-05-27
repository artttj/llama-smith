import { test } from 'node:test'
import assert from 'node:assert/strict'
import { confirmExposure } from '../lib/consensus.mjs'

const agree = async () => ({ success: true, content: '{"confirmed":true}' })
const disagree = async () => ({ success: true, content: '{"confirmed":false}' })

test('keeps exposure when the second model confirms', async () => {
  const ex = { text: 'a GitHub token appears in .env', file: '.env', confidence: 'high' }
  assert.deepEqual(await confirmExposure(ex, ['m2'], agree, 'h'), ex)
})

test('drops exposure when the second model denies', async () => {
  const ex = { text: 'x', file: '.env', confidence: 'high' }
  assert.equal(await confirmExposure(ex, ['m2'], disagree, 'h'), null)
})

test('null exposure passes through as null', async () => {
  assert.equal(await confirmExposure(null, ['m2'], agree, 'h'), null)
})
