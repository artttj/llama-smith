// Re-forge every repo's skill with the comprehensive renderer, in place.
// Usage: node scripts/apply-forge.mjs [results.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { buildSkill } from './forge-skill.mjs'

const src = process.argv[2] || '/tmp/ls-results.json'
const FULL = {
  laravel: 'laravel/framework', nextjs: 'vercel/next.js', astro: 'withastro/astro',
  drizzle: 'drizzle-team/drizzle-orm', hono: 'honojs/hono',
  proxycollect: 'cook369/proxy-collect', yesmem: 'carsteneu/yesmem', kerosene: 'nilesjarvis/kerosene',
  silkennet: 'Alexey-Lukin/silken_net', jitsiscanner: 'denpiligrim/jitsi-scanner',
}
const STACK = {
  laravel: 'PHP', nextjs: 'JavaScript', astro: 'TypeScript', drizzle: 'TypeScript', hono: 'TypeScript',
  proxycollect: 'Python', yesmem: 'Go', kerosene: 'Rust', silkennet: 'Ruby', jitsiscanner: 'Go',
}

const data = JSON.parse(readFileSync(src, 'utf8'))
for (const r of data) {
  r.fullName = FULL[r.repo] || r.repo
  const hasEvidence = (r.opsFindings || []).length || (r.newCodeHotspots || []).length
  if (!hasEvidence) { r.skills = []; r.skillForged = false; continue }  // skip, don't stub
  const name = `${r.repo}-smith`
  const body = buildSkill(r, { name, stack: STACK[r.repo] || '', scannedAt: '2026-05-29' })
  r.skills = [{ name, body }]
  r.skillForged = true
}
writeFileSync(src, JSON.stringify(data))
console.log('forged:', data.map(r => `${r.repo}=${(r.skills[0]?.body || '').split('\n').length}L`).join('  '))
