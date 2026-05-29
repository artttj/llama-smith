import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMakefile, parsePackageScripts, parseComposerScripts, parseWorkflowCommands, classifyCommand } from '../lib/commands.mjs'

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

test('parseWorkflowCommands captures inline and block-scalar run steps', () => {
  const yml = [
    'jobs:',
    '  ci:',
    '    steps:',
    '      - run: npm ci',
    '      - name: test',
    '        run: |',
    '          npm run build',
    '          npm test',
    '      - run: echo done',
  ].join('\n')
  const cmds = parseWorkflowCommands(yml)
  assert.ok(cmds.includes('npm ci'))
  assert.ok(cmds.includes('npm run build'))
  assert.ok(cmds.includes('npm test'))
  assert.ok(cmds.includes('echo done'))
})

test('parseWorkflowCommands skips comments and empty runs', () => {
  assert.deepEqual(parseWorkflowCommands('steps:\n  - run: |\n      # just a comment\n      make deploy'), ['make deploy'])
})

test('parseWorkflowCommands folds backslash line-continuations into one command', () => {
  const yml = 'steps:\n  - run: |\n      php gen.php \\\n        ClassA \\\n        ClassB'
  const cmds = parseWorkflowCommands(yml)
  assert.equal(cmds.length, 1)
  assert.match(cmds[0], /php gen\.php ClassA ClassB/)
})

test('classifyCommand buckets by intent', () => {
  assert.equal(classifyCommand('npm test'), 'test')
  assert.equal(classifyCommand('npm run lint'), 'lint')
  assert.equal(classifyCommand('vite build'), 'build')
  assert.equal(classifyCommand('npm publish'), 'deploy')
  assert.equal(classifyCommand('npm run dev'), 'other')
})
