export function parseMakefile(content) {
  const targets = []
  for (const line of content.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_.\-]+):(?!=)/)
    if (m && m[1] !== '.PHONY') targets.push(m[1])
  }
  return [...new Set(targets)]
}

export function parsePackageScripts(content) {
  try { return JSON.parse(content).scripts || {} } catch { return {} }
}

export function parseComposerScripts(content) {
  try {
    const scripts = JSON.parse(content).scripts || {}
    const out = {}
    for (const [k, v] of Object.entries(scripts)) out[k] = Array.isArray(v) ? v.join(' && ') : String(v)
    return out
  } catch { return {} }
}

// CI is executable truth: the commands a workflow actually runs are the real
// build/test/deploy steps. Line-based extraction of `run:` scalars and block
// scalars (run: |) — zero-dep, tolerant of arbitrary YAML indentation.
export function parseWorkflowCommands(content) {
  const lines = content.split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/)
    if (!m) continue
    const indent = m[1].length
    const inline = m[2].trim()
    if (inline && !/^[|>][+-]?$/.test(inline)) { out.push(inline); continue }
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue
      if (lines[j].match(/^(\s*)/)[1].length <= indent) break
      out.push(lines[j].trim())
    }
  }
  // Fold shell line-continuations (`\` at end of line) into a single command.
  const folded = []
  for (const c of out) {
    if (folded.length && /\\$/.test(folded[folded.length - 1])) folded[folded.length - 1] = folded[folded.length - 1].replace(/\\\s*$/, '').trim() + ' ' + c
    else folded.push(c)
  }
  return folded.filter(c => c && !c.startsWith('#'))
}

const CLASSIFY = [
  [/(^|\W)(test|spec|jest|vitest|pytest|phpunit|mocha|go test|cargo test)(\W|$)/i, 'test'],
  [/(^|\W)(lint|eslint|prettier|format|fmt|clippy|ruff|flake8|stylelint|typecheck|tsc\b)(\W|$)/i, 'lint'],
  [/(^|\W)(build|compile|bundle|webpack|vite|rollup|esbuild|cargo build)(\W|$)/i, 'build'],
  [/(^|\W)(deploy|publish|release|docker|kubectl|helm|terraform|gh release|npm publish|fly deploy|vercel)(\W|$)/i, 'deploy'],
]
export function classifyCommand(s) {
  for (const [re, kind] of CLASSIFY) if (re.test(s)) return kind
  return 'other'
}
