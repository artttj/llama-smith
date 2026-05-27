import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listFiles, readSlice, headSha } from '../lib/git.mjs'

function makeRepo() {
  const d = mkdtempSync(join(tmpdir(), 'lsg-'))
  execSync('git init -q', { cwd: d })
  execSync('git config user.email a@b.c && git config user.name A', { cwd: d })
  writeFileSync(join(d, 'README.md'), '# hi\n')
  mkdirSync(join(d, 'src'))
  writeFileSync(join(d, 'src/index.js'), 'export const x = 1\n')
  execSync('git add -A && git commit -q -m init', { cwd: d })
  return d
}

test('listFiles returns tracked files', () => {
  const d = makeRepo()
  try {
    const files = listFiles(d)
    assert.ok(files.includes('README.md'))
    assert.ok(files.includes('src/index.js'))
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('readSlice reads and truncates', () => {
  const d = makeRepo()
  try {
    assert.match(readSlice(d, 'README.md'), /hi/)
    assert.equal(readSlice(d, 'nope.txt'), '')
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('headSha returns a sha or empty', () => {
  const d = makeRepo()
  try { assert.match(headSha(d), /^[0-9a-f]{7,40}$/) }
  finally { rmSync(d, { recursive: true, force: true }) }
})
