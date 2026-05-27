import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide } from '../lib/rules.mjs'

const skillNames = (entries) => entries.map(e => e.skill)

test('always emits smith-overview', () => {
  const entries = decide([])
  assert.ok(skillNames(entries).includes('smith-overview'))
})

test('infra signal yields smith-deploy with evidence and high confidence', () => {
  const entries = decide([{ kind: 'infra', evidence: ['Dockerfile', 'docker-compose.yml'] }])
  const deploy = entries.find(e => e.skill === 'smith-deploy')
  assert.ok(deploy)
  assert.deepEqual(deploy.evidence, ['Dockerfile', 'docker-compose.yml'])
  assert.equal(deploy.confidence, 'high')
})

test('maps all known signals to their skills', () => {
  const signals = [
    { kind: 'commands', evidence: ['Makefile'] },
    { kind: 'iac', evidence: ['main.tf'] },
    { kind: 'ci', evidence: ['.github/workflows/ci.yml'] },
    { kind: 'jobs', evidence: ['crontab.txt'] },
    { kind: 'secrets', evidence: ['.env'] }
  ]
  const names = skillNames(decide(signals))
  for (const s of ['smith-commands', 'smith-iac', 'smith-cicd', 'smith-jobs', 'smith-security'])
    assert.ok(names.includes(s), `missing ${s}`)
})
