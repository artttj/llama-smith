// Render a self-contained Matrix-themed HTML dashboard from scanned manifests.
// Input: array of manifest objects (each from .smith/manifest.json).

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderDashboard(manifests) {
  const repos = manifests.length
  const skills = manifests.reduce((n, m) => n + (m.skills?.length || 0), 0)
  const gotchas = manifests.reduce((n, m) => n + (m.anomalies?.length || 0), 0)
  const exposed = manifests.filter(m => m.exposure).length

  const stat = (n, label) => `<div class="stat"><div class="n">${n}</div><div class="l">${label}</div></div>`

  const panels = manifests.map(m => {
    const fw = (m.skills || []).find(s => s.skill === 'smith-conventions')?.purpose?.replace(/^add code the | way$/g, '') || '—'
    const chips = (m.skills || []).map(s => `<span class="chip" title="${esc(s.evidence?.join(', ') || s.trigger)}">${esc(s.skill)}</span>`).join('')
    const feed = (m.anomalies || []).map((a, i) => {
      const [hook, ...rest] = a.text.split(' — ')
      const fact = rest.join(' — ')
      return `<div class="gotcha"><span class="badge">${i + 1}</span><span class="emoji">${esc(a.emoji)}</span>
        <span class="dom">${esc(a.domain)}</span>
        <div class="gtext"><b>${esc(hook)}</b>${fact ? ' — ' + esc(fact) : ''}</div></div>`
    }).join('') || '<div class="muted">no gotchas surfaced</div>'
    const exp = m.exposure ? `<div class="exposure">» 60s: ${esc(m.exposure.text)}</div>` : ''
    return `<section class="panel">
      <h2>${esc(m.project)} <span class="fw">${esc(fw)}</span></h2>
      <div class="chips">${chips}</div>
      <div class="feedhead">⚡ ${(m.anomalies || []).length} things worth knowing</div>
      ${feed}
      ${exp}
    </section>`
  }).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>llama-smith</title>
<style>
:root{--g:#39ff14;--gd:#0a3d0a;--a:#ffcf33;--r:#ff4d4d;--bg:#05080a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--g);font:14px/1.5 'SFMono-Regular',Menlo,Consolas,monospace}
.wrap{max-width:1100px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:28px;letter-spacing:4px;margin:0;text-shadow:0 0 12px var(--g)}
.tag{color:#5a8a5a;margin:4px 0 28px}
.stats{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:32px}
.stat{flex:1;min-width:120px;border:1px solid var(--gd);border-radius:10px;padding:16px;background:linear-gradient(180deg,#08110a,#05080a)}
.stat .n{font-size:34px;font-weight:700;text-shadow:0 0 10px var(--g)}
.stat .l{color:#5a8a5a;font-size:11px;text-transform:uppercase;letter-spacing:2px}
.panel{border:1px solid var(--gd);border-radius:12px;padding:20px;margin-bottom:22px;background:#070d09}
h2{margin:0 0 12px;font-size:18px}
.fw{color:var(--a);font-size:12px;border:1px solid #4a3d0a;border-radius:20px;padding:2px 10px;margin-left:8px;vertical-align:middle}
.chips{margin-bottom:16px}
.chip{display:inline-block;border:1px solid var(--gd);border-radius:6px;padding:3px 9px;margin:0 6px 6px 0;font-size:12px;color:#9fe89f}
.feedhead{color:var(--a);letter-spacing:1px;margin:14px 0 10px;border-top:1px dashed var(--gd);padding-top:12px}
.gotcha{display:grid;grid-template-columns:24px 24px 70px 1fr;gap:8px;align-items:start;padding:8px 0;border-bottom:1px solid #0c1a0c}
.badge{background:var(--g);color:#000;border-radius:5px;text-align:center;font-weight:700}
.dom{color:var(--a);font-size:11px;letter-spacing:1px;padding-top:2px}
.gtext{color:#cfeccf}
.gtext b{color:#fff}
.exposure{margin-top:14px;color:var(--r);text-shadow:0 0 8px rgba(255,77,77,.4)}
.muted{color:#3a5a3a}
footer{color:#3a5a3a;margin-top:30px;font-size:12px}
</style></head><body><div class="wrap">
<h1>&#9180; LLAMA-SMITH</h1>
<div class="tag">repo forensics swarm &middot; ollama &middot; agent smith</div>
<div class="stats">${stat(repos, 'repos scanned')}${stat(skills, 'skills forged')}${stat(gotchas, 'gotchas found')}${stat(exposed, 'exposures')}</div>
${panels}
<footer>generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} &middot; the rest lives in each repo's .smith/</footer>
</div></body></html>`
}
