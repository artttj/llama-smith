import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectSignals } from '../lib/signals.mjs'

const has = (signals, kind) => signals.find(s => s.kind === kind)

test('detects infra, ci, jobs, commands, manifest from file list', () => {
  const files = ['Dockerfile', 'docker-compose.yml', '.github/workflows/ci.yml',
    'Makefile', 'composer.json', 'config/crontab.txt', '.env.example', 'main.tf']
  const s = collectSignals(files)
  assert.deepEqual(has(s, 'infra').evidence.includes('Dockerfile'), true)
  assert.ok(has(s, 'ci').evidence.includes('.github/workflows/ci.yml'))
  assert.ok(has(s, 'jobs'))
  assert.ok(has(s, 'commands').evidence.includes('Makefile'))
  assert.ok(has(s, 'iac').evidence.includes('main.tf'))
  assert.ok(has(s, 'manifest').evidence.includes('composer.json'))
  assert.ok(has(s, 'secrets').evidence.includes('.env.example'))
})

test('returns no signal for a kind that has no matching files', () => {
  const s = collectSignals(['README.md', 'src/index.ts'])
  assert.equal(has(s, 'iac'), undefined)
  assert.equal(has(s, 'jobs'), undefined)
})
