import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { slugifyPath, findSessions, distillSession } from '../lib/sessions.mjs'

test('slugifyPath matches Claude Code project dir naming', () => {
  assert.equal(slugifyPath('/private/var/www/sonto-news'), '-private-var-www-sonto-news')
})

test('findSessions returns jsonl files in the slug dir', () => {
  const proj = mkdtempSync(join(tmpdir(), 'proj-'))
  const slug = slugifyPath('/repo/x')
  mkdirSync(join(proj, slug), { recursive: true })
  writeFileSync(join(proj, slug, 'a.jsonl'), '')
  writeFileSync(join(proj, slug, 'note.txt'), '')
  try {
    const s = findSessions('/repo/x', proj)
    assert.equal(s.length, 1)
    assert.match(s[0], /a\.jsonl$/)
  } finally { rmSync(proj, { recursive: true, force: true }) }
})

test('distillSession extracts prompts, bash commands, and errors with timestamps', () => {
  const lines = [
    JSON.stringify({ type: 'user', timestamp: 't1', message: { role: 'user', content: 'use pnpm not npm here' } }),
    JSON.stringify({ type: 'assistant', timestamp: 't2', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'make deploy' } }] } }),
    JSON.stringify({ type: 'user', timestamp: 't3', message: { content: [{ type: 'tool_result', is_error: true, content: 'rollback failed: media not restored' }] } }),
    JSON.stringify({ type: 'user', timestamp: 't4', message: { content: '<command-stdout>noise</command-stdout>' } })
  ].join('\n')
  const m = distillSession(lines)
  assert.ok(m.find(x => x.kind === 'prompt' && /pnpm not npm/.test(x.text)))
  assert.ok(m.find(x => x.kind === 'cmd' && x.text === 'make deploy'))
  assert.ok(m.find(x => x.kind === 'error' && /rollback failed/.test(x.text) && x.ts === 't3'))
  assert.ok(!m.find(x => /command-stdout/.test(x.text)))   // noise dropped
})

test('distillSession scrubs secrets from moments', () => {
  const line = JSON.stringify({ type: 'user', timestamp: 't', message: { role: 'user', content: 'key is ghp_' + 'a'.repeat(36) } })
  const m = distillSession(line)
  assert.doesNotMatch(JSON.stringify(m), /ghp_aaaa/)
})
