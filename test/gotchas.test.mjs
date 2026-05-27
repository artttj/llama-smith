import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGotchaPrompt, parseGotchas } from '../lib/gotchas.mjs'

test('buildGotchaPrompt embeds files and asks for ranked clickbait JSON', () => {
  const p = buildGotchaPrompt([{ path: 'Makefile', content: 'deploy:\n\trsync ...\n' }])
  assert.match(p, /Makefile/)
  assert.match(p, /rsync/)
  assert.match(p, /clickbait|hook/i)
  assert.match(p, /JSON/i)
})

test('parseGotchas reads up to 3 ranked hints with domain + emoji + text', () => {
  const raw = '{"hints":[{"domain":"deploy","emoji":"💀","text":"a — b"},{"domain":"cron","emoji":"🔇","text":"c — d"},{"domain":"drift","emoji":"🎭","text":"e — f"},{"domain":"x","emoji":"x","text":"g"}]}'
  const h = parseGotchas(raw)
  assert.equal(h.length, 3)              // capped at 3
  assert.equal(h[0].domain, 'DEPLOY')    // uppercased
  assert.equal(h[0].text, 'a — b')
})

test('parseGotchas tolerates junk and missing', () => {
  assert.deepEqual(parseGotchas('the model rambled'), [])
  assert.deepEqual(parseGotchas(''), [])
})
