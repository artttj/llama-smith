// Comprehensive, self-learning skill forge — deterministic rendering of cited
// findings into a multi-file Anthropic skill-creator folder:
//   <repo>-smith/SKILL.md + references/*.md (per-Smith) + lessons.md (separate)
// No LLM here (the model produced the findings); nothing is hallucinated at forge time.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { num } from './lessons-store.mjs'
import { classifyCommand } from './commands.mjs'

const CMD_GROUPS = [['build', 'Build'], ['test', 'Test'], ['lint', 'Lint & format'], ['deploy', 'Deploy & release'], ['other', 'Other']]

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

function skillMain(skill, full, stack, scannedAt, ops, hot, refs, entrypoints, arch = []) {
  const high = ops.filter(f => f.severity === 'high')
  const hasArch = arch.length > 0
  const m = ['---', `name: ${skill}`,
    `description: Architecture co-pilot for ${full}. Knows how this project is built — what it is, its modules and data flow, its entrypoints and core concepts — and where it deploys, leaks, and breaks. Use it to understand the codebase before changing it, to orient in unfamiliar parts of the repo, and before editing CI/CD, deploy, cron, or secrets. Forged by llama-smith from a swarm scan validated by the Oracle; every claim cites a file. The architecture map and detailed reads live in references/; long-term memory in memory.md.`,
    '---', '', `# ${full} — architecture & operations co-pilot`, '',
    `Forged by **llama-smith** (${scannedAt}). ${stack ? `Stack: ${stack}. ` : ''}This is the project's map — how it's built and how it runs. Every claim points at a real file; if the file no longer matches, the claim is stale — re-scan.`, '']
  if (entrypoints?.length) {
    m.push('**Entrypoints:** ' + entrypoints.map(e => `${e.what} → \`${e.value}\``).join(' · '), '')
  }
  m.push('## When to use this skill', '')
  const t = []
  if (hasArch) t.push('- To understand what this project is and how it is structured — **start here**')
  t.push('- Before editing an unfamiliar module, to learn what it is responsible for')
  if (ops.some(f => f.smith === 'deploy')) t.push('- Before changing `.github/workflows`, deploy scripts, or release config')
  if (ops.some(f => f.smith === 'cron')) t.push('- When adding or editing a scheduled job / cron')
  if (ops.some(f => f.smith === 'secret')) t.push('- When wiring secrets, tokens, or environment')
  if (hot.length) t.push('- When editing the high-churn files in `references/fragility.md`')
  t.push('- When a fresh agent needs to act like it has worked this repo for a year')
  m.push(t.join('\n'), '', '## What you most need to know', '')
  if (hasArch) {
    m.push(`**Read [\`references/architecture.md\`](references/architecture.md) first** — ${arch.length} cited facts about what this app is, its modules, data flow, and entrypoints. That map is the point of this skill.`, '')
  }
  if (high.length) {
    m.push(`Then mind **${high.length} operational risk${high.length > 1 ? 's' : ''}** the scan flagged:`)
    m.push(high.slice(0, 3).map(f => `- ${f.text}${f.file ? ` _(\`${f.file}\`)_` : ''}`).join('\n'), '')
  } else if (ops.length) {
    m.push(`${ops.length} operational note${ops.length > 1 ? 's' : ''} sit in the reference files below; none critical.`, '')
  } else if (!hasArch) {
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

const ARCH_TITLES = [['overview', 'What it is'], ['modules', 'Modules & responsibilities'], ['dataflow', 'How data flows'], ['datamodel', 'Data model'], ['entrypoints', 'Entrypoints'], ['abstractions', 'Core concepts']]
function architectureFile(full, arch) {
  const body = [`# Architecture — ${full}`, '', 'What this application is and how it is built — the orientation a newcomer needs. Each claim cites a file; if the file no longer matches, the claim is stale.', '']
  for (const [area, title] of ARCH_TITLES) {
    const items = arch.filter(a => a.area === area)
    if (items.length) body.push(`## ${title}`, '', items.map(a => `- ${a.claim}${a.file ? `  _(← \`${a.file}\`)_` : ''}`).join('\n'), '')
  }
  return body.join('\n')
}

function commandsFile(full, cmds) {
  if (!cmds.length) return `# Commands — ${full}\n\nNo build/test/deploy scripts found in package.json / Makefile / composer.json / CI workflows — **unknown**. Read the repo directly; never invent a command.\n`
  const kindOf = c => c.kind || classifyCommand(`${c.cmd} ${c.raw || ''}`)
  const line = c => `- \`${c.cmd}\`${c.raw ? `  — ${c.raw}` : ''}  _(← \`${c.file}\`)_`
  const body = [`# Commands — ${full}`, '', "Real commands parsed from the repo's manifests and CI workflows. Run them as written; never invent a command.", '']
  for (const [kind, title] of CMD_GROUPS) {
    const group = cmds.filter(c => kindOf(c) === kind)
    if (group.length) body.push(`## ${title}`, '', group.map(line).join('\n'), '')
  }
  return body.join('\n')
}

function boundariesFile(full, boundaries) {
  return `# Boundaries — ${full}\n\nFiles and directories an agent must not hand-edit. The path looks editable; the rule is that it isn't.\n\n${boundaries.map(b => `- \`${b.path}\` — ${b.rule}`).join('\n')}\n`
}

// Returns { name, files: [{ path, body }] } — a multi-file skill folder.
export function buildSkillFiles(r, { name, lessons = [], scannedAt = 'this run', stack = '', commands = [], entrypoints = [], boundaries = [], architecture = [] } = {}) {
  const full = r.fullName || r.repo
  const skill = name || `${r.repo}-smith`
  const ops = r.opsFindings || []
  const hot = r.newCodeHotspots || []
  const cmds = commands.length ? commands : (r.commands || [])
  const bounds = boundaries.length ? boundaries : (r.boundaries || [])
  const eps = entrypoints.length ? entrypoints : (r.entrypoints || [])
  const arch = architecture.length ? architecture : (r.architecture || [])
  const by = k => ops.filter(f => f.smith === k || f.kind === k)
  const files = [], refs = []
  if (arch.length) {
    refs.push({ file: 'references/architecture.md', title: 'Architecture & application map' })
    files.push({ path: 'references/architecture.md', body: architectureFile(full, arch) })
  }
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
  files.push({ path: 'references/commands.md', body: commandsFile(full, cmds) })
  if (bounds.length) {
    refs.push({ file: 'references/boundaries.md', title: 'Do-not-touch boundaries' })
    files.push({ path: 'references/boundaries.md', body: boundariesFile(full, bounds) })
  }
  files.push({ path: 'memory.md', body: memoryFile(full, lessons) })
  files.unshift({ path: 'SKILL.md', body: skillMain(skill, full, stack, scannedAt, ops, hot, refs, eps, arch) })
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
