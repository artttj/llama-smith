// Incremental scanning: hash every file, cache the result, and on the next run
// skip the swarm + Oracle when nothing scan-relevant changed. Conservative by
// design — relevance is a coarse pattern match, so ANY relevant change forces a
// full scan, and findings with a null file are always re-derived (we can't prove
// they still hold). Transitive effects (a shared config that breaks an unrelated
// file) are NOT caught; that is the honest limit of pattern-scoped relevance.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

// Above this size we hash size:mtimeMs instead of the full bytes — large vendored
// blobs are rarely scan targets and reading them every run is wasteful.
const HASH_MAX_BYTES = 256 * 1024
const cacheFile = root => join(root, '.smith', 'scan-cache.json')

export function fileHashes(root, files) {
  const out = {}
  for (const f of files) {
    const p = join(root, f)
    try {
      const st = statSync(p)
      out[f] = st.size > HASH_MAX_BYTES
        ? createHash('sha1').update(`${st.size}:${st.mtimeMs}`).digest('hex')
        : createHash('sha1').update(readFileSync(p)).digest('hex')
    } catch { /* unreadable — skip */ }
  }
  return out
}

export function diffHashes(prev = {}, cur = {}) {
  const changed = [], added = [], removed = [], unchanged = []
  for (const f of Object.keys(cur)) {
    if (!(f in prev)) added.push(f)
    else if (prev[f] !== cur[f]) changed.push(f)
    else unchanged.push(f)
  }
  for (const f of Object.keys(prev)) if (!(f in cur)) removed.push(f)
  return { changed, added, removed, unchanged }
}

export function relevantChanged(changedFiles, patternArrays) {
  const all = patternArrays.flat()
  return changedFiles.some(f => all.some(re => re.test(f)))
}

export function partitionFindings(prevFindings = [], changedSet) {
  const preserved = [], invalidated = []
  for (const f of prevFindings) {
    if (f.file && !changedSet.has(f.file)) preserved.push(f)
    else invalidated.push(f)
  }
  return { preserved, invalidated }
}

export function readCache(root) {
  const p = cacheFile(root)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) }
  catch { return null }
}

export function writeCache(root, cache) {
  mkdirSync(join(root, '.smith'), { recursive: true })
  writeFileSync(cacheFile(root), JSON.stringify(cache, null, 2))
}
