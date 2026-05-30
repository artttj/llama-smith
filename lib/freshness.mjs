// Skill Health Badge — a freshness check over a forged skill. A scan rots
// silently: the architecture map drifts as the repo moves on. Compare the scan
// timestamp (and the files it cited) against the repo's current state to grade
// the skill fresh / aging / stale, and render a shields.io badge for the README.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { git } from './git.mjs'

export const FRESH_DAYS = 7
export const STALE_DAYS = 14
const MS_PER_DAY = 86400000

const COLOR = { fresh: '3ddc84', aging: 'e0b341', stale: 'e0563f', unknown: '8a8f87' }

export function computeFreshness({ scannedAt, sha, citedFiles = [] }, { now, changedFiles = [] }) {
  const scanned = scannedAt ? new Date(scannedAt) : null
  if (!scanned || Number.isNaN(scanned.getTime())) {
    return { status: 'unknown', daysSince: null, changedCited: 0, scannedAt: scannedAt ?? null }
  }
  const daysSince = Math.floor((now.getTime() - scanned.getTime()) / MS_PER_DAY)
  const changed = new Set(changedFiles)
  const changedCited = citedFiles.filter(f => changed.has(f)).length
  const status = daysSince <= FRESH_DAYS && changedCited === 0
    ? 'fresh'
    : daysSince > STALE_DAYS || changedCited > 0
      ? 'stale'
      : 'aging'
  return { status, daysSince, changedCited, scannedAt }
}

export function repoFreshness(root, { now = new Date() } = {}) {
  const p = join(root, '.smith', 'findings.json')
  if (!existsSync(p)) return null
  const findings = JSON.parse(readFileSync(p, 'utf8'))
  const { scannedAt, sha } = findings
  const cited = [...(findings.opsFindings || []), ...(findings.architecture || [])]
    .map(x => x.file)
    .filter(Boolean)
  const citedFiles = [...new Set(cited)]
  const changedFiles = [...new Set([
    ...(sha ? git(['diff', '--name-only', sha, 'HEAD'], root).split('\n') : []),
    ...git(['diff', '--name-only'], root).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard'], root).split('\n'),
  ].map(s => s.trim()).filter(Boolean))]
  return computeFreshness({ scannedAt, sha, citedFiles }, { now, changedFiles })
}

export function freshnessBadge(freshness) {
  const { status, daysSince, changedCited } = freshness
  const parts = [status]
  if (daysSince != null) parts.push(`${daysSince}d`)
  if (changedCited > 0) parts.push(`${changedCited} claims`)
  const message = parts.join(' · ')
  return `![skill health](https://img.shields.io/badge/skill-${encodeURIComponent(message)}-${COLOR[status]}?style=flat-square)`
}
