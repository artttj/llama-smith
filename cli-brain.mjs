#!/usr/bin/env node
import { resolve, join, dirname } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runBrain } from './lib/brain.mjs'
import { writeManifest } from './lib/manifest.mjs'
import { renderManifest, shouldColor } from './lib/render.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

function loadMascot() {
  const p = join(HERE, 'assets', 'llama.txt')
  try { return existsSync(p) ? readFileSync(p, 'utf8') : '' } catch { return '' }
}

export async function runScan(root, { dispatchFn, host, local = false, color } = {}) {
  const manifest = await runBrain(root, { dispatchFn, host, local })
  writeManifest(root, manifest)
  const useColor = color === undefined ? shouldColor() : color
  const text = renderManifest(manifest, { color: useColor, mascot: useColor ? loadMascot() : '' })
  return { text, manifest }
}

async function main() {
  const args = process.argv.slice(2)
  const local = args.includes('--local')
  const path = args.find(a => !a.startsWith('-') && a !== 'scan') || '.'
  const root = resolve(path)
  if (!existsSync(root)) { console.error(`no such path: ${root}`); process.exit(1) }
  const { text } = await runScan(root, { local })
  console.log(text)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1) })
}
