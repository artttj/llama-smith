import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { num } from './lessons-store.mjs'
import { classifyCommand } from './commands.mjs'

const SMITHS = [
  { kind: 'deploy', file: 'deploy.md', title: 'Deploy & rollback', lead: 'How this repo ships. Read before touching any release or deploy workflow.' },
  { kind: 'ci', file: 'ci.md', title: 'CI trust', lead: 'Gates that look like gates but do not gate.' },
  { kind: 'cron', file: 'jobs.md', title: 'Jobs & cron', lead: 'Scheduled work that can fail silently.' },
  { kind: 'secret', file: 'secrets.md', title: 'Secrets & exposure', lead: 'Referenced by name only — never by value.' },
]
const ARCH_TITLES = [['overview', 'What it is'], ['modules', 'Modules & responsibilities'], ['dataflow', 'How data flows'], ['datamodel', 'Data model'], ['entrypoints', 'Entrypoints'], ['abstractions', 'Core concepts']]
const CMD_GROUPS = [['build', 'Build'], ['test', 'Test'], ['lint', 'Lint & format'], ['deploy', 'Deploy & release'], ['other', 'Other']]

const pct = x => Math.round(x * 100)
const cite = file => (file ? `  _(← \`${file}\`)_` : '')
const sevTag = s => ({ high: '🔴 HIGH', medium: '🟠 MED', low: '🟢 LOW' }[s] || s)
const heading = (level, title) => `${'#'.repeat(level)} ${title}`
const block = (level, title, body) => (body ? `${heading(level, title)}\n\n${body}` : '')
const doc = (...parts) => parts.filter(Boolean).join('\n\n') + '\n'

const findingLines = list => list.map(f => `- **${sevTag(f.severity)}** — ${f.text}${cite(f.file)}`).join('\n')
const ownerLines = rows => rows.map(o => `- \`${o.file}\` — ${o.owner} (${pct(o.share)}%, ${o.contributors} contributor${o.contributors > 1 ? 's' : ''})`).join('\n')
const moduleLines = mods => mods.map(m => `- \`${m.module}/\` — ${m.owner} (${pct(m.share)}%, ${m.contributors} contributor${m.contributors > 1 ? 's' : ''})`).join('\n')
const hotspotLines = (hot, soSet) => hot.map(h => `- \`${h.file}\` — ${h.edits} edits${soSet.has(h.file) ? ' · **single-owner — highest risk**' : ''}`).join('\n')
const peopleLine = people => people.map(p => `${p.name} (${p.files} files)`).join(', ')
const couplingLines = pairs => pairs.map(c => `- \`${c.a}\` ↔ \`${c.b}\` — changed together ${c.count}×`).join('\n')
const contributorLine = fr => `${fr.contributors} contributors over the last year.${fr.topContributors?.length ? ' Most active: ' + fr.topContributors.map(t => `${t.name} (${t.commits})`).join(', ') + '.' : ''}`

const dedupeCmds = list => { const seen = new Set(); return list.filter(c => { const k = (c.cmd || '').trim(); return seen.has(k) ? false : seen.add(k) }) }
const commandKind = c => c.kind || classifyCommand(`${c.cmd} ${c.raw || ''}`)
const commandLines = cmds => cmds.map(c => `- \`${c.cmd}\`${c.raw ? `  — ${c.raw}` : ''}${cite(c.file)}`).join('\n')

const groupBy = (items, groups, keyOf) => groups
  .map(([key, title]) => ({ title, items: items.filter(i => keyOf(i) === key) }))
  .filter(g => g.items.length)

const archGroups = arch => ARCH_TITLES.map(([area, title]) => ({ title, items: arch.filter(a => a.area === area) })).filter(g => g.items.length)
const archSections = (arch, level) => archGroups(arch).map(g => block(level, g.title, g.items.map(a => `- ${a.claim}${cite(a.file)}`).join('\n'))).join('\n\n')
const commandSections = (cmds, level) => groupBy(cmds, CMD_GROUPS, commandKind).map(g => block(level, g.title, commandLines(g.items))).join('\n\n')

export function adaptLessons(raw = []) {
  return raw.map(l => ({
    pattern: l.pattern || l.text || '',
    confidence: num(l.confidence),
    learnedAt: l.learnedAt || l.learned || null,
  })).filter(l => l.pattern)
}

