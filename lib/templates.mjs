const ROLE = {
  overview: 'Describe what the project is: its stack, architecture, and where key things live. Use the evidence and top-level files.',
  commands: 'List the REAL run/build/test/deploy commands. Each command MUST cite the file it came from. If a command is not in the evidence, write "unknown" — never invent one.',
  deploy: 'Explain how the project deploys and rolls back, from the compose/CI/deploy files. Cite each step\'s source file.',
  cicd: 'Describe the CI/CD pipelines from the CI config files, citing each file.',
  jobs: 'Describe cron jobs and queues from the crontab/queue files, citing each. Note silent-failure risks (e.g. output sent to /dev/null).',
  security: 'Describe the exposure surface from env/secret files. NEVER print a secret value — name the file and the risk only.',
  iac: 'Describe the infrastructure-as-code resources from the IaC files, citing each file.',
  conventions: 'Explain how to add code the project\'s way given its framework. Cite representative files.'
}

export function roleGuidance(skill) {
  const role = skill.replace(/^smith-/, '')
  return ROLE[role] || 'Document this aspect of the project from the evidence, citing source files. If a fact is not in the evidence, write "unknown".'
}
