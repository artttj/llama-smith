export function buildDraftPrompt(entry, grounding, guidance, lessons = []) {
  const blocks = grounding.files.map(f => `### ${f.path}\n${f.content}`).join('\n\n')
  const cmds = Object.keys(grounding.commands).length
    ? `\n\n--- PARSED COMMANDS (real — cite these) ---\n${JSON.stringify(grounding.commands)}`
    : ''
  const lessonBlock = lessons.length
    ? `\n\n--- BATTLE-TESTED LESSONS (mined from past sessions — real scar tissue) ---\n${lessons.map(l => `- ${l.text}${l.learned ? ` (learned ${l.learned.slice(0, 10)})` : ''}`).join('\n')}`
    : ''
  const lessonRule = lessons.length
    ? '\n- Include the BATTLE-TESTED LESSONS below as a "## Battle-tested lessons" section near the end, each with its learned date. These are real and already verified — keep them.'
    : ''
  return `You are the Operator, forging a Claude Code skill named "${entry.skill}" for this repo.

${guidance}

Rules:
- Ground every command and path in the EVIDENCE below; cite the source file inline like (← path/to/file).
- If a fact is not in the evidence, write "unknown". Never invent commands or secret values.
- Output a COMPLETE SKILL.md: YAML frontmatter (name: ${entry.skill}, plus a pushy one-line description of what it covers and when to load it), then a concise markdown body. Output ONLY the file content, no commentary.${lessonRule}

--- EVIDENCE ---
${blocks}${cmds}${lessonBlock}`
}

export function parseDraft(output) {
  if (!output) return null
  let t = output.trim()
  t = t.replace(/^```(?:markdown|md|yaml)?\s*\n/, '').replace(/\n```\s*$/, '').trim()
  if (!/name:\s*smith-/.test(t)) return null
  const fm = t.indexOf('---')
  return fm === -1 ? t : t.slice(fm)
}
