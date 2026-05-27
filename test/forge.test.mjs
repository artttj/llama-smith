import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runForge, modelFor } from '../lib/forge.mjs'

test('modelFor routes security to kimi, deploy to glm, default to qwen; --local strips :cloud', () => {
  assert.equal(modelFor('smith-security', false), 'kimi-k2.6:cloud')
  assert.equal(modelFor('smith-deploy', false), 'glm-5.1:cloud')
  assert.equal(modelFor('smith-commands', false), 'qwen3.5:cloud')
  assert.equal(modelFor('smith-security', true), 'kimi-k2.6')
})

function makeRepo() {
  const d = mkdtempSync(join(tmpdir(), 'lsfo-'))
  execSync('git init -q', { cwd: d })
  writeFileSync(join(d, 'Makefile'), 'build:\n\tnpm run build\n')
  mkdirSync(join(d, '.smith'), { recursive: true })
  writeFileSync(join(d, '.smith/manifest.json'), JSON.stringify({
    version: 1, project: 'demo', scanned_sha: 's',
    skills: [
      { skill: 'smith-overview', purpose: 'p', trigger: 'always', evidence: [], confidence: 'high' },
      { skill: 'smith-commands', purpose: 'c', trigger: 'commands', evidence: ['Makefile'], confidence: 'high' }
    ],
    exposure: null
  }))
  return d
}

const fakeDispatch = async (model, prompt) => {
  const name = prompt.match(/named "(smith-[a-z]+)"/)[1]
  return { success: true, content: `---\nname: ${name}\ndescription: forged ${name}, use for ${name}.\n---\n# ${name}\nRun build (← Makefile).\n` }
}

test('runForge writes every manifest skill, grounded, with citation check', async () => {
  const d = makeRepo()
  try {
    const { results } = await runForge(d, { dispatchFn: fakeDispatch })
    assert.equal(results.length, 2)
    assert.ok(results.every(r => r.status === 'written'))
    assert.ok(existsSync(join(d, '.claude/skills/smith-overview/SKILL.md')))
    assert.ok(existsSync(join(d, '.claude/skills/smith-commands/SKILL.md')))
    const cmd = results.find(r => r.skill === 'smith-commands')
    assert.equal(cmd.citations.ok, true)
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('runForge --only forges a single skill', async () => {
  const d = makeRepo()
  try {
    const { results } = await runForge(d, { dispatchFn: fakeDispatch, only: 'smith-commands' })
    assert.equal(results.length, 1)
    assert.equal(results[0].skill, 'smith-commands')
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('runForge throws when no manifest exists', async () => {
  const d = mkdtempSync(join(tmpdir(), 'lsfo-'))
  try { await assert.rejects(runForge(d, { dispatchFn: fakeDispatch }), /manifest/) }
  finally { rmSync(d, { recursive: true, force: true }) }
})
