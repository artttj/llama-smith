import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roleGuidance } from '../lib/templates.mjs'

test('commands role guidance demands real commands + citation', () => {
  const g = roleGuidance('smith-commands')
  assert.match(g, /command/i)
  assert.match(g, /cite|source|unknown/i)
})

test('security role guidance forbids printing secret values', () => {
  const g = roleGuidance('smith-security')
  assert.match(g, /never|not.*value/i)
})

test('unknown role falls back to a generic guidance string', () => {
  const g = roleGuidance('smith-whatever')
  assert.ok(g.length > 0)
})
