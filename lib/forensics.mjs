import { isCodeFile } from './churn.mjs'

export const SINGLE_OWNER_THRESHOLD = 0.8

export function parseCommits(log) {
  const commits = []
  let cur = null
  for (const line of log.split('\n')) {
    if (line.startsWith('@@@')) { cur = { author: line.slice(3).trim(), files: [] }; commits.push(cur); continue }
    const f = line.trim()
    if (f && cur) cur.files.push(f)
  }
  return commits
}

export function parseAuthorChurn(log) {
  const fileAuthors = {}
  for (const c of parseCommits(log)) for (const f of c.files) (fileAuthors[f] ||= []).push(c.author)
  return fileAuthors
}

function ownership(fileAuthors) {
  const rows = []
  for (const [file, authors] of Object.entries(fileAuthors)) {
    if (!isCodeFile(file)) continue
    const counts = new Map()
    for (const a of authors) counts.set(a, (counts.get(a) || 0) + 1)
    let owner = '', top = 0
    for (const [n, c] of counts) if (c > top) { top = c; owner = n }
    rows.push({ file, owner, share: authors.length ? top / authors.length : 0, contributors: counts.size, commits: authors.length })
  }
  return rows
}

// Architecture mirrors the team that wrote it — a single-author module is a
// knowledge silo at module scale.
function moduleOwnership(fileAuthors, { limit = 8 } = {}) {
  const mods = new Map()
  for (const [file, authors] of Object.entries(fileAuthors)) {
    if (!isCodeFile(file)) continue
    const seg = file.includes('/') ? file.split('/')[0] : '(root)'
    if (!mods.has(seg)) mods.set(seg, { module: seg, counts: new Map(), commits: 0 })
    const m = mods.get(seg)
    for (const a of authors) { m.counts.set(a, (m.counts.get(a) || 0) + 1); m.commits++ }
  }
  return [...mods.values()].map(m => {
    let owner = '', top = 0
    for (const [n, c] of m.counts) if (c > top) { top = c; owner = n }
    return { module: m.module, owner, share: m.commits ? top / m.commits : 0, contributors: m.counts.size, commits: m.commits }
  }).sort((a, b) => b.commits - a.commits).slice(0, limit)
}

// Files that keep changing in the same commit are coupled even when no import
// links them. Giant commits (merges, reformats) would manufacture coupling, so
// they are skipped.
function changeCoupling(commits, { limit = 8, min = 3, maxFilesPerCommit = 30 } = {}) {
  const pairs = new Map()
  const bump = (a, b) => {
    if (!pairs.has(a)) pairs.set(a, new Map())
    const m = pairs.get(a)
    m.set(b, (m.get(b) || 0) + 1)
  }
  for (const c of commits) {
    const files = [...new Set(c.files.filter(isCodeFile))].sort()
    if (files.length < 2 || files.length > maxFilesPerCommit) continue
    for (let i = 0; i < files.length; i++)
      for (let j = i + 1; j < files.length; j++) bump(files[i], files[j])
  }
  const out = []
  for (const [a, m] of pairs) for (const [b, count] of m) if (count >= min) out.push({ a, b, count })
  return out.sort((x, y) => y.count - x.count).slice(0, limit)
}

function contributorCounts(commits) {
  const counts = new Map()
  for (const c of commits) if (c.author) counts.set(c.author, (counts.get(c.author) || 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, commits]) => ({ name, commits }))
  return { total: counts.size, top }
}

// Bus factor: how many primary owners (>50% of a file) it takes to cover 80% of
// the primary-owned files. Few people covering most files is fragile.
function busFactorOf(rows) {
  const primary = new Map()
  for (const r of rows) if (r.share > 0.5) primary.set(r.owner, (primary.get(r.owner) || 0) + 1)
  const ranked = [...primary.entries()].sort((a, b) => b[1] - a[1])
  const total = [...primary.values()].reduce((a, b) => a + b, 0) || 1
  let covered = 0, busFactor = 0
  const keyPeople = []
  for (const [name, files] of ranked) {
    covered += files; busFactor++; keyPeople.push({ name, files })
    if (covered / total > 0.8) break
  }
  return { busFactor, keyPeople: keyPeople.slice(0, 5) }
}

export function computeForensics(log, { limit = 12 } = {}) {
  const commits = parseCommits(log)
  const fileAuthors = parseAuthorChurn(log)
  const rows = ownership(fileAuthors)
  const singleOwner = rows
    .filter(r => r.share >= SINGLE_OWNER_THRESHOLD)
    .sort((a, b) => b.commits - a.commits || b.share - a.share)
    .slice(0, limit)
  const { busFactor, keyPeople } = busFactorOf(rows)
  const contributors = contributorCounts(commits)
  return {
    busFactor: rows.length ? busFactor : 0,
    risk: busFactor <= 1 ? 'CRITICAL' : busFactor === 2 ? 'HIGH' : busFactor <= 4 ? 'MODERATE' : 'GOOD',
    keyPeople,
    singleOwner,
    singleOwnerRatio: rows.length ? singleOwner.length / rows.length : 0,
    modules: moduleOwnership(fileAuthors),
    coupling: changeCoupling(commits),
    contributors: contributors.total,
    topContributors: contributors.top,
    codeFiles: rows.length,
  }
}
