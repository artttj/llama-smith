import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCodeFile, collectChurn, topHotspots, collectOwnership } from '../lib/churn.mjs'

test('isCodeFile accepts source, rejects docs/locks/generated/manifests', () => {
  for (const p of ['src/a.js', 'pkg/x.ts', 'app/models.py', 'main.go', 'lib/x.rb', 'a/b/c.php',
                   'src/deadlock.js', 'src/interlock.ts', 'src/clockwork.rb',
                   'src/history.go', 'src/changes.ts', 'app/license.js'])
    assert.equal(isCodeFile(p), true, p)
  for (const p of ['Readme.md', 'History.md', 'CHANGES.rst', 'uv.lock', 'pnpm-lock.yaml',
                   'package-lock.json', 'yarn.lock', 'Cargo.lock', 'Gemfile.lock',
                   'pyproject.toml', 'types/index.d.ts', 'src/version.js',
                   'package.json', 'composer.json', 'notes.txt'])
    assert.equal(isCodeFile(p), false, p)
})

test('collectChurn counts name-only lines and sorts desc', () => {
  const log = 'a.js\nb.js\na.js\n\n  \nc.js\na.js'
  assert.deepEqual(collectChurn(log), [
    { file: 'a.js', edits: 3 }, { file: 'b.js', edits: 1 }, { file: 'c.js', edits: 1 }
  ])
})

test('topHotspots keeps only code, churn-ranked, even when noise churns more', () => {
  const churn = [
    { file: 'CHANGELOG.md', edits: 176 }, { file: 'pnpm-lock.yaml', edits: 34 },
    { file: 'src/reactivity/batch.js', edits: 108 }, { file: 'src/runtime.js', edits: 53 }
  ]
  assert.deepEqual(topHotspots(churn), [
    { file: 'src/reactivity/batch.js', edits: 108 }, { file: 'src/runtime.js', edits: 53 }
  ])
})

test('collectOwnership reports author count and top share', () => {
  const out = collectOwnership({ 'a.js': 'Ann\nAnn\nBob' })
  assert.deepEqual(out, [{ file: 'a.js', authors: 2, topShare: 2 / 3 }])
})
