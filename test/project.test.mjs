import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectStack, detectEntrypoints, detectBoundaries } from '../lib/project.mjs'

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'ls-proj-'))
  for (const [path, body] of Object.entries(files)) {
    const p = join(root, path)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, body)
  }
  return root
}

test('detectStack names runtime, framework, package manager from manifests', () => {
  const root = fixture({
    'package.json': JSON.stringify({ dependencies: { next: '14', react: '18' }, engines: { node: '>=18' } }),
    'pnpm-lock.yaml': '',
  })
  const stack = detectStack(root, ['package.json', 'pnpm-lock.yaml'])
  assert.match(stack, /Node \(Next\.js, React\)/)
  assert.match(stack, /pnpm/)
  assert.match(stack, /node >=18/)
})

test('detectEntrypoints reads bin and main, cited to the manifest', () => {
  const root = fixture({ 'package.json': JSON.stringify({ bin: { mycli: 'cli.mjs' }, main: 'index.js' }) })
  const eps = detectEntrypoints(root, ['package.json'])
  assert.ok(eps.some(e => e.value === 'cli.mjs' && e.file === 'package.json'))
  assert.ok(eps.some(e => e.what === 'main' && e.value === 'index.js'))
})

test('detectBoundaries flags lockfiles, generated dirs, and .env with reasons', () => {
  const root = fixture({})
  const b = detectBoundaries(root, ['package-lock.json', 'dist/app.js', '.env'])
  const byPath = Object.fromEntries(b.map(x => [x.path, x.rule]))
  assert.match(byPath['package-lock.json'], /never hand-edit.*npm install/)
  assert.match(byPath['dist/'], /Build\/vendored output/)
  assert.match(byPath['.env'], /never commit/)
})
