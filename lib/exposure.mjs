const PATTERNS = [
  { re: /AKIA[0-9A-Z]{16}/, label: 'AWS access key', conf: 'high' },
  { re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: 'private key', conf: 'high' },
  { re: /gh[pousr]_[A-Za-z0-9]{36,}/, label: 'GitHub token', conf: 'high' },
  { re: /sk_live_[A-Za-z0-9]{16,}/, label: 'Stripe live key', conf: 'high' },
  { re: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\n]{12,}['"]/i, label: 'hardcoded secret', conf: 'medium' }
]
const RANK = { high: 0, medium: 1, low: 2 }

export function findExposures(files) {
  const out = []
  for (const { file, content } of files) {
    for (const p of PATTERNS) {
      if (p.re.test(content)) {
        out.push({ text: `a ${p.label} appears in ${file}`, file, confidence: p.conf })
        break // one finding per file is enough for the headline
      }
    }
  }
  return out.sort((a, b) => RANK[a.confidence] - RANK[b.confidence])
}

export function topExposure(exposures) {
  if (!exposures.length) return null
  return [...exposures].sort((a, b) => RANK[a.confidence] - RANK[b.confidence])[0]
}
