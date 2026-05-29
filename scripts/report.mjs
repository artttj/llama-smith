// Render real-repo probe results into a Matrix-flavored, readable dashboard:
// a hero index (scanned sites + glitch feed) and one forensic page per repo.
// Usage: node scripts/report.mjs [results.json] [outDir]
import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSkillFiles, adaptLessons } from '../lib/skill.mjs'

const LS = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))))
const src = process.argv[2] || '/tmp/ls-results.json'
const outDir = process.argv[3] || join(LS, 'reports')
const data = JSON.parse(readFileSync(src, 'utf8'))

const FULL = {
  laravel: 'laravel/framework', nextjs: 'vercel/next.js', astro: 'withastro/astro', drizzle: 'drizzle-team/drizzle-orm', hono: 'honojs/hono',
  symfony: 'symfony/symfony', fastify: 'fastify/fastify', nestjs: 'nestjs/nest', strapi: 'strapi/strapi',
  proxycollect: 'cook369/proxy-collect', yesmem: 'carsteneu/yesmem', kerosene: 'nilesjarvis/kerosene', silkennet: 'Alexey-Lukin/silken_net', jitsiscanner: 'denpiligrim/jitsi-scanner',
  gofood: 'Setiawan007/GoFood-Tools', drawbang: 'potomak/drawbang', stella: 'CherryHQ/stella', autopush: 'kingsleyesisi/auto-push', collector: 'giromo/Collector',
}
const STACK = {
  laravel: 'PHP', nextjs: 'JS', astro: 'TS', drizzle: 'TS', hono: 'TS', symfony: 'PHP', fastify: 'JS', nestjs: 'TS', strapi: 'JS',
  proxycollect: 'PY', yesmem: 'GO', kerosene: 'RS', silkennet: 'RB', jitsiscanner: 'GO', gofood: 'PHP', drawbang: 'TS', stella: 'GO', autopush: 'PY', collector: 'GO',
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const sevCount = (r, s) => (r.opsFindings || []).filter(f => f.severity === s).length
const SEVRANK = { high: 0, medium: 1, low: 2 }
const repoFull = r => r.fullName || FULL[r.repo] || r.repo
const repoStack = r => r.stack || STACK[r.repo] || '?'
const repoStars = r => r.stars ?? null
const readAsset = f => { const p = join(LS, 'assets', f); return existsSync(p) ? readFileSync(p, 'utf8').replace(/\n+$/, '') : '' }
const HERO_SRC = join(LS, 'assets', 'hero.webp')
const HAS_HERO = existsSync(HERO_SRC)
const LOGO_SRC = join(LS, 'assets', 'logo.webp')
const HAS_LOGO = existsSync(LOGO_SRC)
const LLAMA = readAsset('illustrations/llama.svg')

// Lucide line icons, inlined (offline, themeable via currentColor).
const SVG = i => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${i}</svg>`
const I = {
  scan: SVG('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>'),
  repo: SVG('<path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.8 1.2a2 2 0 0 0 1.7.9H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z"/>'),
  shield: SVG('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/>'),
  high: SVG('<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  medium: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
  low: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  key: SVG('<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>'),
  cron: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  rocket: SVG('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>'),
  package: SVG('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  bug: SVG('<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>'),
  eye: SVG('<path d="M2.06 12.34a1.7 1.7 0 0 1 0-.68 10.94 10.94 0 0 1 19.88 0 1.7 1.7 0 0 1 0 .68 10.94 10.94 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>'),
  zap: SVG('<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'),
  file: SVG('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/>'),
  copy: SVG('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>'),
  arrow: SVG('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
  branch: SVG('<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'),
  bus: SVG('<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>'),
  users: SVG('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  layers: SVG('<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'),
}
const SMITH_ICON = { deploy: 'rocket', secret: 'key', cron: 'cron', ci: 'branch', scar: 'bug' }
const SMITH_STAMP = { deploy: 'DEPLOY-SMITH', secret: 'SECRET-SMITH', cron: 'CRON-SMITH', ci: 'CI-SMITH', scar: 'SCAR-SMITH' }
const stamp = t => `<span class="stamp">[${esc(t)}]</span>`

const CSS = readAsset("dashboard.css")  // editable in assets/dashboard.css, inlined at build

const RAIN = `const c=document.getElementById('rain');
if(c&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const x=c.getContext('2d');let cols,d;
const g='\\uFF8A\\uFF90\\uFF8B\\uFF70\\uFF73\\uFF7C\\uFF85\\uFF93\\uFF86\\uFF7B\\uFF9C01<>{}/=;()[]'.split('');
function s(){c.width=innerWidth;c.height=innerHeight;cols=Math.floor(c.width/14);d=Array(cols).fill(0)}s();addEventListener('resize',s);
(function f(){x.fillStyle='rgba(7,13,9,0.09)';x.fillRect(0,0,c.width,c.height);x.fillStyle='#3ddc84';x.font='13px monospace';
for(let i=0;i<cols;i++){x.fillText(g[Math.floor(Math.random()*g.length)],i*14,d[i]*14);if(d[i]*14>c.height&&Math.random()>0.975)d[i]=0;d[i]++}
requestAnimationFrame(()=>setTimeout(f,55))})();}`
// Skill folder: accordion. Open one file, collapse the rest, smooth-scroll to it.
const FILES_JS = `document.querySelectorAll('.skillfolder').forEach(F=>{const D=[...F.querySelectorAll('.sf')];
D.forEach(d=>d.addEventListener('toggle',()=>{if(d.open)D.forEach(o=>{if(o!==d)o.open=false})}));
F.querySelectorAll('[data-fi]').forEach(el=>el.addEventListener('click',()=>{const i=+el.dataset.fi;D.forEach((o,j)=>o.open=(j===i));D[i].scrollIntoView({behavior:'smooth',block:'start'})}));
D.forEach(d=>d.querySelector('summary').addEventListener('click',()=>{if(!d.open)setTimeout(()=>d.scrollIntoView({behavior:'smooth',block:'nearest'}),0)}));
const t=F.querySelector('.md-toggle');if(t)t.addEventListener('click',()=>{const on=F.classList.toggle('rich');t.setAttribute('aria-pressed',on);t.lastChild.textContent=on?' raw markdown':' rich text'});});`

const shell = (title, body, js = '') => `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.bunny.net" crossorigin>
<link rel="stylesheet" href="https://fonts.bunny.net/css?family=jetbrains-mono:400,500,600,700,800">
<style>${CSS}</style></head>
<body><canvas id="rain"></canvas><div class="wrap">${body}</div>
<script>${RAIN}${js}</script></body></html>`

const brandmark = HAS_LOGO ? '<img class="bl" src="logo.webp" width="40" height="40" alt="llama-smith logo">' : `<span class="bl">${LLAMA}</span>`
const brandbar = () => `<a class="brandbar" href="index.html">${brandmark}<span class="bt">llama<b>·</b>smith</span></a>`
const statusOf = r => r.opsSharpness === 'failed' ? 'failed' : r.opsSharpness === 'clean' || !(r.opsFindings || []).length ? 'clean' : 'sharp'

// Opinionated one-liner, grounded: the validated architecture overview is the
// factual spine; the verdict is the opinion the findings earn. Never invented.
function repoBlurb(r) {
  const overview = (r.architecture || []).find(a => a.area === 'overview')
  const h = sevCount(r, 'high'), m = sevCount(r, 'medium'), l = sevCount(r, 'low')
  const spine = overview ? overview.claim.replace(/\s*\.\s*$/, '') : `${repoStack(r)} · ${(r.commits || 0).toLocaleString()} commits deep`
  let verdict
  if (statusOf(r) === 'failed') verdict = 'the construct could not read it'
  else if (h) verdict = `carrying ${h} high-severity ${h > 1 ? 'traps' : 'trap'} the Smiths dragged into the light`
  else if (m + l) verdict = `mostly clean — ${m + l} minor note${m + l > 1 ? 's' : ''}, nothing critical`
  else verdict = 'pipeline came back clean, nothing to hide'
  return `${spine} — ${verdict}.`
}

const ownerOf = full => (full.includes('/') ? full.split('/')[0] : '')
const avatarImg = (full, cls = '') => {
  const o = ownerOf(full)
  return o ? `<img class="avatar ${cls}" src="https://github.com/${esc(o)}.png?size=80" width="80" height="80" loading="lazy" alt="${esc(o)} avatar">` : ''
}

// Allow relative paths and fragments; reject any non-http(s)/mailto scheme
// (javascript:, data:) so forged link text can't inject an executable URL.
const safeHref = u => { const t = u.trim(); return /^[a-z][a-z0-9+.-]*:/i.test(t) && !/^(https?|mailto):/i.test(t) ? '#' : t }
const mdInline = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${safeHref(u)}" rel="noopener noreferrer">${t}</a>`)
  .replace(/_\(([^)]+)\)_/g, '<em>($1)</em>')

