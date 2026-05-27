#!/usr/bin/env node
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runForge } from './lib/forge.mjs'

function renderSummary({ project, results, exposure }, color) {
  const R = color ? '\x1b[31m' : '', X = color ? '\x1b[0m' : ''
  const lines = [`llama-smith · forged ${results.length} skills into .claude/skills/ (${project})`, '']
  for (const r of results) {
    const flag = r.status === 'written' ? (r.citations && r.citations.ok ? 'ok' : 'check citations') : r.status
    lines.push(`  ▸ ${r.skill.padEnd(18)} ${flag}`)
  }
  if (exposure) {
    lines.push('', 'and one more thing — here\'s what I\'d know about you in 60 seconds:', '  ' + R + '» ' + exposure.text + X)
  }
  return lines.join('\n')
}

export async function runForgeCli(root, { dispatchFn, host, local = false, only = null, color } = {}) {
  const useColor = color === undefined ? (process.stdout.isTTY === true && !process.env.NO_COLOR) : color
  const out = await runForge(root, { dispatchFn, host, local, only })
  return { text: renderSummary(out, useColor), results: out.results }
}

async function main() {
  const args = process.argv.slice(2)
  const local = args.includes('--local')
  const onlyIdx = args.indexOf('--only')
  const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null
  const path = args.find((a, i) => !a.startsWith('-') && a !== 'forge' && args[i - 1] !== '--only') || '.'
  const root = resolve(path)
  if (!existsSync(root)) { console.error(`no such path: ${root}`); process.exit(1) }
  const { text } = await runForgeCli(root, { local, only })
  console.log(text)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1) })
}
