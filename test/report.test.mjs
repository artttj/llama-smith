import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const LS = join(__dirname, '..')
const XSS = '<script>alert(document.cookie)</script>'

function build(data) {
  const tmp = mkdtempSync(join(tmpdir(), 'ls-report-'))
  const jsonPath = join(tmp, 'data.json')
  writeFileSync(jsonPath, JSON.stringify(data))
  const outDir = join(tmp, 'reports')
  execFileSync('node', ['scripts/report.mjs', jsonPath, outDir], { cwd: LS })
  return {
    tmp, outDir,
    index: readFileSync(join(outDir, 'index.html'), 'utf8'),
    page: repo => readFileSync(join(outDir, `${repo}.html`), 'utf8'),
  }
}

const baseRepo = (over = {}) => ({
  repo: 'evil', fullName: 'attacker/evil', stack: 'JS', commits: 5, group: 'interesting',
  opsFindings: [], architecture: [], forensics: null,
  commands: [], entrypoints: [], boundaries: [], scannedAt: new Date().toISOString(), ...over,
})

test('writes an index page and one page per repo', () => {
  const b = build([baseRepo()])
  assert.ok(b.index.includes('<!DOCTYPE html>'), 'index is an HTML document')
  assert.ok(b.page('evil').includes('attacker'), 'repo page rendered')
  rmSync(b.tmp, { recursive: true, force: true })
})

test('escapes HTML in git author names (a scanned repo cannot inject script)', () => {
  // keyPeople names come from `git log %an` of the untrusted scanned repo
  const data = [baseRepo({
    forensics: {
      busFactor: 1, risk: 'CRITICAL', contributors: 2, codeFiles: 10, singleOwner: [],
      keyPeople: [{ name: XSS, files: 5 }], topContributors: [{ name: XSS, commits: 3 }],
    },
  })]
  const b = build(data)
  const page = b.page('evil')
  assert.ok(!page.includes(XSS), 'raw <script> from author name must not reach the page')
  assert.ok(page.includes('&lt;script&gt;'), 'author name is HTML-escaped')
  rmSync(b.tmp, { recursive: true, force: true })
})

test('escapes HTML in the repo identity (org/name)', () => {
  const b = build([baseRepo({ fullName: `attacker/${XSS}` })])
  assert.ok(!b.page('evil').includes(XSS), 'repo name escaped on detail page')
  assert.ok(!b.index.includes(XSS), 'repo name escaped on index card')
  rmSync(b.tmp, { recursive: true, force: true })
})

test('forensic charts render on the detail page (chart() receives an object body, not a string)', () => {
  const data = [baseRepo({
    opsFindings: [{ smith: 'secret', severity: 'high', text: 'leak', file: 'a.js' }],
    architecture: [{ area: 'modules', claim: 'm', file: 'm.js' }],
  })]
  const b = build(data)
  assert.ok(b.page('evil').includes('Findings by Severity'), 'forensic chart card renders on the detail page')
  rmSync(b.tmp, { recursive: true, force: true })
})

test('copy-skill button uses a data attribute, never an inline JS handler', () => {
  const data = [baseRepo({ opsFindings: [{ smith: 'secret', severity: 'high', text: 'x', file: 'a.js' }] })]
  const b = build(data)
  const page = b.page('evil')
  assert.ok(page.includes('class="btn btn-primary copy-skill"'), 'button carries the copy-skill class')
  assert.ok(page.includes('data-skill='), 'skill name lives in a data attribute')
  assert.ok(!page.includes('onclick="navigator.clipboard'), 'no untrusted string in an inline handler')
  rmSync(b.tmp, { recursive: true, force: true })
})

test('nav Docs link points to real documentation, not a dead anchor', () => {
  const b = build([baseRepo()])
  const docs = b.index.match(/<a[^>]*>Docs<\/a>/)
  assert.ok(docs, 'a Docs nav link exists')
  assert.ok(!docs[0].includes('href="#"'), 'Docs link is not a dead href="#" anchor')
  assert.ok(docs[0].includes('github.com/artttj/llama-smith'), 'Docs link points to the project docs')
  rmSync(b.tmp, { recursive: true, force: true })
})
