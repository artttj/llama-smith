// The gotcha-smith: find the 3 most surprising-but-true operational facts,
// each a clickbait hook + the hard fact. Pure prompt-build + parse.

export function buildGotchaPrompt(files) {
  const blocks = files.map(f => `### ${f.path}\n${f.content}`).join('\n\n')
  return `You are scar-smith. From the repo files below, find the 3 MOST surprising-but-true operational gotchas — things that would make an experienced developer wince. Each MUST be a real fact grounded in these files: deploy traps, silent cron failures (output to /dev/null), version drift across files, destructive commands with no backup, missing rollback, jobs with no lock, secrets in committed files, and the like.

Write each as: a short clickbait HOOK, then " — ", then the hard FACT. Straight to facts, no fluff, no hedging. Rank by how much it would make a dev wince — worst first.

Return ONLY JSON, at most 3 items:
{"hints":[{"domain":"DEPLOY|CRON|DRIFT|SECRET|DATA|JOBS|CI","emoji":"<one emoji>","text":"<hook — fact>"}]}

--- FILES ---
${blocks}`
}

export function parseGotchas(raw) {
  if (!raw) return []
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
  if (s === -1 || e === -1) return []
  try {
    const o = JSON.parse(raw.slice(s, e + 1))
    const list = Array.isArray(o.hints) ? o.hints : []
    return list
      .filter(h => h && typeof h.text === 'string' && h.text.trim())
      .slice(0, 3)
      .map(h => ({ domain: String(h.domain || 'NOTE').toUpperCase(), emoji: h.emoji || '⚡', text: h.text.trim() }))
  } catch { return [] }
}
