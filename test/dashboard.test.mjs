import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderDashboard } from '../lib/dashboard.mjs'

test('dashboard renders project, vibe score, gotcha and lesson', () => {
  const html = renderDashboard([{
    project: 'myapp',
    skills: [{ skill: 'smith-overview', evidence: [] }],
    anomalies: [{ domain: 'CRON', emoji: '🕳️', text: 'silent cron — pipes to /dev/null' }],
    exposure: null,
    _lessons: [{ kind: 'gotcha', text: 'deploy from production not main', learned: '2026-02-14T01:13:00Z' }],
    _vibe: { total: 76, dims: { safety: 25, runtime: 25, fragility: 14, hygiene: 12 }, emoji: '😎', label: 'SOLID', runtimeVerified: false }
  }])
  assert.match(html, /myapp/)
  assert.match(html, /76%/)
  assert.match(html, /SOLID/)
  assert.match(html, /battle-tested/i)
  assert.match(html, /deploy from production not main/)
  assert.match(html, /CRON/)
})