function mdToHtml(md) {
  const out = []
  let inList = false, para = []
  const flushPara = () => { if (para.length) { out.push(`<p>${mdInline(para.join(' '))}</p>`); para = [] } }
  const flushList = () => { if (inList) { out.push('</ul>'); inList = false } }
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) { flushPara(); flushList(); continue }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) { flushPara(); flushList(); out.push(`<h${h[1].length}>${mdInline(h[2])}</h${h[1].length}>`); continue }
    if (/^---+$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); continue }
    if (/^>\s?/.test(line)) { flushPara(); flushList(); out.push(`<blockquote>${mdInline(line.replace(/^>\s?/, ''))}</blockquote>`); continue }
    if (/^[-*]\s+/.test(line)) { flushPara(); if (!inList) { out.push('<ul>'); inList = true } out.push(`<li>${mdInline(line.replace(/^[-*]\s+/, ''))}</li>`); continue }
    para.push(line.trim())
  }
  flushPara(); flushList()
  return out.join('\n')
}

const AREA_LABELS = { overview: 'Overview', modules: 'Modules', dataflow: 'Data flow', datamodel: 'Data model', entrypoints: 'Entrypoints', abstractions: 'Concepts' }
const RISK_TIER = { CRITICAL: 'high', HIGH: 'med', MODERATE: 'med', GOOD: 'low' }

