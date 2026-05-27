// Memory Matrix — mine distilled moments into battle-tested lessons.
// Pure prompt-build + parse; dispatch happens in the CLI.

export function buildLessonPrompt(moments, project) {
  const blocks = moments.map(m => `[${m.kind}${m.ts ? ' ' + m.ts : ''}] ${m.text}`).join('\n')
  return `You are session-smith, mining a developer's past Claude Code sessions on the repo "${project}". Below are real moments: their prompts, the commands run, and the errors hit (with timestamps).

Extract repo-specific LESSONS worth remembering — the scar tissue a teammate would kill to know:
- commands that failed and the fix
- "use X not Y" corrections the developer made
- deploy / cache / reindex / build / migration gotchas
- repeated faceplants (the same mistake more than once = high signal)

Each lesson: short and human — a HOOK then " — " then the FACT (one sentence, plain words, no filler). Tie it to the files/commands it touches, give a confidence, and carry the source timestamp it was learned from.

Return ONLY JSON, max 8, ranked by how useful it is to a new teammate:
{"lessons":[{"text":"<hook — fact>","kind":"use-x-not-y|failed-command|gotcha|faceplant|decision","paths":["..."],"confidence":"high|medium|low","learned":"<ISO timestamp from a real moment>"}]}

Ground every lesson in a real moment above. If you can't, drop it. Never invent a command or a secret value.

--- MOMENTS ---
${blocks}`
}

const KINDS = new Set(['use-x-not-y', 'failed-command', 'gotcha', 'faceplant', 'decision'])

export function parseLessons(raw) {
  if (!raw) return []
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
  if (s === -1 || e === -1) return []
  try {
    const o = JSON.parse(raw.slice(s, e + 1))
    const list = Array.isArray(o.lessons) ? o.lessons : []
    return list
      .filter(l => l && typeof l.text === 'string' && l.text.trim())
      .slice(0, 8)
      .map(l => ({
        text: l.text.trim(),
        kind: KINDS.has(l.kind) ? l.kind : 'gotcha',
        paths: Array.isArray(l.paths) ? l.paths.filter(Boolean) : [],
        confidence: ['high', 'medium', 'low'].includes(l.confidence) ? l.confidence : 'medium',
        learned: typeof l.learned === 'string' ? l.learned : null
      }))
  } catch { return [] }
}
