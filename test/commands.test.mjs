import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMakefile, parsePackageScripts, parseComposerScripts } from '../lib/commands.mjs'

test('parseMakefile extracts target names', () => {
  const mk = '.PHONY: build\nbuild: ## compile\n\tgo build ./...\n\ntest:\n\tgo test ./...\n'
  const t = parseMakefile(mk)
  assert.ok(t.includes('build'))
  assert.ok(t.includes('test'))
})

test('parsePackageScripts extracts script names and commands', () => {
  const pkg = JSON.stringify({ scripts: { dev: 'vite', test: 'vitest run' } })
  const s = parsePackageScripts(pkg)
  assert.equal(s.dev, 'vite')
  assert.equal(s.test, 'vitest run')
})

test('parseComposerScripts extracts scripts; tolerates missing', () => {
  assert.deepEqual(parseComposerScripts(JSON.stringify({ scripts: { test: 'phpunit' } })), { test: 'phpunit' })
  assert.deepEqual(parseComposerScripts('not json'), {})
})
