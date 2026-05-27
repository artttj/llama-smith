// Matrix-themed HTML dashboard. Glow is a reward (numbers/title only); body text
// is calm and readable. Each manifest may carry `_vibe` and `_lessons`.

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const DIM = {
  safety:    { icon: '🔒', label: 'Safety',    help: 'exposed secrets & ungated dangerous ops' },
  runtime:   { icon: '🫀', label: 'Runtime',   help: 'is it actually alive — needs Reality Check to verify' },
  fragility: { icon: '🧨', label: 'Fragility', help: 'bus factor, churn hotspots, no-test landmines' },
  hygiene:   { icon: '🧼', label: 'Hygiene',   help: 'version drift, silent crons, firefighting, debt' }
}

const TIER_FLAVOR = {
  PRISTINE: 'suspiciously clean',
  SOLID: 'survived first contact',
  'SMELLS FUNNY': 'you know where the bodies are',
  'NEEDS HELP': 'pour one out',
  'DUMPSTER FIRE': 'how is this in prod'
}

function vibeBlock(v) {
  if (!v) return ''
  const bars = Object.keys(DIM).map(k => {
    const val = v.dims[k]
    const pct = Math.round((val / 25) * 100)
    const grey = k === 'runtime' && !v.runtimeVerified
    return `<div class="dim${grey ? ' unver' : ''}" title="${esc(DIM[k].help)}">
      <span class="di">${DIM[k].icon} ${DIM[k].label}</span>
      <span class="track"><span class="fill" style="width:${pct}%"></span></span>
      <span class="dv">${val}${grey ? '<span class="q"> ?</span>' : ''}</span></div>`
  }).join('')
  return `<div class="vibe">
    <div class="vhead"><span class="vemoji">${v.emoji}</span> <b class="vscore">${v.total}%</b>
      <span class="vlabel">${esc(v.label)}</span> <span class="vflavor">${esc(TIER_FLAVOR[v.label] || '')}</span></div>
    <div class="dims">${bars}</div>
    <div class="legend">🔒 secrets · 🫀 alive? · 🧨 fragile · 🧼 hygiene &nbsp;·&nbsp; bars dim until earned</div>
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
    const fw = (m.skills || []).find(s => s.skill === 'smith-conventions')?.purpose?.replace(/^add code the | way$/g, '') || ''
    const chips = (m.skills || []).map(s => `<span class="chip" title="${esc(s.evidence?.join(', ') || s.trigger)}">${esc(s.skill.replace(/^smith-/, ''))}</span>`).join('')
    const scars = (m.anomalies || []).map((a, i) => {
      const [title, ...rest] = a.text.split(' — ')
      const explain = rest.join(' — ')
      return `<div class="scar"><span class="snum">${i + 1}</span><span class="sem">${esc(a.emoji)}</span>
        <span class="sarea">${esc(a.domain)}</span>
        <div class="sbody"><div class="stitle">${esc(title)}</div>${explain ? `<div class="sexpl">${esc(explain)}</div>` : ''}</div></div>`
    }).join('') || '<div class="muted">no scars surfaced</div>'
    const lessonList = (m._lessons || []).length
      ? `<div class="sectit">◇ lessons extracted <span class="subtit">scars converted into skills</span></div>` +
        m._lessons.map(l => `<div class="lesson"><span class="lk">${esc(l.kind)}</span>
          <div class="ltext">${esc(l.text)}${l.learned ? `<span class="when"> · learned ${esc(l.learned.slice(0, 10))}</span>` : ''}</div></div>`).join('')
      : ''
    const exp = m.exposure ? `<div class="sectit">☠ blast radius</div><div class="exposure">${esc(m.exposure.text)}</div>` : ''
    return `<section class="panel">
      <div class="phead"><h2>${esc(m.project)}</h2>${fw ? `<span class="fw">${esc(fw)}</span>` : ''}</div>
      ${vibeBlock(m._vibe)}
      <div class="chips">${chips}</div>
      <div class="sectit">⚡ repo scars <span class="subtit">not bugs, repo folklore</span></div>
      ${scars}
      ${lessonList}
      ${exp}
    </section>`
  }).join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>llama-smith</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--matrix:#39ff14;--soft:#8fdc8a;--text:#d8f5d2;--muted:#6c9968;--yellow:#ffd84a;--red:#ff6b6b;--bg:#05080a;--panel:#020b05;--line:rgba(57,255,20,.18)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.6 "IBM Plex Mono",monospace}
.disp{font-family:"Share Tech Mono",monospace}
.glow{text-shadow:0 0 10px var(--matrix)}
.wrap{max-width:1080px;margin:0 auto;padding:30px 20px 80px;position:relative;z-index:1}
.scan{position:fixed;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(57,255,20,.5),transparent);opacity:.5;animation:sweep 8s linear infinite;z-index:0;pointer-events:none}
@keyframes sweep{0%{top:-2%}100%{top:102%}}
h1{font-size:30px;letter-spacing:5px;margin:0;color:var(--matrix);text-shadow:0 0 14px var(--matrix)}
.tag{color:var(--muted);margin:6px 0 26px;letter-spacing:1px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:30px}
.stat{flex:1;min-width:96px;border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--panel)}
.stat .n{font-size:30px;font-weight:700;color:var(--matrix);text-shadow:0 0 10px var(--matrix)}
.stat .l{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:2px;font-family:"Share Tech Mono",monospace}
.panel{border:1px solid var(--line);border-radius:12px;padding:22px;margin-bottom:20px;background:var(--panel)}
.phead{display:flex;align-items:baseline;gap:10px;margin-bottom:14px}
h2{font-family:"Share Tech Mono",monospace;margin:0;font-size:20px;color:var(--soft);letter-spacing:1px}
.fw{color:var(--yellow);font-size:11px;border:1px solid rgba(255,216,74,.3);border-radius:20px;padding:2px 10px}
.vibe{border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:14px}
.vhead{display:flex;align-items:baseline;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.vemoji{font-size:22px}.vscore{font-family:"Share Tech Mono",monospace;font-size:24px;color:var(--matrix);text-shadow:0 0 10px var(--matrix)}
.vlabel{font-family:"Share Tech Mono",monospace;color:var(--soft);letter-spacing:2px;font-size:13px}
.vflavor{color:var(--muted);font-size:12px;font-style:italic}
.dims{display:grid;gap:6px}
.dim{display:grid;grid-template-columns:118px 1fr 42px;gap:10px;align-items:center;font-size:12px}
.dim.unver{opacity:.4}.q{color:var(--muted)}
.di{color:var(--soft)}
.track{height:8px;background:rgba(57,255,20,.08);border-radius:5px;overflow:hidden}
.fill{display:block;height:100%;background:var(--matrix);border-radius:5px;box-shadow:0 0 6px rgba(57,255,20,.5)}
.dv{text-align:right;color:var(--soft);font-family:"Share Tech Mono",monospace}
.legend{margin-top:10px;color:var(--muted);font-size:11px}
.chips{margin:4px 0 6px}
.chip{display:inline-block;border:1px solid var(--line);border-radius:6px;padding:3px 9px;margin:0 6px 6px 0;font-size:12px;color:var(--soft);font-family:"Share Tech Mono",monospace}
.sectit{font-family:"Share Tech Mono",monospace;color:var(--yellow);letter-spacing:1px;margin:16px 0 10px;border-top:1px solid var(--line);padding-top:12px}
.subtit{color:var(--muted);font-size:11px;letter-spacing:0;font-style:italic;font-family:"IBM Plex Mono",monospace;text-transform:none}
.scar{display:grid;grid-template-columns:20px 22px 64px 1fr;gap:9px;align-items:start;padding:8px 0;border-bottom:1px solid rgba(57,255,20,.07)}
.snum{color:var(--muted);font-family:"Share Tech Mono",monospace}
.sarea{color:var(--yellow);font-size:10px;letter-spacing:1px;padding-top:3px;font-family:"Share Tech Mono",monospace}
.stitle{color:var(--soft);font-weight:500}
.sexpl{color:var(--text);font-size:13px;line-height:1.5;margin-top:2px;opacity:.85}
.lesson{display:grid;grid-template-columns:100px 1fr;gap:10px;padding:7px 0;border-bottom:1px solid rgba(57,255,20,.07)}
.lk{color:#7ad6ff;font-size:11px;font-family:"Share Tech Mono",monospace}
.ltext{color:var(--text)}.when{color:var(--muted);font-size:11px}
.exposure{color:var(--red)}
.muted{color:var(--muted)}
footer{color:var(--muted);margin-top:28px;font-size:11px}
</style></head><body>
<div class="scan"></div>
<div class="wrap">
<h1>&#9180; LLAMA-SMITH</h1>
<div class="tag">repo forensics swarm · ollama · agent smith · no spoon &nbsp;🦙</div>
<div class="stats">${stat(repos, 'repos')}${stat(skills, 'skills')}${stat(gotchas, 'scars')}${stat(lessons, 'lessons')}${stat(typeof avg === 'number' ? avg + '%' : avg, 'avg vibe')}</div>
${panels}
<footer>🦙 agent smith cloned ${skills} repo skills · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · the rest lives in each repo's .smith/</footer>
</div></body></html>`
}