function memoryFile(full, lessons) {
  const graduated = lessons.filter(x => x.confidence >= 0.7)
  const active = graduated.length
    ? block(2, 'Active memory', graduated.map(x => `- **${x.confidence >= 0.9 ? 'HIGH' : 'MED'}** — ${x.pattern}${x.learnedAt ? ` _(learned ${x.learnedAt})_` : ''}`).join('\n'))
    : `_No graduated memory yet for ${full}. The Self-Improvement Oracle fills this as you work and correct the agent._`
  return doc(
    `# Memory — ${full}`,
    '_Kept by the **Self-Improvement Oracle**._',
    "The skill's long-term memory: an append-only journal that graduates into confidence-ranked instincts (the memory-block pattern behind MemGPT / Letta and claude-mem), scoped to one repo.",
    [
      '- Every correction and mined observation is appended to `.smith/lessons.json`.',
      '- A **correction** enters at HIGH confidence and applies from the next session.',
      '- A mined **observation** enters LOW and graduates here only once it recurs (confidence > 0.7).',
      '- Memory is **project-scoped** and a contradicted entry loses confidence and drops out, so it cannot rot.',
    ].join('\n'),
    active,
    '<!-- llama-smith:memory-anchor — new memory is merged above this line -->',
  )
}

function whenToUse(ops, hot, hasArch) {
  const lines = []
  if (hasArch) lines.push('- To understand what this project is and how it is structured — **start here**')
  lines.push('- Before editing an unfamiliar module, to learn what it is responsible for')
  if (ops.some(f => f.smith === 'deploy')) lines.push('- Before changing `.github/workflows`, deploy scripts, or release config')
  if (ops.some(f => f.smith === 'cron')) lines.push('- When adding or editing a scheduled job / cron')
  if (ops.some(f => f.smith === 'secret')) lines.push('- When wiring secrets, tokens, or environment')
  if (hot.length) lines.push('- When editing the high-churn files in `references/fragility.md`')
  lines.push('- When a fresh agent needs to act like it has worked this repo for a year')
  return lines.join('\n')
}

