import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runScan } from '../cli-brain.mjs'

function makeRepo() {
  const d = mkdtempSync(join(tmpdir(), 'lsc-'))
  execSync('git init -q', { cwd: d })
  execSync('git config user.email a@b.c && git config user.name A', { cwd: d })
  writeFileSync(join(d, 'Makefile'), 'test:\n\tnpm test\n')
  execSync('git add -A && git commit -q -m init', { cwd: d })
  return d
}
const fakeDispatch = async () => ({ success: true, content: '{"framework":null,"confidence":"low"}' })

test('runScan writes manifest and returns rendered text', async () => {
  const d = makeRepo()
  try {
    const { text, manifest } = await runScan(d, { dispatchFn: fakeDispatch, color: false })
    assert.match(text, /smith-overview/)
    assert.match(text, /smith-commands/)
    assert.ok(existsSync(join(d, '.smith', 'manifest.json')))
    assert.equal(manifest.version, 1)
  } finally { rmSync(d, { recursive: true, force: true }) }
})
