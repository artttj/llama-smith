// Comprehensive, self-learning skill forge — deterministic rendering of cited
// findings into a multi-file Anthropic skill-creator folder:
//   <repo>-smith/SKILL.md + references/*.md (per-Smith) + lessons.md (separate)
// No LLM here (the model produced the findings); nothing is hallucinated at forge time.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { num } from './lessons-store.mjs'

const sevTag = s => ({ high: '🔴 HIGH', medium: '🟠 MED', low: '🟢 LOW' }[s] || s)
const renderFindings = list => list.map(f => `- **${sevTag(f.severity)}** — ${f.text}${f.file ? `  _(← \`${f.file}\`)_` : ''}`).join('\n')

const SMITHS = [
  { kind: 'deploy', file: 'deploy.md', title: 'Deploy & rollback', lead: 'How this repo ships. Read before touching any release or deploy workflow.' },
  { kind: 'ci', file: 'ci.md', title: 'CI trust', lead: 'Gates that look like gates but do not gate.' },
  { kind: 'cron', file: 'jobs.md', title: 'Jobs & cron', lead: 'Scheduled work that can fail silently.' },
  { kind: 'secret', file: 'secrets.md', title: 'Secrets & exposure', lead: 'Referenced by name only — never by value.' },
]

// Map the .smith/lessons.json store shape -> the renderer's lesson shape.
export function adaptLessons(raw = []) {
  return raw.map(l => ({
    pattern: l.pattern || l.text || '',
    confidence: num(l.confidence),
    learnedAt: l.learnedAt || l.learned || null,
  })).filter(l => l.pattern)
}

function memoryFile(full, lessons) {
  const l = [`# Memory — ${full}`, '', '_Kept by the **Self-Improvement Oracle**._', '']
  l.push('The skill\'s long-term memory. It uses an append-only journal that graduates into confidence-ranked instincts — the memory-block pattern behind MemGPT / Letta and the claude-mem continuous-learning loop, scoped to one repo:', '')
  l.push('- Every correction and mined session observation is appended to the journal at `.smith/lessons.json`.')
  l.push('- A **correction** enters at HIGH confidence and applies from the next session ("correct once, never again").')
  l.push('- A mined **observation** enters LOW and graduates into this file only once it recurs (confidence > 0.7).')
  l.push('- Memory is **project-scoped** — this repo\'s memory never leaks into another\'s.')
  l.push('- A contradicted entry loses confidence and drops out, so memory cannot rot.', '')
  const graduated = lessons.filter(x => x.confidence >= 0.7)
  if (graduated.length) {
    l.push('## Active memory', '')
    l.push(graduated.map(x => `- **${x.confidence >= 0.9 ? 'HIGH' : 'MED'}** — ${x.pattern}${x.learnedAt ? ` _(learned ${x.learnedAt})_` : ''}`).join('\n'), '')
  } else {
    l.push(`_No graduated memory yet for ${full}. The Self-Improvement Oracle fills this as you work and correct the agent._`, '')
  }
  l.push('<!-- llama-smith:memory-anchor — new memory is merged above this line -->', '')
  return l.join('\n')
}

