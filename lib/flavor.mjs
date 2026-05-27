export function buildFlavorPrompt(manifestFiles) {
  const blocks = manifestFiles.map(f => `### ${f.file}\n${f.content}`).join('\n\n')
  return `You are the Architect. From these manifest files, name the primary framework/stack of this project (e.g. Magento, Laravel, Django, Next.js, FastAPI) or null if none is clear. Do not guess beyond the evidence.
Return ONLY JSON: {"framework":"<name>"|null,"confidence":"high|medium|low"}

--- MANIFEST FILES ---
${blocks}`
}

export function parseFlavor(raw) {
  if (!raw) return null
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}')
  if (s === -1 || e === -1) return null
  try {
    const o = JSON.parse(raw.slice(s, e + 1))
    if (!('framework' in o)) return null
    return { framework: o.framework ?? null, confidence: ['high', 'medium', 'low'].includes(o.confidence) ? o.confidence : 'medium' }
  } catch { return null }
}
