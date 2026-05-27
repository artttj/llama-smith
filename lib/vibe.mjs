// Vibe check — a 0-100 health score over 4 dimensions, computed from a manifest
// (+ lessons, + optional runtime). Each dimension starts at 25; findings deduct.
// Runtime stays "unverified" (full, greyed) until Reality Check actually probes.

const DIM_OF = {
  SECRET: 'safety',
  DEPLOY: 'fragility', CI: 'fragility', DATA: 'fragility',
  CRON: 'hygiene', JOBS: 'hygiene', DRIFT: 'hygiene', NOTE: 'hygiene'
}

const TIERS = [
  [90, '😇', 'PRISTINE'],
  [70, '😎', 'SOLID'],
  [50, '😬', 'SMELLS FUNNY'],
  [30, '🚑', 'NEEDS HELP'],
  [0, '💀', 'DUMPSTER FIRE']
]

export function vibeScore(manifest, { lessons = [], runtimeVerified = false, runtimePenalty = 0 } = {}) {
  const dims = { safety: 25, runtime: 25, fragility: 25, hygiene: 25 }

  for (const a of (manifest.anomalies || [])) {
    const d = DIM_OF[String(a.domain || '').toUpperCase()] || 'hygiene'
    dims[d] = Math.max(0, dims[d] - 6)
  }
  if (manifest.exposure) {
    const c = manifest.exposure.confidence
    dims.safety = Math.max(0, dims.safety - (c === 'high' ? 15 : c === 'low' ? 5 : 10))
  }
  for (const l of lessons) {
    if (l.kind === 'faceplant') dims.fragility = Math.max(0, dims.fragility - 4)
  }
  if (runtimeVerified) dims.runtime = Math.max(0, 25 - runtimePenalty)

  const total = Math.round(dims.safety + dims.runtime + dims.fragility + dims.hygiene)
  const tier = TIERS.find(([min]) => total >= min)
  return { total, dims, emoji: tier[1], label: tier[2], runtimeVerified }
}
