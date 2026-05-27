import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderManifest } from '../lib/render.mjs'

const manifest = {
  project: 'myapp', skills: [
    { skill: 'smith-overview', purpose: 'architecture', trigger: 'always', evidence: [], confidence: 'high' },
    { skill: 'smith-deploy', purpose: 'release + rollback', trigger: 'infra', evidence: ['Dockerfile'], confidence: 'high' }
  ],
  exposure: { text: 'a GitHub token appears in .env', file: '.env', confidence: 'high' }
}

test('plain render lists skills and the one-more-thing line, no ANSI', () => {
  const out = renderManifest(manifest, { color: false })
  assert.match(out, /smith-overview/)
  assert.match(out, /smith-deploy/)
  assert.match(out, /one more thing/i)
  assert.match(out, /GitHub token/)
  assert.doesNotMatch(out, /\x1b\[/) // no ANSI escapes
})

test('omits the one-more-thing line when there is no exposure', () => {
  const out = renderManifest({ ...manifest, exposure: null }, { color: false })
  assert.doesNotMatch(out, /one more thing/i)
})

test('color render contains ANSI escapes', () => {
  const out = renderManifest(manifest, { color: true })
  assert.match(out, /\x1b\[/)
})
