const G = '\x1b[32m', DIM = '\x1b[2m', R = '\x1b[31m', A = '\x1b[33m', X = '\x1b[0m'

export function shouldColor() {
  return process.stdout.isTTY === true && !process.env.NO_COLOR
}

export function renderManifest(manifest, { color = false, mascot = '' } = {}) {
  const g = (s) => color ? G + s + X : s
  const dim = (s) => color ? DIM + s + X : s
  const red = (s) => color ? R + s + X : s
  const lines = []
  if (mascot) lines.push(mascot, '')
  lines.push(g(`llama-smith · ${manifest.project}`))
  lines.push(g('─'.repeat(60)))
  lines.push(`this repo needs ${manifest.skills.length} skills:`, '')
  for (const s of manifest.skills) {
    const ev = s.evidence.length ? dim(`  (← ${s.evidence.slice(0, 2).join(', ')})`) : ''
    lines.push(`  ${g('▸')} ${s.skill.padEnd(18)} ${s.purpose}${ev}`)
  }
  if (manifest.anomalies && manifest.anomalies.length) {
    const amber = (s) => color ? A + s + X : s
    lines.push('', g('─'.repeat(60)))
    lines.push(amber(`⚡ ${manifest.anomalies.length} things worth knowing`), '')
    manifest.anomalies.forEach((a, i) => {
      lines.push(`  ${g('[' + (i + 1) + ']')} ${a.emoji}  ${amber(a.domain)}`)
      lines.push(`      ${a.text}`, '')
    })
  }
  if (manifest.exposure) {
    lines.push(g('─'.repeat(60)))
    lines.push('and one more thing — here\'s what I\'d know about you in 60 seconds:')
    lines.push('  ' + red('» ' + manifest.exposure.text))
  }
  return lines.join('\n')
}