const chart = (icon, title, body) => (body ? `<figure class="chart"><figcaption>${icon}${title}</figcaption>${body}</figure>` : '')

function barChart(rows, { unit = '' } = {}) {
  if (!rows.length) return ''
  const max = Math.max(...rows.map(r => r.value), 1)
  const row = r => `<div class="bc-row${r.danger ? ' danger' : ''}">
      <span class="bc-label" title="${esc(r.full || r.label)}">${esc(r.label)}</span>
      <span class="bc-track"><i style="width:${Math.max(3, Math.round(r.value / max * 100))}%"></i></span>
      <span class="bc-val">${r.value.toLocaleString()}${unit}${r.danger ? '<span class="bc-flag">solo</span>' : ''}</span>
    </div>`
  return `<div class="barchart" role="img" aria-label="bar chart">${rows.map(row).join('')}</div>`
}

function busFactorBlock(fr) {
  const band = ['CRITICAL', 'HIGH', 'MODERATE', 'GOOD']
    .map(t => `<span class="bf-seg${t === fr.risk ? ' on ' + RISK_TIER[t] : ''}">${t}</span>`).join('')
  const people = (fr.keyPeople || []).slice(0, 3).map(p => esc(p.name)).join(', ')
  return `<div class="busfactor">
    <div class="bf-head"><span class="bf-bus">${I.bus}</span><div class="bf-num">${fr.busFactor}<span class="bf-cap">bus factor</span></div></div>
    <div class="bf-band">${band}</div>
    ${people ? `<p class="bf-note">${people}${fr.keyPeople.length > 3 ? ' and others' : ''} hold most of the code.</p>` : ''}
  </div>`
}

function archCoverage(architecture) {
  const counts = Object.keys(AREA_LABELS).map(area => ({ label: AREA_LABELS[area], value: (architecture || []).filter(a => a.area === area).length }))
  return counts.filter(c => c.value)
}

const SMITH_LABEL = { deploy: 'Deploy', secret: 'Secret', cron: 'Cron', ci: 'CI' }
function corpusCharts() {
  const shortName = r => repoFull(r).split('/').pop()
  const smithCounts = {}
  for (const r of data) for (const f of (r.opsFindings || [])) smithCounts[f.smith] = (smithCounts[f.smith] || 0) + 1
  const findingRows = Object.entries(smithCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: SMITH_LABEL[k] || k, value: v, danger: k === 'secret' }))
  const archRows = data.map(r => ({ label: shortName(r), value: (r.architecture || []).length })).filter(r => r.value).sort((a, b) => b.value - a.value)
  const busRows = data.filter(r => r.forensics?.busFactor).map(r => ({ label: shortName(r), value: r.forensics.busFactor, danger: r.forensics.busFactor <= 2 })).sort((a, b) => a.value - b.value)
  const charts = [
    chart(I.scan, 'Findings by Smith', barChart(findingRows)),
    chart(I.layers, 'Architecture facts per repo', barChart(archRows)),
    busRows.length ? chart(I.bus, 'Bus factor by repo', barChart(busRows)) : '',
  ].filter(Boolean).join('')
  if (!charts) return ''
  return `<div class="sec"><span class="chip">${I.zap} Signals across the corpus</span><h2>Read from ${data.length} repos</h2><p class="sub">Aggregate facts from every scan — findings by Smith, how much architecture each map captured, and where knowledge concentrates.</p></div><div class="charts">${charts}</div>`
}