function mostNeeded(ops, hasArch, archCount) {
  const parts = []
  const high = ops.filter(f => f.severity === 'high')
  if (hasArch) parts.push(`**Read [\`references/architecture.md\`](references/architecture.md) first** — ${archCount} cited facts about what this app is, its modules, data flow, and entrypoints. That map is the point of this skill.`)
  if (high.length) {
    parts.push(`Then mind **${high.length} operational risk${high.length > 1 ? 's' : ''}** the scan flagged:`)
    parts.push(high.slice(0, 3).map(f => `- ${f.text}${f.file ? ` _(\`${f.file}\`)_` : ''}`).join('\n'))
  } else if (ops.length) {
    parts.push(`${ops.length} operational note${ops.length > 1 ? 's' : ''} sit in the reference files below; none critical.`)
  } else if (!hasArch) {
    parts.push('The swarm found no operational risks in CI, deploy, cron, or secrets. Nothing was invented. Treat the pipeline as clean until proven otherwise.')
  }
  return parts.join('\n\n')
}

const OPERATING_RULES = [
  '- Co-pilot mode: confirm with the operator before acting on the system.',
  '- Never act on production on your own. Production steps need explicit approval.',
  '- Reference secrets by name, never by value.',
  '- A claim is only as fresh as its cited file. If they disagree, the file wins — flag it and re-scan.',
].join('\n')

const DESCRIPTION = full => `Architecture co-pilot for ${full}. Knows how this project is built — what it is, its modules and data flow, its entrypoints and core concepts — and where it deploys, leaks, and breaks. Use it to understand the codebase before changing it, to orient in unfamiliar parts of the repo, and before editing CI/CD, deploy, cron, or secrets. Forged by llama-smith from a swarm scan validated by the Oracle; every claim cites a file. The architecture map and detailed reads live in references/; long-term memory in memory.md.`

function skillMain(skill, full, stack, scannedAt, ops, hot, refs, entrypoints, arch) {
  const intro = `Forged by **llama-smith** (${scannedAt}). ${stack ? `Stack: ${stack}. ` : ''}This is the project's map — how it's built and how it runs. Every claim points at a real file; if the file no longer matches, the claim is stale — re-scan.`
  const entry = entrypoints.length ? '**Entrypoints:** ' + entrypoints.map(e => `${e.what} → \`${e.value}\``).join(' · ') : ''
  return doc(
    `---\nname: ${skill}\ndescription: ${DESCRIPTION(full)}\n---`,
    `# ${full} — architecture & operations co-pilot`,
    intro,
    entry,
    block(2, 'When to use this skill', whenToUse(ops, hot, arch.length > 0)),
    block(2, 'What you most need to know', mostNeeded(ops, arch.length > 0, arch.length)),
    block(2, 'Reference files', 'Read on demand — each is grounded in cited files:\n\n' + refs.map(r => `- [\`${r.file}\`](${r.file}) — ${r.title}`).join('\n')),
    block(2, 'Operating rules (non-negotiable)', OPERATING_RULES),
    block(2, 'Memory', 'This skill learns. The **Self-Improvement Oracle** keeps long-term memory in [`memory.md`](memory.md) — corrections and recurring session lessons, applied automatically on the next run.'),
  )
}

function architectureFile(full, arch) {
  return doc(`# Architecture — ${full}`, 'What this application is and how it is built — the orientation a newcomer needs. Each claim cites a file; if the file no longer matches, the claim is stale.', archSections(arch, 2))
}

function commandsFile(full, cmds) {
  if (!cmds.length) return doc(`# Commands — ${full}`, 'No build/test/deploy scripts found in package.json / Makefile / composer.json / CI workflows — **unknown**. Read the repo directly; never invent a command.')
  return doc(`# Commands — ${full}`, "Real commands parsed from the repo's manifests and CI workflows. Run them as written; never invent a command.", commandSections(cmds, 2))
}

function boundariesFile(full, boundaries) {
  return doc(`# Boundaries — ${full}`, "Files and directories an agent must not hand-edit. The path looks editable; the rule is that it isn't.", boundaries.map(b => `- \`${b.path}\` — ${b.rule}`).join('\n'))
}

function fragilityFile(full, hot, soSet) {
  return doc(`# Fragility map — ${full}`, 'Most-changed **code** files over the last year (docs, lockfiles, generated files excluded). High churn correlates with defects (Microsoft Research); a hotspot that is also single-owner is the top priority. Touch with extra care and tests:', hotspotLines(hot, soSet))
}

function forensicsFile(full, fr) {
  const busLine = `The number of people whose departure would strand most of the code.${fr.keyPeople?.length ? ' Key people: ' + peopleLine(fr.keyPeople) + '.' : ''}`
  return doc(
    `# Code forensics — ${full}`,
    'Knowledge risk read from git authorship over the last year. Single-owner files carry 3-5x higher defect risk (Microsoft Research); a low bus factor is organizational risk. These are facts from history, not estimates.',
    block(2, `Bus factor: ${fr.busFactor} (${fr.risk})`, busLine),
    fr.singleOwner?.length ? block(2, 'Single-owner files', 'One author wrote ≥80% of these. Document or pair before they leave:\n\n' + ownerLines(fr.singleOwner)) : '',
    fr.modules?.length ? block(2, 'Module ownership', 'Who dominates each top-level area (Conway: architecture mirrors the team that wrote it):\n\n' + moduleLines(fr.modules)) : '',
    fr.coupling?.length ? block(2, 'Change coupling', 'Files that keep changing together — coupled even when nothing imports the other:\n\n' + couplingLines(fr.coupling)) : '',
    fr.contributors ? block(2, 'Contributors', contributorLine(fr)) : '',
  )
}

function opsSections(ops, level) {
  return SMITHS
    .map(s => ({ title: s.title, items: ops.filter(f => f.smith === s.kind || f.kind === s.kind) }))
    .filter(g => g.items.length)
    .map(g => block(level, g.title, findingLines(g.items)))
    .join('\n\n')
}

function agentsFile(full, { stack, scannedAt, eps, arch, ops, hot, cmds, bounds, fr, soSet }) {
  const intro = `> Forged by llama-smith (${scannedAt}). ${stack ? `Stack: ${stack}. ` : ''}A detailed, file-cited map of how this project is built and how it runs. Every claim points at a real file; if the file no longer matches, the claim is stale. Mirrors the Claude Code skill in \`.claude/skills/\`.`
  const entry = eps.length ? '**Entrypoints:** ' + eps.map(e => `${e.what} → \`${e.value}\``).join(' · ') : ''
  const opsBody = ops.length ? opsSections(ops, 3) : 'The swarm found no operational risks in CI, deploy, cron, or secrets. Nothing was invented.'
  const cmdBody = cmds.length ? commandSections(cmds, 3) : 'No build/test/deploy commands found — unknown. Read the repo directly; never invent a command.'
  const knowledge = fr?.busFactor
    ? [
      `Bus factor: ${fr.busFactor} (${fr.risk}).${fr.keyPeople?.length ? ' Key people: ' + peopleLine(fr.keyPeople) + '.' : ''} Single-owner files carry 3-5x higher defect risk (Microsoft Research).`,
      fr.singleOwner?.length ? ownerLines(fr.singleOwner.slice(0, 8)) : '',
      fr.coupling?.length ? 'Files that change together:\n' + couplingLines(fr.coupling) : '',
      fr.contributors ? contributorLine(fr) : '',
    ].filter(Boolean).join('\n\n')
    : ''
  return doc(
    `# ${full} — agent guide`,
    intro,
    entry,
    arch.length ? block(2, 'Architecture', archSections(arch, 3)) : '',
    block(2, 'Commands', cmdBody),
    bounds.length ? block(2, 'Do-not-touch', bounds.map(b => `- \`${b.path}\` — ${b.rule}`).join('\n')) : '',
    block(2, 'Operational risks', opsBody),
    hot.length ? block(2, 'Fragile hotspots', 'Most-changed code over the last year — touch with extra care and tests:\n\n' + hotspotLines(hot, soSet)) : '',
    block(2, 'Knowledge risk', knowledge),
    block(2, 'Operating rules', OPERATING_RULES),
  )
}

export function buildSkillFiles(r, { name, lessons = [], scannedAt = 'this run', stack = '', commands = [], entrypoints = [], boundaries = [], architecture = [], forensics = null } = {}) {
  const full = r.fullName || r.repo
  const skill = name || `${r.repo}-smith`
  const ops = r.opsFindings || []
  const hot = r.newCodeHotspots || []
  const cmds = dedupeCmds(commands.length ? commands : (r.commands || []))
  const bounds = boundaries.length ? boundaries : (r.boundaries || [])
  const eps = entrypoints.length ? entrypoints : (r.entrypoints || [])
  const arch = architecture.length ? architecture : (r.architecture || [])
  const fr = forensics || r.forensics || null
  const soSet = new Set((fr?.singleOwner || []).map(s => s.file))

  const files = [], refs = []
  const addRef = (file, title, body) => { refs.push({ file, title }); files.push({ path: file, body }) }

  if (arch.length) addRef('references/architecture.md', 'Architecture & application map', architectureFile(full, arch))
  for (const s of SMITHS) {
    const list = ops.filter(f => f.smith === s.kind || f.kind === s.kind)
    if (list.length) addRef(`references/${s.file}`, s.title, doc(`# ${s.title} — ${full}`, s.lead, findingLines(list)))
  }
  if (hot.length) addRef('references/fragility.md', 'Fragility map — where bugs live', fragilityFile(full, hot, soSet))
  if (fr?.busFactor) addRef('references/forensics.md', 'Knowledge risk — bus factor & owners', forensicsFile(full, fr))
  addRef('references/commands.md', 'Real commands', commandsFile(full, cmds))
  if (bounds.length) addRef('references/boundaries.md', 'Do-not-touch boundaries', boundariesFile(full, bounds))

  files.push({ path: 'memory.md', body: memoryFile(full, lessons) })
  files.unshift({ path: 'SKILL.md', body: skillMain(skill, full, stack, scannedAt, ops, hot, refs, eps, arch) })
  files.push({ path: 'AGENTS.md', body: agentsFile(full, { stack, scannedAt, eps, arch, ops, hot, cmds, bounds, fr, soSet }) })
  return { name: skill, files }
}

export function buildSkill(r, opts = {}) {
  return buildSkillFiles(r, opts).files.find(f => f.path === 'SKILL.md').body
}

export function writeSkillFolder(root, built) {
  const base = join(root, '.claude', 'skills', built.name)
  for (const f of built.files) {
    const p = join(base, f.path)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, f.body)
  }
  return base
}
