import { basename } from 'node:path'
import { listFiles, readSlice, headSha } from './git.mjs'
import { collectSignals } from './signals.mjs'
import { findExposures, topExposure } from './exposure.mjs'
import { buildFlavorPrompt, parseFlavor } from './flavor.mjs'
import { confirmExposure } from './consensus.mjs'
import { decide } from './rules.mjs'
import { assembleManifest } from './manifest.mjs'
import { dispatch as realDispatch } from './ollama.mjs'

const MODELS = { flavor: 'glm-5.1:cloud', consensus: ['kimi-k2.6:cloud'] }

export async function runBrain(root, { dispatchFn = realDispatch, host, local = false } = {}) {
  const files = listFiles(root)
  const signals = collectSignals(files)

  const secretFiles = signals.find(s => s.kind === 'secrets')?.evidence || []
  const manifestFiles = signals.find(s => s.kind === 'manifest')?.evidence || []
  const exposureInput = [...new Set([...secretFiles, ...files.filter(f => /\.(env|ya?ml|json|php|sh)$/.test(f)).slice(0, 30)])]
    .map(f => ({ file: f, content: readSlice(root, f) }))
  const manifestInput = manifestFiles.map(f => ({ file: f, content: readSlice(root, f) }))

  let flavor = null
  if (manifestInput.length) {
    const stripped = (m) => local ? m.replace(/:cloud$/, '') : m
    const r = await dispatchFn(stripped(MODELS.flavor), buildFlavorPrompt(manifestInput), host)
    if (r.success) flavor = parseFlavor(r.content)
  }

  const exposures = findExposures(exposureInput)
  let exposure = topExposure(exposures)
  if (exposure) {
    const models = local ? MODELS.consensus.map(m => m.replace(/:cloud$/, '')) : MODELS.consensus
    exposure = await confirmExposure(exposure, models, dispatchFn, host)
  }

  const entries = decide(signals, flavor)
  return assembleManifest({ project: basename(root), sha: headSha(root), entries, exposure })
}
