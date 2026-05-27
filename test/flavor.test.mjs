import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFlavorPrompt, parseFlavor } from '../lib/flavor.mjs'

test('buildFlavorPrompt includes manifest content and asks for JSON', () => {
  const p = buildFlavorPrompt([{ file: 'composer.json', content: '{"require":{"magento/product-community-edition":"*"}}' }])
  assert.match(p, /composer\.json/)
  assert.match(p, /JSON/i)
})

test('parseFlavor reads framework + confidence, tolerates junk', () => {
  assert.deepEqual(parseFlavor('{"framework":"Magento","confidence":"high"}'),
    { framework: 'Magento', confidence: 'high' })
  assert.equal(parseFlavor('the model rambled'), null)
  assert.equal(parseFlavor('{"framework":null}').framework, null)
})
