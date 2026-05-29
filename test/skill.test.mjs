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

test('commands.md renders real parsed commands, cited, no unknown stub', () => {
  const built = buildSkillFiles(repo, { name: 'demo-smith', commands: [{ cmd: 'npm run build', raw: 'vite build', file: 'package.json' }] })
  const cmd = built.files.find(f => f.path === 'references/commands.md').body
  assert.match(cmd, /npm run build/)
  assert.match(cmd, /package\.json/)
  assert.ok(!/unknown/i.test(cmd), 'no unknown stub when commands exist')
})

test('commands.md falls back to unknown when nothing parsed', () => {
  const cmd = buildSkillFiles(repo, {}).files.find(f => f.path === 'references/commands.md').body
  assert.match(cmd, /unknown/i)
})

test('commands.md groups commands by intent (build/test/deploy)', () => {
  const built = buildSkillFiles(repo, {
    commands: [
      { cmd: 'npm run build', file: 'package.json', kind: 'build' },
      { cmd: 'npm test', file: 'package.json', kind: 'test' },
      { cmd: 'npm publish', file: '.github/workflows/release.yml', kind: 'deploy' },
    ],
  })
  const cmd = built.files.find(f => f.path === 'references/commands.md').body
  assert.match(cmd, /## Build[\s\S]*npm run build/)
  assert.match(cmd, /## Test[\s\S]*npm test/)
  assert.match(cmd, /## Deploy & release[\s\S]*npm publish/)
  assert.match(cmd, /release\.yml/, 'cites the CI workflow it came from')
})

test('SKILL.md lists entrypoints when detected', () => {
  const skill = buildSkillFiles(repo, { entrypoints: [{ what: 'CLI', value: 'cli.mjs', file: 'package.json' }] })
    .files.find(f => f.path === 'SKILL.md').body
  assert.match(skill, /Entrypoints:.*`cli\.mjs`/)
})

test('architecture.md renders the cited app map, grouped by area, linked from SKILL.md', () => {
  const arch = [
    { area: 'overview', claim: 'A real-time HTTP API for uptime checks', file: 'server/server.js' },
    { area: 'modules', claim: 'server/ holds the monitor scheduler', file: 'server/uptime-kuma-server.js' },
  ]
  const built = buildSkillFiles(repo, { name: 'demo-smith', architecture: arch })
  const a = built.files.find(f => f.path === 'references/architecture.md')
  assert.ok(a, 'architecture.md present when the map is non-empty')
  assert.match(a.body, /## What it is[\s\S]*real-time HTTP API/)
  assert.match(a.body, /## Modules & responsibilities[\s\S]*monitor scheduler/)
  assert.match(a.body, /server\/server\.js/, 'claims cite their file')
  const skill = built.files.find(f => f.path === 'SKILL.md').body
  assert.match(skill, /references\/architecture\.md/, 'SKILL.md points at the architecture map')
  assert.match(skill, /first/i, 'architecture is framed as the first read')
  assert.ok(!buildSkillFiles(repo, {}).files.some(f => f.path === 'references/architecture.md'), 'omitted when no map')
})

test('boundaries.md renders do-not-touch paths with reasons, omitted when empty', () => {
  const withB = buildSkillFiles(repo, { boundaries: [{ path: 'package-lock.json', rule: 'never hand-edit' }] })
  const b = withB.files.find(f => f.path === 'references/boundaries.md')
  assert.ok(b, 'boundaries.md present when boundaries exist')
  assert.match(b.body, /package-lock\.json.*never hand-edit/)
  assert.ok(withB.files.find(f => f.path === 'SKILL.md').body.includes('references/boundaries.md'), 'linked from SKILL.md')
  assert.ok(!buildSkillFiles(repo, {}).files.some(f => f.path === 'references/boundaries.md'), 'no boundaries file when none detected')
})

test('AGENTS.md is forged with the full map for opencode and cross-tool use', () => {
  const built = buildSkillFiles(repo, {
    name: 'demo-smith',
    architecture: [{ area: 'overview', claim: 'an HTTP API', file: 'a.js' }],
    commands: [{ cmd: 'npm test', file: 'package.json', kind: 'test' }],
    forensics: { busFactor: 2, risk: 'HIGH', keyPeople: [{ name: 'al', files: 3 }], singleOwner: [{ file: 'a.js', owner: 'al', share: 0.9, contributors: 1 }], modules: [] },
  })
  const agents = built.files.find(f => f.path === 'AGENTS.md')
  assert.ok(agents, 'AGENTS.md present')
  assert.match(agents.body, /## Architecture[\s\S]*HTTP API/)
  assert.match(agents.body, /## Operational risks/)
  assert.match(agents.body, /Bus factor: 2/)
})

test('forensics.md renders bus factor and single-owner files when present', () => {
  const built = buildSkillFiles(repo, { forensics: { busFactor: 1, risk: 'CRITICAL', keyPeople: [{ name: 'al', files: 5 }], singleOwner: [{ file: 'core.ts', owner: 'al', share: 0.95, contributors: 1 }], modules: [{ module: 'src', owner: 'al', share: 0.8, contributors: 2 }] } })
  const fr = built.files.find(f => f.path === 'references/forensics.md')
  assert.ok(fr, 'forensics.md present when bus factor known')
  assert.match(fr.body, /Bus factor: 1 \(CRITICAL\)/)
  assert.match(fr.body, /Single-owner files[\s\S]*core\.ts.*95%/)
  assert.match(fr.body, /Module ownership[\s\S]*src/)
  assert.ok(!buildSkillFiles(repo, {}).files.some(f => f.path === 'references/forensics.md'), 'omitted without forensics')
})

test('only graduated (>=0.7) memory renders in memory.md', () => {
  const lessons = [{ pattern: 'use pnpm', confidence: 0.9 }, { pattern: 'maybe flaky', confidence: 0.4 }]
  const body = buildSkillFiles(repo, { lessons }).files.find(f => f.path === 'memory.md').body
  assert.match(body, /use pnpm/)
  assert.ok(!body.includes('maybe flaky'), 'low-confidence memory stays out of the skill')
})
