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
