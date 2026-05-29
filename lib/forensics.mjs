// Git-deterministic forensics: bus factor and single-owner files from one
// `git log --name-only` pass. No LLM. Research framing: single-owner files
// carry 3-5x higher defect risk (Microsoft Research), and a low bus factor is
// organizational risk — the people whose departure would strand the code.
import { isCodeFile } from './churn.mjs'

export const SINGLE_OWNER_THRESHOLD = 0.8  // one author wrote >=80% of a file's commits

// Parse `git log --name-only --pretty=format:@@@%an` into { file: [authors...] },
// counting one authorship per commit that touched the file.
export function parseAuthorChurn(log) {
  const fileAuthors = {}
  let author = null
  for (const line of log.split('\n')) {
    if (line.startsWith('@@@')) { author = line.slice(3).trim(); continue }
    const f = line.trim()
    if (!f || !author) continue
    ;(fileAuthors[f] ||= []).push(author)
  }
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

// Conway-lite: who dominates each top-level area. Architecture mirrors the team
// that wrote it — a single-author module is a knowledge silo at module scale.
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

export function computeForensics(log, { limit = 12 } = {}) {
  const fileAuthors = parseAuthorChurn(log)
  const rows = ownership(fileAuthors)
  const singleOwner = rows
    .filter(r => r.share >= SINGLE_OWNER_THRESHOLD)
    .sort((a, b) => b.commits - a.commits || b.share - a.share)
    .slice(0, limit)
  // Bus factor: how many primary owners (>50% of a file) it takes to cover 80%
  // of the primary-owned files. Few people covering most files = fragile.
  const primary = new Map()
  for (const r of rows) if (r.share > 0.5) primary.set(r.owner, (primary.get(r.owner) || 0) + 1)
  const ranked = [...primary.entries()].sort((a, b) => b[1] - a[1])
  const totalPrimary = [...primary.values()].reduce((a, b) => a + b, 0) || 1
  let covered = 0, busFactor = 0
  const keyPeople = []
  for (const [name, files] of ranked) {
    covered += files; busFactor++; keyPeople.push({ name, files })
    if (covered / totalPrimary > 0.8) break
  }
  const risk = busFactor <= 1 ? 'CRITICAL' : busFactor === 2 ? 'HIGH' : busFactor <= 4 ? 'MODERATE' : 'GOOD'
  return { busFactor: rows.length ? busFactor : 0, risk, keyPeople: keyPeople.slice(0, 5), singleOwner, modules: moduleOwnership(fileAuthors), codeFiles: rows.length }
}