function glitchFeed() {
  const all = data.flatMap(r => (r.opsFindings || []).map(f => ({ f, r })))
    .sort((a, b) => (SEVRANK[a.f.severity] ?? 1) - (SEVRANK[b.f.severity] ?? 1))
  return all.slice(0, 6).map((x, i) => {
    const full = repoFull(x.r), ico = I[SMITH_ICON[x.f.smith]] || I.zap
    return `<a class="glitch sev-${esc(x.f.severity)}" href="${esc(x.r.repo)}.html">
      <span class="gi">${ico}<span class="idx">${String(i + 1).padStart(2, '0')}</span></span>
      <span><span class="hook">${esc(x.f.text)}</span>
        <span class="cite">${stamp(SMITH_STAMP[x.f.smith] || 'SMITH')}<span class="repo">${esc(full)}</span>${x.f.file ? `<span class="path">${esc(x.f.file)}</span>` : ''}</span>
        <span class="arrow">open ${esc(x.r.repo)} report ${I.arrow}</span></span>
      <span class="badge ${esc(x.f.severity)}">${I[x.f.severity] || ''}${esc(x.f.severity)}</span></a>`
  }).join('')
}

const TYPES = [
  { ic: 'eye', stamp: 'ARCHITECT-SMITH', name: 'Project architecture', desc: '🧭 What the app is, its modules, data flow, data model, and entrypoints — the matrix of the codebase. Every claim validated against a real file.' },
  { ic: 'package', stamp: 'STACK-MAP', name: 'Stack & commands', desc: '⚙️ The real stack, entrypoints, and the build/test/deploy commands an agent should run — parsed from manifests and CI, never invented.' },
  { ic: 'shield', stamp: 'BOUNDARIES', name: 'Do-not-touch', desc: '🚧 Lockfiles, generated output, and env files an agent must not hand-edit — with the reason it must not.' },
  { ic: 'rocket', stamp: 'OPS-SMITHS', name: 'Operational risk', desc: '🚨 Deploy traps, secret leaks, and cron ghosts. The ops layer hanging off the architecture, not the headline.' },
  { ic: 'bug', stamp: 'FRAGILITY', name: 'Fragile hotspots', desc: '🔥 Code that churns hard over the last year. Where bugs live. Docs and lockfiles excluded.' },
  { ic: 'eye', stamp: 'ORACLE', name: 'Two oracles', desc: '🔮 The Validation Oracle re-reads each claim against its file — hallucinations die here. The Self-Improvement Oracle keeps the skill\'s memory.' },
]

function card(r) {
  const full = repoFull(r), [org, name] = full.includes('/') ? full.split('/') : ['', full]
  const st = statusOf(r)
  const h = sevCount(r, 'high'), m = sevCount(r, 'medium'), l = sevCount(r, 'low'), tot = Math.max(h + m + l, 1)
  const bar = (c, n) => n ? `<i class="${c}" style="width:${Math.round(n / tot * 100)}%"></i>` : ''
  const top = (r.opsFindings || []).find(f => f.file)
  const meta = [repoStars(r) != null ? `<span><b>${repoStars(r)}</b>★</span>` : '', `<span><b>${(r.commits || 0).toLocaleString()}</b> commits</span>`, `<span><b>${r.scanSeconds || 0}</b>s</span>`].filter(Boolean).join('')
  const sev = (h + m + l) ? `<div class="sevbar"><div class="track">${bar('h', h)}${bar('m', m)}${bar('l', l)}</div>
      <div class="legend"><span class="h"><span class="d"></span><b>${h}</b> high</span><span class="m"><span class="d"></span><b>${m}</b> med</span><span class="l"><span class="d"></span><b>${l}</b> low</span></div></div>`
    : `<div class="sevbar"><div class="legend"><span>${st === 'failed' ? 'scan failed' : 'no findings — clean'}</span></div></div>`
  return `<a class="card ${st === 'failed' ? 'glitchfail' : ''}" href="${esc(r.repo)}.html">
    <div class="head">${avatarImg(full)}<span class="cn"><span class="org">${esc(org)}${org ? '/' : ''}</span>${esc(name)}</span></div>
    <div class="meta"><span class="pill stack">${esc(repoStack(r))}</span><span class="pill status ${st}">${st === 'failed' ? 'SIGNAL LOST' : st.toUpperCase()}</span>${meta}</div>
    <p class="blurb">${esc(repoBlurb(r))}</p>
    ${sev}
    ${top ? `<div class="reveal-line">validated against ${esc(top.file)}</div>` : ''}
    <span class="go">open report ${I.arrow}</span></a>`
}

