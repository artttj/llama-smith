// Deterministic project facts the swarm shouldn't guess at: the stack (from
// manifests + lockfiles), real entrypoints, and do-not-touch boundaries. Every
// fact cites the file it came from; nothing is inferred by an LLM here.
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Manifests are small; cap reads so a pathological multi-MB file can't spike memory.
const MAX_MANIFEST = 1024 * 1024
const readCapped = (root, f) => { try { const p = join(root, f); return statSync(p).size > MAX_MANIFEST ? '' : readFileSync(p, 'utf8') } catch { return '' } }
const readJSON = (root, f) => { try { return JSON.parse(readCapped(root, f)) } catch { return null } }
const has = (files, f) => files.includes(f)

const JS_FRAMEWORKS = {
  next: 'Next.js', react: 'React', vue: 'Vue', svelte: 'Svelte', '@angular/core': 'Angular',
  express: 'Express', fastify: 'Fastify', '@nestjs/core': 'NestJS', koa: 'Koa', astro: 'Astro',
}
const PHP_FRAMEWORKS = { 'laravel/framework': 'Laravel', 'symfony/symfony': 'Symfony', 'symfony/framework-bundle': 'Symfony' }
const PY_FRAMEWORKS = { django: 'Django', flask: 'Flask', fastapi: 'FastAPI' }

const LOCKFILES = {
  'package-lock.json': 'npm install', 'pnpm-lock.yaml': 'pnpm install', 'yarn.lock': 'yarn',
  'bun.lockb': 'bun install', 'composer.lock': 'composer install', 'poetry.lock': 'poetry lock',
  'uv.lock': 'uv lock', 'Cargo.lock': 'cargo build', 'go.sum': 'go mod tidy',
}
const GENERATED_DIRS = ['dist/', 'build/', '.next/', 'out/', 'target/', 'vendor/', 'coverage/', '__generated__/']

const frameworksFrom = (deps, map) => Object.keys(map).filter(k => deps[k]).map(k => map[k])

// One compact line — framing context, not a rediscoverable tech listing.
export function detectStack(root, files) {
  const parts = []
  const pkg = readJSON(root, 'package.json')
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    const fw = frameworksFrom(deps, JS_FRAMEWORKS)
    parts.push(`Node${fw.length ? ` (${fw.join(', ')})` : ''}`)
    const pm = pkg.packageManager ? pkg.packageManager.split('@')[0]
      : has(files, 'pnpm-lock.yaml') ? 'pnpm' : has(files, 'yarn.lock') ? 'yarn' : has(files, 'bun.lockb') ? 'bun' : 'npm'
    parts.push(pm)
    if (pkg.engines?.node) parts.push(`node ${pkg.engines.node}`)
  }
  const comp = readJSON(root, 'composer.json')
  if (comp) {
    const fw = frameworksFrom(comp.require || {}, PHP_FRAMEWORKS)
    parts.push(`PHP${fw.length ? ` (${fw.join(', ')})` : ''}`)
  }
  if (has(files, 'pyproject.toml') || has(files, 'requirements.txt') || has(files, 'setup.py')) {
    const pyReq = readCapped(root, 'pyproject.toml')
    const fw = Object.entries(PY_FRAMEWORKS).filter(([k]) => new RegExp(`\\b${k}\\b`, 'i').test(pyReq)).map(([, v]) => v)
    parts.push(`Python${fw.length ? ` (${fw.join(', ')})` : ''}`)
  }
  if (has(files, 'go.mod')) parts.push('Go')
  if (has(files, 'Cargo.toml')) parts.push('Rust')
  return parts.join(' · ')
}

export function detectEntrypoints(root, files) {
  const out = []
  const pkg = readJSON(root, 'package.json')
  if (pkg) {
    if (typeof pkg.bin === 'string') out.push({ what: 'CLI', value: pkg.bin, file: 'package.json' })
    else if (pkg.bin) for (const [k, v] of Object.entries(pkg.bin)) out.push({ what: `CLI \`${k}\``, value: v, file: 'package.json' })
    if (pkg.main) out.push({ what: 'main', value: pkg.main, file: 'package.json' })
  }
  const comp = readJSON(root, 'composer.json')
  for (const b of comp?.bin || []) out.push({ what: 'CLI', value: b, file: 'composer.json' })
  if (has(files, 'manage.py')) out.push({ what: 'Django', value: 'manage.py', file: 'manage.py' })
  if (has(files, 'artisan')) out.push({ what: 'Laravel CLI', value: 'artisan', file: 'artisan' })
  return out
}

// Files an agent must never hand-edit. Each carries the reason — the
// non-discoverable part (a lockfile looks editable; the rule is it isn't).
export function detectBoundaries(root, files) {
  const out = []
  for (const [lock, regen] of Object.entries(LOCKFILES))
    if (has(files, lock)) out.push({ path: lock, rule: `Generated lockfile — never hand-edit; regenerate with \`${regen}\`.` })
  for (const dir of GENERATED_DIRS)
    if (files.some(f => f.startsWith(dir))) out.push({ path: dir, rule: 'Build/vendored output — edit the source, not this.' })
  const env = files.find(f => f === '.env' || /(^|\/)\.env$/.test(f))
  if (env) out.push({ path: env, rule: 'Holds secrets — never commit values; reference by name only.' })
  return out
}
