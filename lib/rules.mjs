// signal kind → { skill, purpose }
const MAP = {
  commands: { skill: 'smith-commands', purpose: 'real run/build/test commands' },
  infra:    { skill: 'smith-deploy',   purpose: 'release + rollback, ops' },
  iac:      { skill: 'smith-iac',      purpose: 'infrastructure-as-code patterns' },
  ci:       { skill: 'smith-cicd',     purpose: 'CI/CD pipeline knowledge' },
  jobs:     { skill: 'smith-jobs',     purpose: 'cron, queues, background jobs' },
  secrets:  { skill: 'smith-security', purpose: 'your own exposure / blast radius' }
}

export function decide(signals, flavor = null) {
  const entries = [{
    skill: 'smith-overview', purpose: 'what it is, architecture, where things live',
    trigger: 'always', evidence: [], confidence: 'high'
  }]
  for (const sig of signals) {
    const m = MAP[sig.kind]
    if (!m) continue
    entries.push({
      skill: m.skill, purpose: m.purpose, trigger: sig.kind,
      evidence: sig.evidence,
      confidence: sig.evidence.length >= 2 ? 'high' : 'medium'
    })
  }
  if (flavor && flavor.framework) {
    entries.push({
      skill: 'smith-conventions',
      purpose: `add code the ${flavor.framework} way`,
      trigger: 'framework', evidence: flavor.evidence || [], confidence: flavor.confidence || 'medium'
    })
  }
  return entries
}
