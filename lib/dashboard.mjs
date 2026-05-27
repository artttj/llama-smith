// Render a self-contained Matrix-themed HTML dashboard from scanned manifests.
// Each manifest may carry `_vibe` (from vibeScore) and `_lessons` (array).

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const DIM_ICON = { safety: '🔒', runtime: '🫀', fragility: '🧨', hygiene: '🧼' }

function vibeBlock(v) {
  if (!v) return ''
  const bar = (k) => {
    const val = v.dims[k]
    const pct = Math.round((val / 25) * 100)
    const grey = k === 'runtime' && !v.runtimeVerified
    return `<div class="dim ${grey ? 'unver' : ''}"><span class="di">${DIM_ICON[k]} ${k}</span>
      <span class="track"><span class="fill" style="width:${pct}%"></span></span>
      <span class="dv">${val}${grey ? ' ?' : ''}</span></div>`
  }
  return `<div class="vibe">
    <div class="vscore">${v.emoji} <b>${v.total}%</b> <span class="vlabel">${esc(v.label)}</span></div>
    <div class="dims">${bar('safety')}${bar('runtime')}${bar('fragility')}${bar('hygiene')}</div>
  </div>`
}

export function renderDashboard(manifests) {
  const repos = manifests.length
  const skills = manifests.reduce((n, m) => n + (m.skills?.length || 0), 0)
  const gotchas = manifests.reduce((n, m) => n + (m.anomalies?.length || 0), 0)
  const lessons = manifests.reduce((n, m) => n + (m._lessons?.length || 0), 0)
  const vibes = manifests.filter(m => m._vibe).map(m => m._vibe.total)
  const avg = vibes.length ? Math.round(vibes.reduce((a, b) => a + b, 0) / vibes.length) : '—'

  const stat = (n, label) => `<div class="stat"><div class="n">${n}</div><div class="l">${label}</div></div>`

  const panels = manifests.map(m => {
    const fw = (m.skills || []).find(s => s.skill === 'smith-conventions')?.purpose?.replace(/^add code the | way$/g, '') || '—'
    const chips = (m.skills || []).map(s => `<span class="chip" title="${esc(s.evidence?.join(', ') || s.trigger)}">${esc(s.skill)}</span>`).join('')
    const feed = (m.anomalies || []).map((a, i) => {
      const [hook, ...rest] = a.text.split(' — ')
      return `<div class="gotcha"><span class="badge">${i + 1}</span><span>${esc(a.emoji)}</span>
        <span class="dom">${esc(a.domain)}</span>
        <div class="gtext"><b>${esc(hook)}</b>${rest.length ? ' — ' + esc(rest.join(' — ')) : ''}</div></div>`
    }).join('') || '<div class="muted">no gotchas surfaced</div>'
    const lessonList = (m._lessons || []).length
      ? `<div class="feedhead">⟐ ${m._lessons.length} battle-tested lessons</div>` +
        m._lessons.map(l => `<div class="lesson"><span class="lk">${esc(l.kind)}</span>
          <div class="ltext">${esc(l.text)}${l.learned ? `<span class="when"> · learned ${esc(l.learned.slice(0, 10))}</span>` : ''}</div></div>`).join('')
      : ''
    const exp = m.exposure ? `<div class="exposure">» 60s: ${esc(m.exposure.text)}</div>` : ''
    return `<section class="panel">
      <h2>${esc(m.project)} <span class="fw">${esc(fw)}</span></h2>
      ${vibeBlock(m._vibe)}
      <div class="chips">${chips}</div>
      <div class="feedhead">⚡ ${(m.anomalies || []).length} things worth knowing</div>
      ${feed}
      ${lessonList}
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
.stat{flex:1;min-width:110px;border:1px solid var(--gd);border-radius:10px;padding:16px;background:linear-gradient(180deg,#08110a,#05080a)}
.stat .n{font-size:32px;font-weight:700;text-shadow:0 0 10px var(--g)}
.stat .l{color:#5a8a5a;font-size:11px;text-transform:uppercase;letter-spacing:2px}
.panel{border:1px solid var(--gd);border-radius:12px;padding:20px;margin-bottom:22px;background:#070d09}
h2{margin:0 0 12px;font-size:18px}
.fw{color:var(--a);font-size:12px;border:1px solid #4a3d0a;border-radius:20px;padding:2px 10px;margin-left:8px;vertical-align:middle}
.vibe{display:flex;gap:24px;align-items:center;margin-bottom:16px;flex-wrap:wrap;border:1px solid var(--gd);border-radius:10px;padding:12px 16px;background:#060f08}
.vscore{font-size:26px;white-space:nowrap}.vscore b{text-shadow:0 0 10px var(--g)}
.vlabel{font-size:12px;color:#5a8a5a;letter-spacing:2px;vertical-align:middle}
.dims{flex:1;min-width:280px;display:grid;gap:5px}
.dim{display:grid;grid-template-columns:110px 1fr 36px;gap:8px;align-items:center;font-size:12px}
.dim.unver{opacity:.4}
.di{color:#9fe89f}.track{height:9px;background:#0c1a0c;border-radius:5px;overflow:hidden}
.fill{display:block;height:100%;background:linear-gradient(90deg,#1d6b12,var(--g));border-radius:5px}
.dv{text-align:right;color:#9fe89f}
.chips{margin-bottom:8px}
.chip{display:inline-block;border:1px solid var(--gd);border-radius:6px;padding:3px 9px;margin:0 6px 6px 0;font-size:12px;color:#9fe89f}
.feedhead{color:var(--a);letter-spacing:1px;margin:14px 0 10px;border-top:1px dashed var(--gd);padding-top:12px}
.gotcha{display:grid;grid-template-columns:22px 22px 64px 1fr;gap:8px;align-items:start;padding:7px 0;border-bottom:1px solid #0c1a0c}
.badge{background:var(--g);color:#000;border-radius:5px;text-align:center;font-weight:700}
.dom{color:var(--a);font-size:11px;letter-spacing:1px;padding-top:2px}
.gtext{color:#cfeccf}.gtext b{color:#fff}
.lesson{display:grid;grid-template-columns:104px 1fr;gap:8px;padding:6px 0;border-bottom:1px solid #0c1a0c}
.lk{color:#7ad6ff;font-size:11px;letter-spacing:1px}
.ltext{color:#cfeccf}.when{color:#5a8a5a;font-size:11px}
.exposure{margin-top:14px;color:var(--r);text-shadow:0 0 8px rgba(255,77,77,.4)}
.muted{color:#3a5a3a}
footer{color:#3a5a3a;margin-top:30px;font-size:12px}
</style></head><body><div class="wrap">
<h1>&#9180; LLAMA-SMITH</h1>
<div class="tag">repo forensics swarm &middot; ollama &middot; agent smith</div>
<div class="stats">${stat(repos, 'repos')}${stat(skills, 'skills')}${stat(gotchas, 'gotchas')}${stat(lessons, 'lessons')}${stat(typeof avg === 'number' ? avg + '%' : avg, 'avg vibe')}</div>
${panels}
<footer>generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} &middot; the rest lives in each repo's .smith/</footer>
</div></body></html>`
}
