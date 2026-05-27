import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeSkill } from '../lib/skillwriter.mjs'

test('writeSkill writes SKILL.md under .claude/skills/<name>/', () => {
  const d = mkdtempSync(join(tmpdir(), 'lsw-'))
  try {
    const p = writeSkill(d, 'smith-commands', '---\nname: smith-commands\n---\n# body')
    assert.ok(existsSync(p))
    assert.match(p, /\.claude\/skills\/smith-commands\/SKILL\.md$/)
    assert.match(readFileSync(p, 'utf8'), /name: smith-commands/)
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('writeSkill writes references when provided', () => {
  const d = mkdtempSync(join(tmpdir(), 'lsw-'))
  try {
    writeSkill(d, 'smith-deploy', '---\nname: smith-deploy\n---\n# body', { 'rollback.md': '# rollback\n' })
    assert.ok(existsSync(join(d, '.claude/skills/smith-deploy/references/rollback.md')))
  } finally { rmSync(d, { recursive: true, force: true }) }
})