function indexPage() {
  const all = data.flatMap(r => r.opsFindings || [])
  const S = {
    repos: data.length, findings: all.length,
    high: all.filter(f => f.severity === 'high').length,
    forged: data.filter(r => (r.skills || []).length || r.skillForged).length,
    commits: data.reduce((n, r) => n + (r.commits || 0), 0),
    arch: data.reduce((n, r) => n + (r.architecture || []).length, 0),
  }
  const famous = data.filter(r => r.group !== 'wild' && r.group !== 'boring')
  const wild = data.filter(r => r.group === 'wild' || r.group === 'boring')
  const heroArt = HAS_HERO
    ? `<div class="badge-card"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl2"></span><span class="corner br"></span><img class="hero-img" src="hero.webp" width="620" height="620" alt="llama-smith — a Matrix Agent Smith llama emblem"></div>`
    : `<div class="badge-card" style="padding:2rem 3rem"><span class="bt" style="font-size:2rem;color:var(--green-hot)">llama·smith</span></div>`
  const body = `${brandbar()}
  <header class="hero">
    <div class="hero-main">
      ${heroArt}
      <div class="hero-copy">
        <h1 class="slogan">Many Smiths enter.<br>One skill comes out.</h1>
        <p class="lede">Point llama-smith at any repo. A swarm of Ollama models maps how it's built — <span class="hot">architecture, modules, data flow</span> — and where it deploys, leaks, and breaks, then forges a project skill validated by the Oracle.</p>
        <div class="taglines"><span>Maps the matrix of a codebase</span><span>Every claim cites a file</span><span>Hallucinations die at the citation step</span><span>Runs on your Ollama, local or cloud</span></div>
      </div>
    </div>
  </header>
  <section class="stats">
    <div class="stat">${I.repo}<div class="n">${S.repos}</div><div class="l">repos mapped</div></div>
    <div class="stat hi">${I.eye}<div class="n">${S.arch}</div><div class="l">architecture facts</div></div>
    <div class="stat">${I.scan}<div class="n">${S.findings}</div><div class="l">operational findings</div></div>
    <div class="stat">${I.high}<div class="n">${S.high}</div><div class="l">critical risks</div></div>
    <div class="stat">${I.file}<div class="n">${S.forged}</div><div class="l">skills forged</div></div>
    <div class="stat">${I.branch}<div class="n">${S.commits.toLocaleString()}</div><div class="l">commits read</div></div>
  </section>
  <div class="sec"><span class="chip">${I.repo} Scanned sites</span><h2>The most-used repos on earth</h2><p class="sub">Click a repo for its full forensic report, churn map, and forged skill.</p></div>
  <div class="grid">${famous.map(card).join('')}</div>
  ${wild.length ? `<div class="sec"><span class="chip">${I.eye} In the wild</span><h2>Random low-star repos</h2><p class="sub">Does it stay honest when there's little to find?</p></div><div class="grid">${wild.map(card).join('')}</div>` : ''}
  ${corpusCharts()}
  <div class="sec"><span class="chip">${I.scan} What the skill captures</span><h2>The matrix of a codebase</h2><p class="sub">Architecture first — what it is and how it's built. Then the ops layer: deploy traps, secret leaks, cron ghosts.</p></div>
  <div class="types">${TYPES.map(t => `<div class="type"><div class="th">${I[t.ic]}<h3>${esc(t.name)}</h3></div>${stamp(t.stamp)}<p>${esc(t.desc)}</p></div>`).join('')}</div>
  <div class="sec"><span class="chip">${I.zap} Glitch feed</span><h2>The scariest findings, ranked</h2><p class="sub">Every one validated against a real file. Unknown stays unknown.</p></div>
  <div class="glitches">${glitchFeed()}</div>
  <footer>Forged by <b>llama-smith</b> · it reads your <b>ops</b>, not your vibes · cartoon llama by <b>OpenMoji</b> (CC BY-SA 4.0), icons by Lucide (ISC)</footer>`
  return shell('llama-smith · the construct', body)  // shell already includes RAIN
}

function skillPanel(r) {
  const ops = r.opsFindings || [], hot = r.newCodeHotspots || []
  if (!ops.length && !hot.length) {
    return `<div class="skill"><div class="bar">${I.file} skill ${stamp('NOT FORGED')}</div><pre class="empty">Nothing to forge — the swarm found no operational risk and no churn worth recording. Skip, don't stub.</pre></div>`
  }
  const built = buildSkillFiles(
    { repo: r.repo, fullName: repoFull(r), opsFindings: ops, newCodeHotspots: hot },
    {
      name: `${r.repo}-smith`, stack: r.stackFull || repoStack(r), lessons: adaptLessons(r.lessons || []), scannedAt: 'this run',
      commands: r.commands || [], boundaries: r.boundaries || [], entrypoints: r.entrypoints || [], architecture: r.architecture || [],
    }
  )
  const lines = f => (f.body.match(/\n/g) || []).length + 1
  const tree = built.files.map((f, i) => `<li data-fi="${i}"><span class="tf">${esc(f.path)}</span><span class="tl">${lines(f)}L</span></li>`).join('')
  const files = built.files.map((f, i) => `<details class="sf"${i === 0 ? ' open' : ''}><summary>${I.file}<span class="sfp">${esc(f.path)}</span><span class="sfl">${lines(f)} lines</span></summary><pre class="md-raw">${esc(f.body)}</pre><div class="md-rich">${mdToHtml(f.body)}</div></details>`).join('')
  return `<div class="skillfolder rich">
    <p class="explain">A Claude Code skill is a <b>folder</b>, not a file. <code>${esc(built.name)}/SKILL.md</code> is what Claude reads first, and it points straight at <code>references/architecture.md</code> — the project's map: what it is, its modules, data flow, and entrypoints. The other <code>references/</code> files cover real commands, do-not-touch boundaries, and operational risk; <code>memory.md</code> is the Self-Improvement Oracle's long-term memory. Every claim cites a file or says <b>unknown</b>.</p>
    <div class="tree"><div class="treehd">${I.repo}<b>${esc(built.name)}/</b>${stamp(built.files.length + ' FILES · FORGED')}<button type="button" class="md-toggle" aria-pressed="true">${I.file} raw markdown</button></div><ul>${tree}</ul></div>
    ${files}</div>`
}

