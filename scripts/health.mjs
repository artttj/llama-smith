#!/usr/bin/env node
// Skill Health check — does the forged skill still match the repo? Reads the
// last scan from <repo>/.smith/findings.json, compares its timestamp and cited
// files to the repo's current state, writes <repo>/.smith/health.json, and
// prints a shields.io badge line you can paste into the skill's README.
//   node scripts/health.mjs <repo>
import { resolve, join } from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { repoFreshness, freshnessBadge } from '../lib/freshness.mjs'

function main() {
  const [, , repoArg] = process.argv
  if (!repoArg) {
    console.error('usage: node scripts/health.mjs <repo>')
    process.exit(1)
  }
  const root = resolve(repoArg)
  if (!existsSync(root)) { console.error(`no such path: ${root}`); process.exit(1) }

  const freshness = repoFreshness(root)
  if (!freshness) {
    console.error(`no scan yet — run llama-smith first (${join(root, '.smith', 'findings.json')} missing)`)
    process.exit(1)
  }

  const { status, daysSince, changedCited } = freshness
  const age = daysSince == null ? 'unknown age' : `${daysSince}d since scan`
  const drift = changedCited > 0 ? `, ${changedCited} cited file(s) changed` : ''
  console.log(`skill health: ${status} — ${age}${drift}`)

  writeFileSync(join(root, '.smith', 'health.json'), JSON.stringify(freshness, null, 2))
  console.log(freshnessBadge(freshness))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
