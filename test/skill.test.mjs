import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSkillFiles, adaptLessons } from '../lib/skill.mjs'

const repo = {
  repo: 'demo', fullName: 'acme/demo',
  opsFindings: [
    { smith: 'deploy', severity: 'high', text: 'hardcoded IP in release', file: '.github/workflows/release.yml' },
    { smith: 'cron', severity: 'low', text: 'no alerting', file: '.github/workflows/nightly.yml' },
  ],
  newCodeHotspots: [{ file: 'src/core.ts', edits: 42 }],
}

test('buildSkillFiles produces a multi-file folder with SKILL.md, references, and memory.md', () => {
  const { name, files } = buildSkillFiles(repo, { name: 'demo-smith', stack: 'TS' })
  assert.equal(name, 'demo-smith')
  const paths = files.map(f => f.path)
  assert.ok(paths.includes('SKILL.md'))
  assert.ok(paths.includes('memory.md'), 'memory is a separate file')
  assert.ok(paths.includes('references/deploy.md'))
  assert.ok(paths.includes('references/jobs.md'))
  assert.ok(paths.includes('references/fragility.md'))
  assert.ok(!paths.includes('references/secrets.md'), 'no secrets file when no secret findings')
})

test('SKILL.md frontmatter has name + trigger-rich description and links to references', () => {
  const skill = buildSkillFiles(repo, { name: 'demo-smith' }).files.find(f => f.path === 'SKILL.md').body
  assert.match(skill, /^---\nname: demo-smith\ndescription: .+/)
  assert.match(skill, /references\/deploy\.md/)
  assert.match(skill, /memory\.md/)
})

test('deploy reference cites the real file', () => {
  const dep = buildSkillFiles(repo, {}).files.find(f => f.path === 'references/deploy.md').body
  assert.match(dep, /hardcoded IP in release/)
  assert.match(dep, /\.github\/workflows\/release\.yml/)
})

test('empty repo forges no findings sections but still skips gracefully', () => {
  const { files } = buildSkillFiles({ repo: 'x', opsFindings: [], newCodeHotspots: [] }, {})
  const skill = files.find(f => f.path === 'SKILL.md').body
  assert.match(skill, /no operational risks/i)
})

test('adaptLessons maps store shape and grades confidence', () => {
  const out = adaptLessons([{ text: 'deploy from production', confidence: 'high', learned: '2026-05-01' }])
  assert.equal(out[0].pattern, 'deploy from production')
  assert.equal(out[0].confidence, 0.9)
  assert.equal(out[0].learnedAt, '2026-05-01')
})

test('only graduated (>=0.7) memory renders in memory.md', () => {
  const lessons = [{ pattern: 'use pnpm', confidence: 0.9 }, { pattern: 'maybe flaky', confidence: 0.4 }]
  const body = buildSkillFiles(repo, { lessons }).files.find(f => f.path === 'memory.md').body
  assert.match(body, /use pnpm/)
  assert.ok(!body.includes('maybe flaky'), 'low-confidence memory stays out of the skill')
})