function skillMain(skill, full, stack, scannedAt, ops, hot, refs) {
  const high = ops.filter(f => f.severity === 'high')
  const m = ['---', `name: ${skill}`,
    `description: Operational co-pilot for ${full}. Use BEFORE editing CI/CD or deploy/release workflows, adding or changing a scheduled job or cron, wiring secrets or environment, or working in this repo's most-changed files. Knows how this project ships, where its pipeline lies, and which files bite. Forged by llama-smith from a swarm scan; every claim cites a file. Detailed reads live in references/; long-term memory in memory.md.`,
    '---', '', `# ${full} — operational co-pilot`, '',
    `Forged by **llama-smith** (${scannedAt}). ${stack ? `Stack: ${stack}. ` : ''}Every claim points at a real file; if the file no longer matches, the claim is stale — re-scan.`, '',
    '## When to use this skill', '']
  const t = []
  if (ops.some(f => f.smith === 'deploy')) t.push('- Before changing `.github/workflows`, deploy scripts, or release config')
  if (ops.some(f => f.smith === 'cron')) t.push('- When adding or editing a scheduled job / cron')
  if (ops.some(f => f.smith === 'secret')) t.push('- When wiring secrets, tokens, or environment')
  if (hot.length) t.push('- When editing the high-churn files in `references/fragility.md`')
  t.push('- When a fresh agent needs to act like it has operated this repo for a year')
  m.push(t.join('\n'), '', '## What you most need to know', '')
  if (high.length) {
    m.push(`**${high.length} critical operational risk${high.length > 1 ? 's' : ''}.** Top of the list:`)
    m.push(high.slice(0, 3).map(f => `- ${f.text}${f.file ? ` _(\`${f.file}\`)_` : ''}`).join('\n'), '')
  } else if (ops.length) {
    m.push(`No critical risks; ${ops.length} operational note${ops.length > 1 ? 's' : ''} in the reference files below.`, '')
  } else {
    m.push('The swarm found no operational risks in CI, deploy, cron, or secrets. Nothing was invented. Treat the pipeline as clean until proven otherwise.', '')
  }
  m.push('## Reference files', '', 'Read on demand — each is grounded in cited files:', '')
  m.push(refs.map(r => `- [\`${r.file}\`](${r.file}) — ${r.title}`).join('\n'), '')
  m.push('', '## Operating rules (non-negotiable)', '', [
    '- Co-pilot mode: confirm with the operator before acting on the system.',
    '- Never act on production on your own. Production steps need explicit approval.',
    '- Reference secrets by name, never by value.',
    '- A claim is only as fresh as its cited file. If they disagree, the file wins — flag it and re-scan.',
  ].join('\n'), '', '## Memory', '',
    'This skill learns. The **Self-Improvement Oracle** keeps long-term memory in [`memory.md`](memory.md) — corrections and recurring session lessons, applied automatically on the next run.', '')
  return m.join('\n')
}

// Returns { name, files: [{ path, body }] } — a multi-file skill folder.
export function buildSkillFiles(r, { name, lessons = [], scannedAt = 'this run', stack = '' } = {}) {
  const full = r.fullName || r.repo
  const skill = name || `${r.repo}-smith`
  const ops = r.opsFindings || []
  const hot = r.newCodeHotspots || []
  const by = k => ops.filter(f => f.smith === k || f.kind === k)
  const files = [], refs = []
  for (const s of SMITHS) {
    const list = by(s.kind)
    if (!list.length) continue
    refs.push({ file: `references/${s.file}`, title: s.title })
    files.push({ path: `references/${s.file}`, body: `# ${s.title} — ${full}\n\n${s.lead}\n\n${renderFindings(list)}\n` })
  }
  if (hot.length) {
    refs.push({ file: 'references/fragility.md', title: 'Fragility map — where bugs live' })
    files.push({ path: 'references/fragility.md', body: `# Fragility map — ${full}\n\nMost-changed **code** files over the last year (docs, lockfiles, generated files excluded). Touch with extra care and tests:\n\n${hot.map(h => `- \`${h.file}\` — ${h.edits} edits`).join('\n')}\n` })
  }
  refs.push({ file: 'references/commands.md', title: 'Real commands' })
  files.push({ path: 'references/commands.md', body: `# Commands — ${full}\n\nBuild / test / deploy commands were not extracted in this run — **unknown**. Read \`package.json\` / \`Makefile\` / \`composer.json\` directly. Never invent a command.\n` })
  files.push({ path: 'memory.md', body: memoryFile(full, lessons) })
  files.unshift({ path: 'SKILL.md', body: skillMain(skill, full, stack, scannedAt, ops, hot, refs) })
  return { name: skill, files }
}

export function buildSkill(r, opts = {}) {
  return buildSkillFiles(r, opts).files.find(f => f.path === 'SKILL.md').body
}

// Write the skill folder to <root>/.claude/skills/<name>/...
export function writeSkillFolder(root, built) {
  const base = join(root, '.claude', 'skills', built.name)
  for (const f of built.files) {
    const p = join(base, f.path)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, f.body)
  }
  return base
}
