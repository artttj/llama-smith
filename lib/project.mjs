import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { BRAND, JS_DEPS, PHP_DEPS, PY_DEPS, GO_DEPS, RUST_DEPS, RUBY_DEPS, JVM_DEPS, DOTNET_DEPS, FRAMEWORK_LABELS } from './tech.mjs'

const MAX_MANIFEST = 1024 * 1024
const readCapped = (root, f) => {
  try {
    const p = join(root, f)
    return statSync(p).size > MAX_MANIFEST ? '' : readFileSync(p, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') return ''
    throw err
  }
}
const readJSON = (root, f) => { try { return JSON.parse(readCapped(root, f)) } catch { return null } }
const has = (files, f) => files.includes(f)

const LOCKFILES = {
  'package-lock.json': 'npm install', 'pnpm-lock.yaml': 'pnpm install', 'yarn.lock': 'yarn',
  'bun.lockb': 'bun install', 'composer.lock': 'composer install', 'poetry.lock': 'poetry lock',
  'uv.lock': 'uv lock', 'Cargo.lock': 'cargo build', 'go.sum': 'go mod tidy',
}
const GENERATED_DIRS = ['dist', 'build', '.next', 'out', 'target', 'vendor', 'coverage', '__generated__']

const labelsFrom = (deps, map) => Object.entries(map).filter(([dep]) => deps[dep]).map(([, label]) => label)
const regexLabelsFrom = (text, rules) => rules.filter(([re]) => re.test(text)).map(([, label]) => label)

const workspaceManifests = files => files.filter(f => /^(apps|packages|libs|services|examples)\/[^/]+\/package\.json$/.test(f)).slice(0, 30)
const mergedJsDeps = (root, rootPkg, manifests) => {
  const deps = { ...rootPkg?.dependencies, ...rootPkg?.devDependencies }
  for (const m of manifests) { const p = readJSON(root, m); Object.assign(deps, p?.dependencies, p?.devDependencies) }
  return deps
}
const packageManager = (rootPkg, files) => rootPkg?.packageManager ? rootPkg.packageManager.split('@')[0]
  : has(files, 'pnpm-lock.yaml') ? 'pnpm' : has(files, 'yarn.lock') ? 'yarn' : has(files, 'bun.lockb') ? 'bun' : 'npm'
const hasTsconfig = files => files.some(f => /(^|\/)tsconfig.*\.json$/.test(f))
const dropImpliedReact = labels => (labels.includes('React Native') ? labels.filter(l => l !== 'React') : labels)

function detectLabels(root, files) {
  const labels = []
  const rootPkg = readJSON(root, 'package.json')
  const ws = workspaceManifests(files)
  if (rootPkg || ws.length) {
    labels.push('Node', ...dropImpliedReact(labelsFrom(mergedJsDeps(root, rootPkg, ws), JS_DEPS)))
    if (hasTsconfig(files)) labels.push('TypeScript')
    labels.push(packageManager(rootPkg, files))
  }
  const comp = readJSON(root, 'composer.json')
  if (comp) labels.push('PHP', 'Composer', ...labelsFrom({ ...comp.require, ...comp['require-dev'] }, PHP_DEPS))
  if (has(files, 'pyproject.toml') || has(files, 'requirements.txt') || has(files, 'setup.py')) {
    labels.push('Python')
    if (has(files, 'poetry.lock')) labels.push('Poetry')
    if (has(files, 'uv.lock')) labels.push('uv')
    labels.push(...regexLabelsFrom(`${readCapped(root, 'pyproject.toml')}\n${readCapped(root, 'requirements.txt')}`, PY_DEPS))
  }
  if (has(files, 'go.mod')) labels.push('Go', ...regexLabelsFrom(readCapped(root, 'go.mod'), GO_DEPS))
  if (has(files, 'Cargo.toml')) labels.push('Rust', 'Cargo', ...regexLabelsFrom(readCapped(root, 'Cargo.toml'), RUST_DEPS))
  if (has(files, 'Gemfile')) labels.push('Ruby', 'Bundler', ...regexLabelsFrom(readCapped(root, 'Gemfile'), RUBY_DEPS))
  if (has(files, 'pom.xml') || files.some(f => /(^|\/)build\.gradle(\.kts)?$/.test(f))) {
    labels.push(has(files, 'pom.xml') ? 'Maven' : 'Gradle')
    labels.push(files.some(f => /\.kts$/.test(f)) ? 'Kotlin' : 'Java')
    labels.push(...regexLabelsFrom(`${readCapped(root, 'pom.xml')}\n${readCapped(root, 'build.gradle')}\n${readCapped(root, 'build.gradle.kts')}`, JVM_DEPS))
  }
  const csproj = files.find(f => f.endsWith('.csproj'))
  if (csproj) labels.push('C#', ...regexLabelsFrom(readCapped(root, csproj), DOTNET_DEPS))
  if (has(files, 'pubspec.yaml')) labels.push('Dart', ...(/flutter/i.test(readCapped(root, 'pubspec.yaml')) ? ['Flutter'] : []))
  if (has(files, 'mix.exs')) labels.push('Elixir')
  if (files.some(f => /(^|\/)Dockerfile$|docker-compose.*\.ya?ml$|(^|\/)compose\.ya?ml$/.test(f))) labels.push('Docker')
  if (files.some(f => /\.tf$/.test(f))) labels.push('Terraform')
  if (files.some(f => /^\.github\/workflows\/.+\.ya?ml$/.test(f))) labels.push('GitHub Actions')
  return [...new Set(labels)]
}

export function detectStack(root, files) {
  const parts = []
  const rootPkg = readJSON(root, 'package.json')
  const ws = workspaceManifests(files)
  if (rootPkg || ws.length) {
    const fw = dropImpliedReact(labelsFrom(mergedJsDeps(root, rootPkg, ws), JS_DEPS)).filter(l => FRAMEWORK_LABELS.has(l))
    const isWs = ws.length > 0 || !!rootPkg?.workspaces || has(files, 'pnpm-workspace.yaml')
    parts.push(`Node${fw.length ? ` (${fw.join(', ')})` : ''}`)
    parts.push(packageManager(rootPkg, files) + (isWs ? ' workspace' : ''))
    if (rootPkg?.engines?.node) parts.push(`node ${rootPkg.engines.node}`)
  }
  const comp = readJSON(root, 'composer.json')
  if (comp) { const fw = labelsFrom({ ...comp.require, ...comp['require-dev'] }, PHP_DEPS).filter(l => FRAMEWORK_LABELS.has(l)); parts.push(`PHP${fw.length ? ` (${fw.join(', ')})` : ''}`) }
  if (has(files, 'pyproject.toml') || has(files, 'requirements.txt') || has(files, 'setup.py')) {
    const fw = regexLabelsFrom(`${readCapped(root, 'pyproject.toml')}\n${readCapped(root, 'requirements.txt')}`, PY_DEPS).filter(l => FRAMEWORK_LABELS.has(l))
    parts.push(`Python${fw.length ? ` (${fw.join(', ')})` : ''}`)
  }
  if (has(files, 'go.mod')) parts.push('Go')
  if (has(files, 'Cargo.toml')) parts.push('Rust')
  if (has(files, 'Gemfile')) parts.push('Ruby')
  return parts.join(' · ')
}

export function detectTech(root, files) {
  return detectLabels(root, files).filter(l => BRAND[l]).map(l => ({ label: l, slug: BRAND[l][0], color: BRAND[l][1] }))
}

export function detectEntrypoints(root, files) {
  const out = []
  const addPkg = (manifest, pkg) => {
    if (!pkg) return
    const dir = manifest === 'package.json' ? '' : manifest.replace(/package\.json$/, '')
    const tag = pkg.name ? ` (${pkg.name})` : ''
    if (typeof pkg.bin === 'string') out.push({ what: `CLI${tag}`, value: dir + pkg.bin, file: manifest })
    else if (pkg.bin) for (const [k, v] of Object.entries(pkg.bin)) out.push({ what: `CLI \`${k}\``, value: dir + v, file: manifest })
    if (pkg.main) out.push({ what: `main${tag}`, value: dir + pkg.main, file: manifest })
  }
  addPkg('package.json', readJSON(root, 'package.json'))
  for (const m of workspaceManifests(files)) addPkg(m, readJSON(root, m))
  const comp = readJSON(root, 'composer.json')
  for (const b of comp?.bin || []) out.push({ what: 'CLI', value: b, file: 'composer.json' })
  if (has(files, 'manage.py')) out.push({ what: 'Django', value: 'manage.py', file: 'manage.py' })
  if (has(files, 'artisan')) out.push({ what: 'Laravel CLI', value: 'artisan', file: 'artisan' })
  return out.slice(0, 8)
}

export function detectBoundaries(root, files) {
  const out = []
  for (const [lock, regen] of Object.entries(LOCKFILES))
    if (has(files, lock)) out.push({ path: lock, rule: `Generated lockfile — never hand-edit; regenerate with \`${regen}\`.` })
  for (const dir of GENERATED_DIRS)
    if (files.some(f => f.split('/').includes(dir))) out.push({ path: `${dir}/`, rule: 'Build/vendored output — edit the source, not this.' })
  const env = files.find(f => /(^|\/)\.env$/.test(f))
  if (env) out.push({ path: env, rule: 'Holds secrets — never commit values; reference by name only.' })
  return out
}
