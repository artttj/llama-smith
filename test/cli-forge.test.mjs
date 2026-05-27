import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runForgeCli } from '../cli-forge.mjs'

function makeRepo() {
  const d = mkdtempSync(join(tmpdir(), 'lscf-'))
  execSync('git init -q', { cwd: d })
  writeFileSync(join(d, 'Makefile'), 'build:\n\tnpm run build\n')
  mkdirSync(join(d, '.smith'), { recursive: true })
  writeFileSync(join(d, '.smith/manifest.json'), JSON.stringify({
    version: 1, project: 'demo', scanned_sha: 's',
    skills: [{ skill: 'smith-commands', purpose: 'c', trigger: 'commands', evidence: ['Makefile'], confidence: 'high' }],
    exposure: { text: 'a GitHub token appears in .env', file: '.env', confidence: 'high' }
  }))
  return d
}
const fakeDispatch = async (m, p) => {
  const name = p.match(/named "(smith-[a-z]+)"/)[1]
  return { success: true, content: `---\nname: ${name}\ndescription: forged.\n---\n# ${name}\n(← Makefile)\n` }
}

test('runForgeCli forges skills, returns summary text including the exposure line', async () => {
  const d = makeRepo()
  try {
    const { text, results } = await runForgeCli(d, { dispatchFn: fakeDispatch, color: false })
    assert.equal(results.length, 1)
    assert.match(text, /forged 1/i)
    assert.match(text, /one more thing/i)
    assert.match(text, /GitHub token/)
    assert.ok(existsSync(join(d, '.claude/skills/smith-commands/SKILL.md')))
  } finally { rmSync(d, { recursive: true, force: true }) }
})
