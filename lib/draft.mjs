export function buildDraftPrompt(entry, grounding, guidance) {
  const blocks = grounding.files.map(f => `### ${f.path}\n${f.content}`).join('\n\n')
  const cmds = Object.keys(grounding.commands).length
    ? `\n\n--- PARSED COMMANDS (real — cite these) ---\n${JSON.stringify(grounding.commands)}`
    : ''
  return `You are the Operator, forging a Claude Code skill named "${entry.skill}" for this repo.

${guidance}

Rules:
- Ground every command and path in the EVIDENCE below; cite the source file inline like (← path/to/file).
- If a fact is not in the evidence, write "unknown". Never invent commands or secret values.
- Output a COMPLETE SKILL.md: YAML frontmatter (name: ${entry.skill}, plus a pushy one-line description of what it covers and when to load it), then a concise markdown body. Output ONLY the file content, no commentary.

--- EVIDENCE ---
${blocks}${cmds}`
}

export function parseDraft(output) {
  if (!output) return null
  let t = output.trim()
  t = t.replace(/^```(?:markdown|md|yaml)?\s*\n/, '').replace(/\n```\s*$/, '').trim()
  if (!/name:\s*smith-/.test(t)) return null
  const fm = t.indexOf('---')
  return fm === -1 ? t : t.slice(fm)
}