function repoPage(r) {
  const full = repoFull(r), [org, name] = full.includes('/') ? full.split('/') : ['', full]
  const st = statusOf(r)
  const h = sevCount(r, 'high'), m = sevCount(r, 'medium'), l = sevCount(r, 'low')
  const leaks = r.nonCodeLeaks || [], hot = r.newCodeHotspots || []
  const fr = r.forensics
  const soSet = new Set((fr?.singleOwner || []).map(s => s.file))
  const oldCol = leaks.length ? `<ul>${leaks.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="empty">none recorded</p>'
  const hotRows = hot.map(x => ({ label: x.file.split('/').pop(), full: x.file, value: x.edits, danger: soSet.has(x.file) }))
  const newCol = hot.length ? barChart(hotRows) : '<p class="empty">churn unavailable</p>'
  const moduleRows = (fr?.modules || []).map(mo => ({ label: mo.module + '/', value: Math.round(mo.share * 100), danger: mo.share >= 0.8 }))
  const soRows = (fr?.singleOwner || []).map(s => ({ label: s.file.split('/').pop(), full: s.file, value: s.commits, danger: true }))
  const couplingRows = (fr?.coupling || []).map(c => ({ label: `${c.a.split('/').pop()} ↔ ${c.b.split('/').pop()}`, full: `${c.a} ↔ ${c.b}`, value: c.count }))
  const contribRows = (fr?.topContributors || []).map(t => ({ label: t.name, value: t.commits }))
  const sevRows = [{ label: 'High', value: h, danger: true }, { label: 'Medium', value: m }, { label: 'Low', value: l }].filter(x => x.value)
  const signals = [
    chart(I.layers, 'Architecture coverage', barChart(archCoverage(r.architecture))),
    fr?.busFactor ? chart(I.bus, 'Knowledge risk', busFactorBlock(fr)) : '',
    sevRows.length ? chart(I.high, 'Findings by severity', barChart(sevRows)) : '',
    soRows.length ? chart(I.file, 'Single-owner files', barChart(soRows)) : '',
    moduleRows.length ? chart(I.users, 'Module ownership', barChart(moduleRows, { unit: '%' })) : '',
    contribRows.length ? chart(I.users, 'Top contributors', barChart(contribRows)) : '',
    couplingRows.length ? chart(I.branch, 'Change coupling', barChart(couplingRows)) : '',
  ].filter(Boolean).join('')
  const msec = (ico, label, val) => `<span class="m">${I[ico] || ''}${label} <b>${esc(val)}</b></span>`
  const sevMeta = (h + m + l)
    ? `<span class="m sev">findings <span class="d dh"></span><b>${h}</b> <span class="d dm"></span><b>${m}</b> <span class="d dl"></span><b>${l}</b></span>`
    : `<span class="m">findings <b>${st === 'failed' ? '— scan failed' : '0 · clean'}</b></span>`
  const body = `${brandbar()}
  <header class="repo">
    <a class="back" href="index.html">${I.arrow} all scanned sites</a>
    <div class="repohead">${avatarImg(full, 'lg')}<div class="brand"><span class="org">${esc(org)}${org ? '/' : ''}</span>${esc(name)}</div></div>
    <p class="repoblurb">${esc(repoBlurb(r))}</p>
    <div class="metastrip">
      ${msec('branch', 'lang', repoStack(r))}
      <span class="m">${st === 'failed' ? I.high : st === 'clean' ? I.shield : I.scan}status <b>${st === 'failed' ? 'SIGNAL LOST' : st.toUpperCase()}</b></span>
      ${msec('branch', 'commits', (r.commits || 0).toLocaleString())}
      ${msec('cron', 'scan', (r.scanSeconds || 0) + 's')}
      ${r.cloneMB != null ? msec('package', 'clone', r.cloneMB + ' MB') : ''}
      ${sevMeta}
    </div>
  </header>
  <div class="sec" style="margin-top:1.5rem"><span class="chip">${I.file} The forge</span><h2>The skill it forged</h2><p class="sub">The whole artifact — every file Claude inherits. The findings live in the reference files, each cited to a real path.</p></div>
  ${skillPanel(r)}
  <div class="verdict ${st === 'failed' ? 'fail' : ''}">${stamp(st === 'failed' ? 'INCOMPLETE' : 'ORACLE PASS')}${esc(r.verdict || 'No verdict recorded.')}</div>
  ${signals ? `<div class="sec"><span class="chip">${I.eye} Signals</span><h2>What the scan measured</h2><p class="sub">Architecture coverage, knowledge risk, and ownership — read from the repo, not estimated.</p></div><div class="charts">${signals}</div>` : ''}
  <div class="sec"><span class="chip">${I.branch} Churn map</span><h2>Code-only fragility</h2><p class="sub">${leaks.length ? 'Old churn flagged docs and lockfiles. The new map counts source only.' : 'Most-changed source files. Docs, lockfiles, and generated files excluded. Single-owner hotspots are flagged.'}</p></div>
  ${leaks.length
      ? `<div class="churn"><div class="col old"><h4>Old churn — leaked non-code</h4>${oldCol}</div><div class="col new"><h4>New — code-only hotspots</h4>${newCol}</div></div>`
      : `<div class="col new">${newCol}</div>`}
  <footer><b>llama-smith</b> · ${esc(full)} · every claim cites a file</footer>`
  return shell(`llama-smith · ${full}`, body, FILES_JS)  // shell already includes RAIN
}

mkdirSync(outDir, { recursive: true })
if (HAS_HERO) copyFileSync(HERO_SRC, join(outDir, 'hero.webp'))
if (HAS_LOGO) copyFileSync(LOGO_SRC, join(outDir, 'logo.webp'))
writeFileSync(join(outDir, 'index.html'), indexPage())
for (const r of data) writeFileSync(join(outDir, `${r.repo}.html`), repoPage(r))
process.stdout.write('wrote ' + (data.length + 1) + ' pages\n')
