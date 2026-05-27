const RULES = {
  manifest: [/^package\.json$/, /^composer\.json$/, /^pyproject\.toml$/, /^go\.mod$/, /^Gemfile$/, /^Cargo\.toml$/],
  infra: [/^Dockerfile$/i, /docker-compose.*\.ya?ml$/, /\.k8s\.ya?ml$/, /k8s\//, /deployment\.ya?ml$/],
  iac: [/\.tf$/, /\.bicep$/, /cloudformation.*\.(ya?ml|json)$/i],
  ci: [/^\.github\/workflows\/.*\.ya?ml$/, /^bitbucket-pipelines\.yml$/, /^\.gitlab-ci\.yml$/, /^Jenkinsfile$/],
  jobs: [/crontab/i, /(^|\/)cron/i, /supervisor.*\.conf$/, /queue.*\.(ya?ml|xml|json)$/],
  commands: [/^Makefile$/i, /^package\.json$/, /^composer\.json$/, /^bin\//],
  secrets: [/^\.env($|\.)/, /secrets?\.(ya?ml|json|env)$/]
}

export function collectSignals(files) {
  const signals = []
  for (const [kind, patterns] of Object.entries(RULES)) {
    const evidence = files.filter(f => patterns.some(re => re.test(f)))
    if (evidence.length) signals.push({ kind, evidence })
  }
  return signals
}
