import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gatherGrounding } from '../lib/grounding.mjs'

function makeRepo() {
  const d = mkdtempSync(join(tmpdir(), 'lsf-'))
  execSync('git init -q', { cwd: d })
  writeFileSync(join(d, 'Makefile'), 'build:\n\tnpm run build\ntest:\n\tnpm test\n')
  return d
}

test('gatherGrounding reads evidence files and parses Makefile targets', () => {
  const d = makeRepo()
  try {
    const g = gatherGrounding(d, { skill: 'smith-commands', evidence: ['Makefile'] })
    assert.equal(g.skill, 'smith-commands')
    assert.equal(g.files[0].path, 'Makefile')
    assert.match(g.files[0].content, /npm run build/)
    assert.ok(g.commands['Makefile'].includes('build'))
    assert.ok(g.commands['Makefile'].includes('test'))
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('gatherGrounding tolerates missing evidence file', () => {
  const d = makeRepo()
  try {
    const g = gatherGrounding(d, { skill: 'smith-overview', evidence: ['nope.txt'] })
    assert.equal(g.files[0].content, '')
  } finally { rmSync(d, { recursive: true, force: true }) }
})
