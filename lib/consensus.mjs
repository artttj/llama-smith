// dispatchFn(model, prompt, host) -> { success, content }
export async function confirmExposure(exposure, models, dispatchFn, host) {
  if (!exposure) return null
  const prompt = `A deterministic scan flagged: "${exposure.text}" in ${exposure.file}. Based only on that file path and description, is this plausibly a real exposed secret (not an example/placeholder/test fixture)? Return ONLY JSON: {"confirmed":true|false}.`
  for (const model of models) {
    const r = await dispatchFn(model, prompt, host)
    if (!r.success) continue
    try {
      const s = r.content.indexOf('{'), e = r.content.lastIndexOf('}')
      const o = JSON.parse(r.content.slice(s, e + 1))
      if (o.confirmed === true) return exposure
    } catch { /* ignore */ }
    return null // a clear deny or unparseable from the confirming model drops it
  }
  return exposure // no confirming model available → keep the deterministic finding
}
