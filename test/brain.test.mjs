import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runBrain } from '../lib/brain.mjs'

function makeRepo() {
  const d = mkdtempSync(join(tmpdir(), 'lsb-'))
  execSync('git init -q', { cwd: d })
  execSync('git config user.email a@b.c && git config user.name A', { cwd: d })
  writeFileSync(join(d, 'Dockerfile'), 'FROM node:20\n')
  writeFileSync(join(d, 'Makefile'), 'build:\n\tnpm run build\n')
  writeFileSync(join(d, '.env'), 'GITHUB_TOKEN=ghp_' + 'a'.repeat(36) + '\n')
  execSync('git add -A && git commit -q -m init', { cwd: d })
  return d
}

// injected dispatch: framework null, exposure confirmed
const fakeDispatch = async (model, prompt) =>
  /Architect/.test(prompt) ? { success: true, content: '{"framework":null,"confidence":"low"}' }
                           : { success: true, content: '{"confirmed":true}' }

test('runBrain produces a manifest with deploy, commands, security and an exposure', async () => {
  const d = makeRepo()
  try {
    const m = await runBrain(d, { dispatchFn: fakeDispatch })
    const names = m.skills.map(s => s.skill)
    assert.ok(names.includes('smith-overview'))
    assert.ok(names.includes('smith-deploy'))
    assert.ok(names.includes('smith-commands'))
    assert.ok(names.includes('smith-security'))
    assert.ok(m.exposure && /token/i.test(m.exposure.text))
    assert.doesNotMatch(JSON.stringify(m), /ghp_aaaa/) // value never stored
  } finally { rmSync(d, { recursive: true, force: true }) }
})
