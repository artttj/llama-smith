// Test the swarm + Oracle end to end against real Ollama models, in parallel.
// Each repo: investigator swarm (parallel lanes via runScan) → Oracle validates
// every LLM finding against its cited file (parallel) → report before/after.
// Usage: node scripts/oracle-check.mjs
import { execFileSync } from 'node:child_process'
import { rmSync, mkdirSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanRepo } from '../lib/scan.mjs'
import { validateFindings, keepSupported } from '../lib/oracle.mjs'

const LS = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))))
const run = (c, a, o = {}) => execFileSync(c, a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...o })

async function testRepo(url, slug) {
  const D = `/tmp/lso/${slug}`
  try {
    rmSync(D, { recursive: true, force: true })
    mkdirSync(dirname(D), { recursive: true })
    run('git', ['clone', '--filter=blob:none', '--quiet', url, D])
    const t0 = Date.now()
    const { findings: ops } = await scanRepo(D)       // swarm: parallel investigator lanes (no scar)
    const swarmMs = Date.now() - t0
    const t1 = Date.now()
    const validated = await validateFindings(D, ops)  // Oracle: parallel validations
    const kept = keepSupported(validated)
    const dropped = validated.filter(f => f.oracle?.supported === false)
    return {
      slug, before: ops.length, after: kept.length, swarmMs, oracleMs: Date.now() - t1,
      dropped: dropped.map(d => ({ text: d.text.slice(0, 90), file: d.file, reason: d.oracle.reason })),
    }
  } catch (e) {
    return { slug, error: e.message }
  } finally {
    rmSync(D, { recursive: true, force: true })
  }
}

const repos = [
  ['https://github.com/honojs/hono.git', 'hono'],
  ['https://github.com/withastro/astro.git', 'astro'],
  ['https://github.com/drizzle-team/drizzle-orm.git', 'drizzle'],
]
const results = await Promise.all(repos.map(([u, s]) => testRepo(u, s)))
for (const r of results) {
  if (r.error) { console.log(`\n${r.slug}: ERROR ${r.error}`); continue }
  console.log(`\n=== ${r.slug} === swarm ${Math.round(r.swarmMs / 1000)}s · oracle ${Math.round(r.oracleMs / 1000)}s`)
  console.log(`findings: ${r.before} → ${r.after} (Oracle dropped ${r.before - r.after})`)
  for (const d of r.dropped) console.log(`  ✗ DROPPED: ${d.text}${d.file ? ` (${d.file})` : ''}\n    reason: ${d.reason}`)
}
console.log('\n' + JSON.stringify(results))
