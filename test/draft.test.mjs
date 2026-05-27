import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDraftPrompt, parseDraft } from '../lib/draft.mjs'

const entry = { skill: 'smith-commands', evidence: ['Makefile'] }
const grounding = { skill: 'smith-commands', evidence: ['Makefile'],
  files: [{ path: 'Makefile', content: 'build:\n\tnpm run build\n' }],
  commands: { Makefile: ['build'] } }

test('buildDraftPrompt embeds evidence, parsed commands, skill name, and grounding rule', () => {
  const p = buildDraftPrompt(entry, grounding, 'List the REAL commands. Cite or write unknown.')
  assert.match(p, /smith-commands/)
  assert.match(p, /Makefile/)
  assert.match(p, /npm run build/)
  assert.match(p, /unknown/i)
  assert.match(p, /← /)
})

test('parseDraft strips code fences and returns the SKILL.md when it has a smith name', () => {
  const out = '```markdown\n---\nname: smith-commands\ndescription: x\n---\n# body\n```'
  const md = parseDraft(out)
  assert.match(md, /^---\nname: smith-commands/)
  assert.doesNotMatch(md, /```/)
})

test('parseDraft returns null on non-skill output', () => {
  assert.equal(parseDraft('the model rambled with no frontmatter'), null)
})
