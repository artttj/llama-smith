const CODE_EXT = new Set([
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'rb', 'php', 'go', 'rs', 'java', 'kt', 'kts',
  'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'swift', 'scala', 'clj', 'ex', 'exs', 'erl', 'mm',
  'sh', 'bash', 'pl', 'lua', 'dart', 'vue', 'svelte', 'sql'
])

const NOISE = [
  /\.(md|rst|txt|adoc)$/i,
  /(?:^|\/)(?:[^/]+-lock\.[^/]+|[^/]+\.lock)$/i,
  /\.(toml|ini|cfg)$/i,
  /\.d\.ts$/i,
  /(^|\/)version\.[a-z]+$/i,
  /(^|\/)(package|composer)\.json$/i
]

export function isCodeFile(path) {
  if (NOISE.some(re => re.test(path))) return false
  const ext = (path.split('.').pop() || '').toLowerCase()
  return CODE_EXT.has(ext)
}

export function collectChurn(nameOnlyLog) {
  const counts = new Map()
  for (const line of nameOnlyLog.split('\n')) {
    const f = line.trim()
    if (f) counts.set(f, (counts.get(f) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([file, edits]) => ({ file, edits }))
    .sort((a, b) => b.edits - a.edits)
}

export function topHotspots(churn, { limit = 8 } = {}) {
  return churn.filter(c => isCodeFile(c.file)).slice(0, limit)
}

export function collectOwnership(perFileAuthors) {
  const out = []
  for (const [file, blob] of Object.entries(perFileAuthors)) {
    const names = blob.split('\n').map(s => s.trim()).filter(Boolean)
    const counts = new Map()
    for (const n of names) counts.set(n, (counts.get(n) || 0) + 1)
    const top = [...counts.values()].reduce((a, b) => b > a ? b : a, 0)
    out.push({ file, authors: counts.size, topShare: names.length ? top / names.length : 0 })
  }
  return out
}
