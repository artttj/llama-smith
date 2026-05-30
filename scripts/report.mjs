import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSkillFiles, adaptLessons } from '../lib/skill.mjs'
import { FRESH_DAYS, STALE_DAYS } from '../lib/freshness.mjs'

const LS = realpathSync(dirname(dirname(fileURLToPath(import.meta.url))))
const outDir = process.argv[3] || join(LS, 'reports')
let data = []

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
const repoFull = r => r.fullName || FULL[r.repo] || r.repo
const repoStack = r => r.stack || STACK[r.repo] || '?'
const readAsset = f => { const p = join(LS, 'assets', f); return existsSync(p) ? readFileSync(p, 'utf8').replace(/\n+$/, '') : '' }
export const safeName = s => String(s).replace(/[^a-zA-Z0-9._-]/g, '_')
const HERO_SRC = join(LS, 'assets', 'hero.webp')
const HAS_HERO = existsSync(HERO_SRC)
const HERO_DATA = HAS_HERO ? `data:image/webp;base64,${readFileSync(HERO_SRC).toString('base64')}` : ''

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

const EXT_ICON = '<svg class="ext-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'

const CSS = readAsset("dashboard-v2.css")  // editable in assets/dashboard-v2.css, inlined at build

const RAIN = `const c=document.getElementById('rain');
if(c&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const x=c.getContext('2d');let cols,d;
const g='\\uFF8A\\uFF90\\uFF8B\\uFF70\\uFF73\\uFF7C\\uFF85\\uFF93\\uFF86\\uFF7B\\uFF9C01<>{}/=;()[]'.split('');
function s(){c.width=innerWidth;c.height=innerHeight;cols=Math.floor(c.width/14);d=Array(cols).fill(0)}s();addEventListener('resize',s);
(function f(){x.fillStyle='rgba(7,13,9,0.09)';x.fillRect(0,0,c.width,c.height);x.fillStyle='#3ddc84';x.font='13px monospace';
for(let i=0;i<cols;i++){x.fillText(g[Math.floor(Math.random()*g.length)],i*14,d[i]*14);if(d[i]*14>c.height&&Math.random()>0.975)d[i]=0;d[i]++}
requestAnimationFrame(()=>setTimeout(f,55))})();}`

const AVATAR_JS = `document.querySelectorAll('img.face,img.avatar').forEach(function(g){function sw(){var s=document.createElement('span');s.className=g.className+' broken';s.textContent=g.dataset.initials||'';s.title=g.alt||'';g.replaceWith(s)}g.addEventListener('error',sw);if(g.complete&&g.naturalWidth===0)sw()});`
const COPY_JS = `document.querySelectorAll('.copy-skill').forEach(function(b){b.addEventListener('click',function(){navigator.clipboard.writeText(b.dataset.skill||'');var t=b.textContent;b.textContent='Copied!';setTimeout(function(){b.textContent=t},1500)})});`
const TECH_JS = `document.querySelectorAll('.tech-more').forEach(function(b){b.addEventListener('click',function(){var h=b.previousElementSibling;if(h&&h.classList.contains('tech-hidden'))h.style.display='contents';b.remove()})});`
const TRASH_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
const DELETE_JS = `document.querySelectorAll('.delete-report').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var repo=b.dataset.repo;if(!confirm('Delete the report for '+repo+'? The forged skill inside the repo is not affected.'))return;b.disabled=true;b.textContent='Deleting…';fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'llama-smith'},body:JSON.stringify({repo:repo})}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(){var c=b.closest('[data-report-card]');if(c){c.remove()}else{location.href='index.html'}}).catch(function(){b.disabled=false;b.textContent='Delete failed — retry'})})});`

const shell = (title, body, js = '') => `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="A model swarm turns a real repo into an operational Claude Code skill. The Oracle verifies every claim against its cited file.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Llama Smith">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="A model swarm turns a real repo into an operational Claude Code skill. The Oracle verifies every claim against its cited file.">
<meta property="og:image" content="https://artttj.de/llama-smith/og.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://artttj.de/llama-smith/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="A model swarm turns a real repo into an operational Claude Code skill.">
<meta name="twitter:image" content="https://artttj.de/llama-smith/og.png">
<link rel="preconnect" href="https://fonts.bunny.net" crossorigin>
<link rel="stylesheet" href="https://fonts.bunny.net/css?family=jetbrains-mono:400,500,600,700,800|ibm-plex-mono:400,500">
<style>${CSS}</style></head>
<body><canvas id="rain"></canvas><div class="wrap">${body}</div>
<script>${RAIN}${AVATAR_JS}${js}</script></body></html>`

const brandbar = () => `<header class="header">
  <a class="brand" href="index.html">
    Llama<span>·</span>Smith
  </a>
  <nav class="nav-actions">
    <a href="https://github.com/artttj/llama-smith" class="btn btn-sm btn-secondary" target="_blank" rel="noopener">GitHub</a>
    <a href="https://github.com/artttj/llama-smith#readme" class="btn btn-sm btn-secondary" target="_blank" rel="noopener">Docs</a>
  </nav>
</header>`
const siteFooter = () => `<footer class="footer">
  <span class="footer-main"><b>Llama Smith</b> — it does not summarize your repo. It forges operational memory from it.</span>
  <span class="footer-sub">MIT © Artem Iagovdik · icons by <a href="https://lucide.dev">Lucide</a> (ISC) · <a href="https://github.com/artttj/llama-smith">github.com/artttj/llama-smith</a></span>
</footer>`

const heroSection = () => {
  const heroImg = HAS_HERO ? `<img src="${HERO_DATA}" alt="llama-smith artifact" class="hero-image">` : ''
  return `<div class="hero">
    ${heroImg}
    <div class="hero-content">
      <h1 class="display-xl">Many <span class="hl">Smiths</span> enter.<br><span class="hl-bright">One skill</span> comes out.</h1>
      <p class="hero-trust">The <span class="hl">Oracle</span> verifies every claim.</p>
      <p class="hero-lede">A model swarm — cloud by default, local when you need it — that turns a real repo into an operational Claude Code skill.</p>
      <div class="hero-cmd"><span class="hero-cmd-prompt">&rsaquo;</span><span class="cmd-text">/llama-smith ./your-repo</span></div>
      <div class="hero-proof">
        <span class="proof-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Real repo scan
        </span>
        <span class="proof-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><polyline points="13 2 13 9 20 9"/></svg>
          File paths cited
        </span>
        <span class="proof-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Oracle validated
        </span>
      </div>
    </div>
  </div>
  <div class="pipeline">
    <div class="pipeline-step">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
      <span class="step-label">Scan repo</span>
      <span class="step-desc">Agents map architecture</span>
    </div>
    <div class="pipeline-step">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z"/><polyline points="14 2 14 9 20 9"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      <span class="step-label">Extract facts</span>
      <span class="step-desc">Every claim cites files</span>
    </div>
    <div class="pipeline-step">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.06 12.34a1.7 1.7 0 0 1 0-.68 10.94 10.94 0 0 1 19.88 0 1.7 1.7 0 0 1 0 .68 10.94 10.94 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>
      <span class="step-label">Oracle validates</span>
      <span class="step-desc">Hallucinations rejected</span>
    </div>
    <div class="pipeline-step">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 9 21 9"/><path d="m9 15 2 2 4-4"/></svg>
      <span class="step-label">Skill forged</span>
      <span class="step-desc">Claude-ready memory</span>
    </div>
  </div>`
}
const statusOf = r => r.opsSharpness === 'failed' ? 'failed' : r.opsSharpness === 'clean' || !(r.opsFindings || []).length ? 'clean' : 'sharp'

function repoBlurb(r, full = false) {
  const arch = r.architecture || []
  const overview = (arch.find(a => a.area === 'overview') || {}).claim
  const pick = overview || (arch.find(a => a.area === 'abstractions') || {}).claim || (arch.find(a => a.area === 'modules') || {}).claim || (arch.find(a => a.area === 'entrypoints') || {}).claim
  const manifest = String(r.blurb || '').trim()
  const h = sevCount(r, 'high'), m = sevCount(r, 'medium'), l = sevCount(r, 'low')
  const spine = String((manifest.length >= 40 ? manifest : (overview || manifest || pick)) || repoStack(r)).replace(/\s*\.\s*$/, '')
  if (statusOf(r) === 'failed') return `${spine}. The construct could not read it.`
  const counts = [h && `${h} high`, m && `${m} med`, l && `${l} low`].filter(Boolean).join(', ')
  if (!counts) return `${spine}. Clean scan — no operational risk found.`
  const top = (r.opsFindings || []).find(f => f.severity === 'high') || (r.opsFindings || []).find(f => f.severity === 'medium')
  const tx = top ? top.text.replace(/\s*\.?\s*$/, '') : ''
  const topTxt = tx ? ` Top risk: ${full || tx.length <= 150 ? tx : tx.slice(0, 150).replace(/\s+\S*$/, '') + '…'}.` : ''
  return `${spine}. ${counts} finding${(h + m + l) > 1 ? 's' : ''}.${topTxt}`
}

// Tile description: what the repo is. No findings or risk text — issues live on
// the detail page. The severity bar still shows the counts visually on the tile.
function repoCardDesc(r) {
  const arch = r.architecture || []
  const overview = (arch.find(a => a.area === 'overview') || {}).claim
  const manifest = String(r.blurb || '').trim()
  const desc = manifest.length >= 40 ? manifest : (overview || manifest || `${repoStack(r)} project`)
  return String(desc).replace(/\s*\.\s*$/, '') + '.'
}

const ownerOf = full => (full.includes('/') ? full.split('/')[0] : '')
const avatarImg = (full, cls = '') => {
  const o = ownerOf(full)
  return o ? `<img class="avatar ${cls}" src="https://github.com/${esc(o)}.png?size=80" width="80" height="80" loading="lazy" alt="${esc(o)} avatar" data-initials="${esc(o.slice(0, 2).toUpperCase())}">` : ''
}


const AREA_LABELS = { overview: 'Overview', modules: 'Modules', dataflow: 'Data flow', datamodel: 'Data model', entrypoints: 'Entrypoints', abstractions: 'Concepts' }

const chart = (icon, title, { bigNumber, subtitle, explanation, body, status, accent, href } = {}) => {
  if (!body) return ''
  const inner = `<div class="stat-cap"><span class="stat-cap-ico">${icon}</span>${esc(title)}${href ? '<span class="stat-jump">see all &darr;</span>' : ''}</div>
  ${bigNumber != null || status ? `<div class="stat-head">
    ${bigNumber != null ? `<span class="stat-num"${accent ? ` style="color:${accent}"` : ''}>${bigNumber}</span>` : ''}
    ${status ? `<span class="stat-chip" style="color:${status.color};border-color:${status.color}">${esc(status.label)}</span>` : ''}
    ${subtitle ? `<span class="stat-sub">${esc(subtitle)}</span>` : ''}
  </div>` : ''}
  ${explanation ? `<p class="stat-exp">${esc(explanation)}</p>` : ''}
  <div class="stat-body">${body}</div>`
  return href
    ? `<a class="panel stat-card stat-card-link" href="${esc(href)}">${inner}</a>`
    : `<div class="panel stat-card">${inner}</div>`
}

function vibeScore(r) {
  const h = sevCount(r, 'high'), m = sevCount(r, 'medium'), l = sevCount(r, 'low')
  const fr = r.forensics
  let s = 100 - (h * 12 + m * 5 + l * 2)
  if (fr && typeof fr.busFactor === 'number') {
    if (fr.busFactor <= 1) s -= 18
    else if (fr.busFactor === 2) s -= 10
    s -= Math.round((fr.singleOwnerRatio || 0) * 20)
  }
  s = Math.max(5, Math.min(100, s))
  const grade = s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 55 ? 'D' : 'F'
  const tier = s >= 80 ? 'low' : s >= 60 ? 'med' : 'high'
  return { score: s, grade, tier }
}


const TECH_BADGE = t => `<img class="techbadge" loading="lazy" height="24" alt="${esc(t.label)}" src="https://img.shields.io/badge/${encodeURIComponent(t.label)}-${t.color}?style=flat-square${t.slug ? `&logo=${t.slug}&logoColor=white` : ''}">`

function barChart(rows, { unit = '' } = {}) {
  if (!rows.length) return ''
  const max = Math.max(...rows.map(r => r.value), 1)
  const row = r => {
    const fillClass = r.danger ? 'barchart-fill-danger' : 'barchart-fill'
    return `<div class="barchart-row${r.danger ? ' danger' : ''}">
      <span class="barchart-label" title="${esc(r.full || r.label)}">${esc(r.label)}</span>
      <span class="barchart-track"><span class="${fillClass}" style="width:${Math.max(3, Math.round(r.value / max * 100))}%"></span></span>
      <span class="barchart-value">${r.value.toLocaleString()}${unit}${r.danger ? ' ⚠️' : ''}</span>
    </div>`
  }
  return `<div class="barchart" role="img" aria-label="bar chart">${rows.map(row).join('')}</div>`
}

const shortPath = f => f.split('/').slice(-2).join('/')
const baseName = f => String(f).split('/').pop()

// One color scale so color means the same thing on every forensic card.
const CONCERN = { critical: 'var(--red)', high: 'oklch(68% 0.2 40)', watch: 'var(--amber)', healthy: 'var(--green-brand)', neutral: 'var(--cyan)' }
const concernByPct = p => p >= 80 ? 'critical' : p >= 60 ? 'high' : p >= 40 ? 'watch' : 'healthy'


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
  const busRows = data.filter(r => r.forensics && 'busFactor' in r.forensics).map(r => ({ label: shortName(r), value: r.forensics.busFactor, danger: r.forensics.busFactor <= 2 })).sort((a, b) => a.value - b.value)
  const allTop = {}
  for (const r of data) for (const c of (r.forensics?.topContributors || [])) { const key = c.login || c.name; if (!allTop[key]) allTop[key] = { name: c.name, commits: 0 }; allTop[key].commits += c.commits }
  const contribRows = Object.values(allTop).sort((a, b) => b.commits - a.commits).slice(0, 8).map(c => ({ label: c.name, value: c.commits }))
  const GRADE_COLORS = { A: 'var(--green-brand)', B: 'var(--cyan)', C: 'var(--amber)', D: 'oklch(65% 0.2 45)', F: 'var(--red)' }
  const gradeCounts = {}
  for (const r of data) { const g = vibeScore(r).grade; gradeCounts[g] = (gradeCounts[g] || 0) + 1 }
  const gradeSegs = ['A', 'B', 'C', 'D', 'F'].filter(g => gradeCounts[g]).map(g => ({ value: gradeCounts[g], color: GRADE_COLORS[g], label: `Grade ${g}` }))
  const STACK_PALETTE = ['var(--green-brand)', 'var(--cyan)', 'var(--amber)', 'oklch(70% 0.16 305)', 'oklch(70% 0.16 350)', 'var(--red)', 'oklch(70% 0.12 230)']
  const stackCounts = {}
  for (const r of data) { const s = (repoStack(r).split('·')[0] || '?').trim() || '?'; stackCounts[s] = (stackCounts[s] || 0) + 1 }
  const stackSegs = Object.entries(stackCounts).sort((a, b) => b[1] - a[1]).map(([s, n], i) => ({ value: n, color: STACK_PALETTE[i % STACK_PALETTE.length], label: s }))
  const charts = [
    chart(I.shield, 'Grade distribution', { body: donut(gradeSegs, { center: data.length, sub: 'repos' }) }),
    chart(I.package, 'Stack distribution', { body: donut(stackSegs, { center: data.length, sub: 'repos' }) }),
    chart(I.scan, 'Findings by Smith', { body: barChart(findingRows) }),
    chart(I.layers, 'Architecture facts per repo', { body: barChart(archRows) }),
    busRows.length ? chart(I.bus, 'Bus factor by repo', { body: barChart(busRows) }) : '',
    contribRows.length ? chart(I.users, 'Top contributors across corpus', { body: barChart(contribRows) }) : '',
  ].filter(Boolean).join('')
  if (!charts) return ''
  return `<section class="section">
    <div class="section-header">
      <span class="section-title">Corpus Scan</span>
      <h2 class="display" style="margin-top:0.5rem">Readings across ${data.length} repos</h2>
      <p class="body" style="margin-top:0.75rem;max-width:50ch">Aggregate facts from every scan — findings by Smith, how much architecture each map captured, and where knowledge concentrates.</p>
    </div>
    <div class="grid charts">${charts}</div>
  </section>`
}


function card(r) {
  const full = repoFull(r), [org, name] = full.includes('/') ? full.split('/') : ['', full]
  const st = statusOf(r)
  const grade = vibeScore(r)
  const gradeClass = `badge-grade-${grade.grade.toLowerCase()}`
  const h = sevCount(r, 'high'), m = sevCount(r, 'medium'), l = sevCount(r, 'low'), tot = Math.max(h + m + l, 1)
  const hPct = tot ? Math.round((h / tot) * 100) : 0
  const mPct = tot ? Math.round((m / tot) * 100) : 0
  const lPct = tot ? Math.round((l / tot) * 100) : 0

  const sev = (h + m + l) ? `
    <div class="sevbar" style="margin:1rem 0">
      <div class="sevbar-track">
        ${h ? `<span class="sevbar-seg sevbar-seg-high" style="width:${hPct}%"></span>` : ''}
        ${m ? `<span class="sevbar-seg sevbar-seg-medium" style="width:${mPct}%"></span>` : ''}
        ${l ? `<span class="sevbar-seg sevbar-seg-low" style="width:${lPct}%"></span>` : ''}
      </div>
      <div class="sevbar-legend">
        ${h ? `<span class="sevbar-item"><span class="sevbar-dot sevbar-dot-high"></span>High <b>${h}</b></span>` : ''}
        ${m ? `<span class="sevbar-item"><span class="sevbar-dot sevbar-dot-medium"></span>Med <b>${m}</b></span>` : ''}
        ${l ? `<span class="sevbar-item"><span class="sevbar-dot sevbar-dot-low"></span>Low <b>${l}</b></span>` : ''}
      </div>
    </div>`
    : `<div style="margin:1rem 0;font-size:0.85rem;color:var(--text-muted)">No findings — clean scan</div>`

  return `<div class="panel panel-interactive" data-report-card style="position:relative;display:flex;flex-direction:column">
    <a href="${safeName(r.repo)}.html" aria-label="Open ${esc(full)} report" style="position:absolute;inset:0;z-index:1;border-radius:inherit"></a>
    <button class="delete-report card-delete" data-repo="${esc(r.repo)}" title="Delete report" aria-label="Delete ${esc(full)} report">${TRASH_SVG}</button>
    <div style="position:relative;z-index:0;display:flex;flex-direction:column;flex:1;color:inherit">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:0.75rem">
        <div style="display:flex;align-items:center;gap:0.75rem;min-width:0">
          ${avatarImg(full)}
          <div style="min-width:0">
            <div style="font-size:1.15rem;font-weight:700;color:var(--green-hot);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${esc(org)}<span style="color:var(--text-muted)">/</span>${esc(name)}
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.15rem">
              ${esc(repoStack(r))}${r.commits ? ` · ${r.commits.toLocaleString()} commits` : ''}
            </div>
          </div>
        </div>
        <span class="badge badge-grade ${gradeClass}">${grade.score} ${grade.grade}</span>
      </div>
      <div class="card-desc">
        ${esc(repoCardDesc(r))}
      </div>
      ${sev}
      <div style="display:flex;align-items:center;gap:0.5rem;margin-top:auto;padding-top:1rem;font-size:0.8rem;color:var(--green-brand)">
        Open report →
      </div>
    </div>
  </div>`
}

// Value block on the landing page: why the output is trustworthy, not just how
// the pipeline runs. Reuses real dashboard components so it previews the product.
function proofBlock() {
  const finding = `<div class="evidence evidence-high" style="margin-top:1rem">
    <span class="evidence-rail"></span>
    <div class="evidence-body">
      <div class="evidence-header">
        <span class="badge badge-high">High</span>
        <span class="meta">deploy</span>
        <span class="path-chip">.github/workflows/release.yml</span>
        <span class="proof-validated">${I.shield} Oracle validated</span>
      </div>
      <div class="evidence-text">Publishes on any tag with no approval gate and no rollback step.</div>
    </div>
  </div>`
  const GRADES = [['A', 'healthy'], ['B', 'healthy'], ['C', 'watch'], ['D', 'critical'], ['F', 'critical']]
  const scale = GRADES.map(([g, c]) => `<span class="grade-chip" style="color:${CONCERN[c]};border-color:${CONCERN[c]}">${g}</span>`).join('')
  const tags = ['bus factor', 'single-owner files', 'churn hotspots', 'module ownership', 'change coupling']
    .map(t => `<span class="forensic-tag">${esc(t)}</span>`).join('')
  return `<section class="section">
    <div class="section-header">
      <span class="section-title">Forensic, not generative</span>
      <h2 class="display" style="margin-top:0.5rem">It proves what it finds</h2>
      <p class="body" style="margin-top:0.75rem;max-width:58ch">Most tools summarize your code and stop. Llama Smith reads how the project actually deploys and where it leaks, cites every claim to a file, then scores the risk.</p>
    </div>
    <div class="proof-grid">
      <div class="panel proof-card">
        <div class="proof-head"><span class="proof-ico">${I.eye}</span>Cited and validated</div>
        <p class="proof-text">Every finding points at a real file. The Oracle re-reads each claim against that file and drops anything it cannot back up. No file, no finding.</p>
        ${finding}
      </div>
      <div class="panel proof-card">
        <div class="proof-head"><span class="proof-ico">${I.shield}</span>Quality score</div>
        <div class="grade-scale">${scale}</div>
        <p class="proof-text">Each repo gets an A to F grade from its validated findings and how concentrated the code ownership is, measured by bus factor and single-owner files.</p>
      </div>
      <div class="panel proof-card">
        <div class="proof-head"><span class="proof-ico">${I.zap}</span>Self-learning memory</div>
        <div class="forensic-tags">
          <span class="forensic-tag">/llama-smith-lesson</span>
          <span class="forensic-tag">memory.md</span>
          <span class="forensic-tag">per repo</span>
        </div>
        <p class="proof-text">Correct the skill once and the lesson folds into its memory.md on the next run, at high confidence. Lessons stay per repo, so one project's fixes never leak into another.</p>
      </div>
      <div class="panel proof-card">
        <div class="proof-head"><span class="proof-ico">${I.bus}</span>Git forensics</div>
        <div class="forensic-tags">${tags}</div>
        <p class="proof-text">Bus factor, single-owner files, churn hotspots, ownership and coupling, read straight from git history. Never guessed.</p>
      </div>
    </div>
  </section>`
}

function indexPage() {
  const famous = data.filter(r => r.group !== 'wild' && r.group !== 'boring')
  const wild = data.filter(r => r.group === 'wild' || r.group === 'boring')

  const body = `${brandbar()}
${heroSection()}
${proofBlock()}
<section class="section">
  <div class="section-header">
    <span class="section-title">Scanned Repositories</span>
    <h2 class="display" style="margin-top:0.5rem">${famous.length + wild.length} Repos Analyzed</h2>
  </div>
  <div class="grid">${famous.map(card).join('')}</div>
  ${wild.length ? `
  <div class="section-header" style="margin-top:3rem">
    <span class="section-title">In the Wild</span>
    <h2 class="display" style="margin-top:0.5rem">Random Low-Star Repos</h2>
    <p class="body" style="margin-top:0.5rem">Does it stay honest when there's little to find?</p>
  </div>
  <div class="grid">${wild.map(card).join('')}</div>` : ''}
</section>
${siteFooter()}`
  return shell('Llama Smith · turns a real repo into a Claude Code skill', body, DELETE_JS)
}

function skillPanel(r) {
  const ops = r.opsFindings || [], hot = r.newCodeHotspots || []
  if (!ops.length && !hot.length && !(r.architecture || []).length && !(r.commands || []).length) {
    return `<div class="panel">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem">
        ${I.file}
        <span class="badge badge-grade badge-grade-f">NOT FORGED</span>
      </div>
      <p style="font-size:0.9rem;color:var(--text-muted)">Nothing to forge — the swarm found no operational risk and no churn worth recording. Skip, don't stub.</p>
    </div>`
  }
  const built = buildSkillFiles(
    { repo: r.repo, fullName: repoFull(r), opsFindings: ops, newCodeHotspots: hot },
    {
      name: `${r.repo}-smith`, stack: r.stackFull || repoStack(r), lessons: adaptLessons(r.lessons || []), scannedAt: 'this run',
      commands: r.commands || [], boundaries: r.boundaries || [], entrypoints: r.entrypoints || [], architecture: r.architecture || [], forensics: r.forensics || null,
    }
  )
  const lines = f => (f.body.match(/\n/g) || []).length + 1

  const fileDesc = {
    'SKILL.md': 'Entry point — what to read first',
    'CLAUDE.md': 'Primary instructions for Claude Code',
    'AGENTS.md': 'Cross-tool map for Cursor, opencode, Codex',
    'memory.md': 'Self-learning memory — grows as you correct it',
    'project-memory.md': 'Self-learning memory anchor',
    'architecture.md': 'Modules, data flow, and data model',
    'deploy.md': 'Deploy and rollback risk',
    'jobs.md': 'Scheduled jobs and cron',
    'secrets.md': 'Secret handling and exposure',
    'operations.md': 'Deploy, secrets, and runtime risk',
    'risks.md': 'Known vulnerabilities and fragile spots',
    'fragility.md': 'Churn hotspots, single-owner flagged',
    'forensics.md': 'Bus factor, ownership, module map',
    'commands.md': 'Real build, test, and deploy commands',
    'boundaries.md': 'Files an agent must not hand-edit',
  }

  const groupOf = name => {
    if (/^(SKILL|CLAUDE|AGENTS)\.md$/.test(name) || /memory\.md$/.test(name)) return 'Core artifact'
    if (/architecture\.md$/.test(name)) return 'Architecture'
    if (/(risks|fragility|forensics|secrets)\.md$/.test(name)) return 'Risk & forensics'
    if (/(deploy|jobs|commands|boundaries|operations)\.md$/.test(name)) return 'Operations'
    return 'References'
  }
  const GROUP_ORDER = ['Core artifact', 'Architecture', 'Risk & forensics', 'Operations', 'References']

  const fileRow = f => {
    const desc = fileDesc[f.path.split('/').pop()] || 'Generated skill component'
    return `<details class="artifact-file">
      <summary>
        <span class="artifact-file-main">
          <span class="artifact-file-name">${esc(f.path)}</span>
          <span class="artifact-file-desc">${esc(desc)}</span>
        </span>
        <span class="artifact-file-lines">${lines(f)} lines</span>
        <span class="badge badge-grade badge-grade-a artifact-file-badge">forged</span>
      </summary>
      <pre class="artifact-file-pre"><code>${esc(f.body)}</code></pre>
    </details>`
  }

  const byGroup = {}
  for (const f of built.files) { const g = groupOf(f.path.split('/').pop()); (byGroup[g] || (byGroup[g] = [])).push(f) }
  const groupedFiles = GROUP_ORDER.filter(g => byGroup[g]).map(g =>
    `<div class="artifact-group">
      <div class="artifact-group-label">${esc(g)}</div>
      ${byGroup[g].map(fileRow).join('')}
    </div>`).join('')

  const totalLines = built.files.reduce((sum, f) => sum + lines(f), 0)
  const repoName = repoFull(r)
  const h = sevCount(r, 'high'), m = sevCount(r, 'medium'), l = sevCount(r, 'low')
  const findings = h + m + l
  const archFacts = archCoverage(r.architecture).reduce((s, a) => s + a.value, 0)

  const inside = [
    ['Architecture facts', archFacts],
    ['Entrypoints', (r.entrypoints || []).length],
    ['Commands', (r.commands || []).length],
    ['Boundaries', (r.boundaries || []).length],
  ].filter(([, v]) => v > 0)
  const insideRows = inside.map(([label, v]) => `<div class="artifact-inside-row"><span>${label}</span><b>${v}</b></div>`).join('')

  const statBox = (value, label, color) => `<div class="artifact-stat"><div class="artifact-stat-value" style="color:${color}">${value}</div><div class="artifact-stat-label">${label}</div></div>`

  return `<div class="artifact-grid">
    <div class="panel artifact-meta">
      <div class="artifact-cap"><span class="artifact-cap-ico" style="color:var(--green-brand)">${I.repo}</span><span>Artifact summary</span></div>
      <div class="artifact-name">${esc(built.name)}/</div>

      <div class="artifact-stats">
        ${statBox(built.files.length, 'Files', 'var(--green-brand)')}
        ${statBox(totalLines.toLocaleString(), 'Lines', 'var(--cyan)')}
        ${statBox(findings, 'Findings', findings ? 'var(--amber)' : 'var(--text-muted)')}
      </div>

      ${insideRows ? `<div class="artifact-inside">${insideRows}</div>` : ''}

      <div class="artifact-status">
        <div class="artifact-status-row"><span class="dot" style="background:var(--green-brand)"></span><span><b>Oracle validated</b> — every claim checked against its file</span></div>
        <div class="artifact-status-row"><span class="dot" style="background:var(--amber)"></span><span><b>Self-learning memory</b> — folds in your corrections each run</span></div>
      </div>

      <div class="artifact-actions">
        <button class="btn btn-primary copy-skill" data-skill="${esc(built.name)}">Copy skill name</button>
        <a class="btn btn-secondary" href="https://github.com/${esc(repoName)}" target="_blank" rel="noopener">View repo</a>
      </div>
    </div>

    <div class="panel artifact-files">
      <div class="artifact-cap"><span class="artifact-cap-ico" style="color:var(--cyan)">${I.file}</span><span>Generated files</span><span class="artifact-files-hint">Click any file to preview</span></div>
      <div class="artifact-groups">${groupedFiles}</div>
    </div>
  </div>`
}

function donut(segments, { center, sub } = {}) {
  const sum = segments.reduce((s, x) => s + x.value, 0) || 1
  let acc = 0
  const stops = segments.map(s => {
    const from = (acc / sum) * 100
    acc += s.value
    return `${s.color} ${from}% ${(acc / sum) * 100}%`
  }).join(', ')
  const legend = segments.filter(s => s.value > 0).map(s =>
    `<span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;color:var(--text-secondary)"><span style="width:8px;height:8px;border-radius:2px;background:${s.color};flex-shrink:0"></span>${esc(s.label)} <b style="color:var(--text-primary)">${s.value}</b></span>`
  ).join('')
  return `<div style="display:flex;align-items:center;gap:1rem;margin-top:0.75rem">
    <div style="position:relative;width:88px;height:88px;flex-shrink:0;border-radius:50%;background:conic-gradient(${stops})" role="img" aria-label="donut chart">
      <div style="position:absolute;inset:14px;border-radius:50%;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1">
        <span style="font-size:1.1rem;font-weight:800;font-family:var(--font-mono);color:var(--text-primary)">${center != null ? center : sum}</span>
        ${sub ? `<span style="font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-top:2px">${esc(sub)}</span>` : ''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:0.4rem">${legend}</div>
  </div>`
}

// Segmented horizontal bar — proportions read faster than a donut for 2-3 parts.
// Reuses the .sevbar component that the index cards already ship.
function segbar(segments, { unit = '' } = {}) {
  const shown = segments.filter(s => s.value > 0)
  const sum = shown.reduce((s, x) => s + x.value, 0) || 1
  const track = shown.map(s => `<span class="sevbar-seg" style="background:${s.color};width:${(s.value / sum) * 100}%"></span>`).join('')
  const legend = shown.map(s => `<span class="sevbar-item"><span class="sevbar-dot" style="background:${s.color}"></span>${esc(s.label)} <b>${s.value.toLocaleString()}${unit}</b></span>`).join('')
  return `<div class="sevbar" style="margin-top:0.75rem" role="img" aria-label="segmented bar"><div class="sevbar-track">${track}</div><div class="sevbar-legend">${legend}</div></div>`
}

// One ranked row shared by hotspots, modules, contributors, coupling — keeps
// them visually comparable and on the shared CONCERN color scale.
const frow = ({ label, full, fill, width, val, tag, tagColor, avatar }) => `<div class="frow">
  ${avatar || ''}
  <span class="frow-label"${full ? ` title="${esc(full)}"` : ''}>${esc(label)}</span>
  <span class="frow-track"><span class="frow-fill" style="width:${Math.max(3, width)}%;background:${fill}"></span></span>
  <span class="frow-val">${val}</span>
  ${tag ? `<span class="frow-tag" style="color:${tagColor}">${esc(tag)}</span>` : ''}
</div>`

const healthRow = (label, value, color) => `<div class="health-row"><span>${esc(label)}</span><b${color ? ` style="color:${color}"` : ''}>${esc(value)}</b></div>`

function repoSignals(r, h, m, l, fr) {
  const hot = r.newCodeHotspots || []
  const soSet = new Set((fr?.singleOwner || []).map(s => s.file))
  const totFindings = h + m + l
  const so = fr?.singleOwner?.length || 0
  const codeN = fr?.codeFiles || 0
  const arch = r.architecture || []

  const cited = (r.opsFindings || []).filter(f => f.file && f.file !== 'unknown').length + arch.filter(a => a.file && a.file !== 'unknown').length
  const claims = (r.opsFindings || []).length + arch.length
  const cov = claims ? Math.round((cited / claims) * 100) : 100
  const covColor = cov >= 90 ? CONCERN.healthy : cov >= 70 ? CONCERN.watch : CONCERN.critical
  const archFacts = archCoverage(arch).reduce((s, a) => s + a.value, 0)

  const cards = []

  // 1. Repo health — the lead summary, not a lone bus-factor number.
  const grade = vibeScore(r)
  const gColor = grade.tier === 'low' ? CONCERN.healthy : grade.tier === 'high' ? CONCERN.critical : CONCERN.watch
  const healthSentence = grade.tier === 'low' ? 'Low operational risk — well grounded and broadly owned.'
    : grade.tier === 'high' ? 'Elevated risk — concentrated ownership or unresolved findings.'
    : 'Moderate risk — some concentration or findings to watch.'
  const healthRows = [
    totFindings ? healthRow('Findings', `${h}H · ${m}M · ${l}L`, h ? CONCERN.critical : CONCERN.watch) : healthRow('Findings', 'none', CONCERN.healthy),
    fr && 'busFactor' in fr ? healthRow('Bus factor', String(fr.busFactor), fr.busFactor <= 1 ? CONCERN.critical : fr.busFactor <= 2 ? CONCERN.watch : CONCERN.healthy) : '',
    healthRow('Citation coverage', `${cov}%`, covColor),
    archFacts ? healthRow('Architecture facts', String(archFacts), CONCERN.neutral) : '',
  ].filter(Boolean).join('')
  cards.push(chart(I.shield, 'Repo health', {
    bigNumber: grade.score, accent: gColor, subtitle: '/ 100',
    status: { label: `Grade ${grade.grade}`, color: gColor },
    explanation: healthSentence,
    body: `<div class="health-list">${healthRows}</div>`,
  }))

  if (totFindings > 0) {
    const severityBar = segbar([
      { value: h, color: CONCERN.critical, label: 'High' },
      { value: m, color: CONCERN.watch, label: 'Medium' },
      { value: l, color: CONCERN.healthy, label: 'Low' },
    ])
    cards.push(chart(I.high, 'Findings by severity', {
      bigNumber: `${totFindings}`, subtitle: 'total findings',
      status: h ? { label: `${h} high`, color: CONCERN.critical } : { label: 'no critical', color: CONCERN.healthy },
      explanation: h > 0 ? `${h} high-priority issue${h > 1 ? 's' : ''} need review.` : `${totFindings} findings, none critical.`,
      body: severityBar,
      href: '#findings',
    }))
  }

  if (codeN > 0) {
    const sharedFiles = Math.max(0, codeN - so)
    const soPct = Math.round((so / codeN) * 100)
    cards.push(chart(I.users, 'Ownership concentration', {
      bigNumber: `${codeN}`, subtitle: 'code files',
      status: so > 10 ? { label: 'watch', color: CONCERN.watch } : { label: 'healthy', color: CONCERN.healthy },
      explanation: so > 10 ? `${so} files (${soPct}%) have a single owner.` : so > 0 ? `${so} single-owner files — low concentration.` : 'Ownership well distributed.',
      body: segbar([
        { value: so, color: CONCERN.watch, label: 'Single-owner' },
        { value: sharedFiles, color: CONCERN.healthy, label: 'Shared' },
      ]),
    }))
  }

  const archRows = archCoverage(arch)
  if (archRows.length > 0) {
    const maxArch = Math.max(...archRows.map(x => x.value))
    const archBars = archRows.slice(0, 6).map(a => frow({ label: a.label, fill: CONCERN.neutral, width: Math.round((a.value / maxArch) * 100), val: a.value })).join('')
    cards.push(chart(I.layers, 'Architecture map coverage', {
      bigNumber: `${archFacts}`, subtitle: 'facts captured',
      status: { label: `${archRows.length}/6 dims`, color: CONCERN.neutral },
      explanation: `${archFacts} facts across ${archRows.length} of 6 architecture dimensions.`,
      body: `<div class="stat-rows">${archBars}</div>`,
    }))
  }

  if (fr && 'busFactor' in fr) {
    const rmap = { CRITICAL: 'critical', HIGH: 'high', MODERATE: 'watch', GOOD: 'healthy' }
    const ck = rmap[fr.risk] || 'neutral'
    const peopleRows = [
      fr.keyPeople?.length ? healthRow('Hold most code', `${fr.keyPeople.slice(0, 2).map(p => p.name).join(', ')}${fr.keyPeople.length > 2 ? ` +${fr.keyPeople.length - 2}` : ''}`, CONCERN[ck]) : '',
      fr.contributors ? healthRow('Contributors', fr.contributors.toLocaleString(), CONCERN.neutral) : '',
    ].filter(Boolean).join('')
    cards.push(chart(I.bus, 'Ownership risk', {
      bigNumber: `${fr.busFactor}`, subtitle: 'bus factor',
      status: { label: fr.risk, color: CONCERN[ck] },
      explanation: fr.risk === 'CRITICAL' ? 'Critical knowledge concentration.' : fr.risk === 'GOOD' ? 'Knowledge well distributed.' : 'Elevated knowledge risk.',
      body: `<div class="health-list">${peopleRows || healthRow('Single-owner files', String(so), so ? CONCERN.watch : CONCERN.healthy)}</div>`,
    }))
  }

  if (hot.length > 0) {
    const maxEdits = Math.max(...hot.map(x => x.edits))
    const risky = hot.filter(x => soSet.has(x.file)).length
    const hotBars = hot.slice(0, 5).map(x => {
      const isRisky = soSet.has(x.file)
      return frow({ label: shortPath(x.file), full: x.file, fill: isRisky ? CONCERN.critical : CONCERN.watch, width: Math.round((x.edits / maxEdits) * 100), val: x.edits, tag: isRisky ? 'single-owner' : '', tagColor: CONCERN.critical })
    }).join('')
    cards.push(chart(I.bug, 'Highest churn hotspots', {
      bigNumber: `${hot.length}`, subtitle: 'hot files',
      status: risky ? { label: `${risky} single-owner`, color: CONCERN.critical } : { label: 'shared', color: CONCERN.healthy },
      explanation: 'Files with the most edits over the last year.',
      body: `<div class="stat-rows">${hotBars}</div>`,
    }))
  }

  const moduleRows = (fr?.modules || []).map(mo => ({ label: mo.module + '/', value: Math.round(mo.share * 100) }))
  if (moduleRows.length > 0) {
    const modBars = moduleRows.slice(0, 5).map(mo => {
      const ck = concernByPct(mo.value)
      return frow({ label: mo.label, fill: CONCERN[ck], width: mo.value, val: `${mo.value}%`, tag: ck, tagColor: CONCERN[ck] })
    }).join('')
    const critical = moduleRows.filter(mo => mo.value >= 80).length
    cards.push(chart(I.layers, 'Ownership by module', {
      bigNumber: `${moduleRows.length}`, subtitle: 'modules',
      status: critical ? { label: `${critical} critical`, color: CONCERN.critical } : { label: 'distributed', color: CONCERN.healthy },
      explanation: critical > 0 ? `${critical} module${critical > 1 ? 's' : ''} above 80% single-owner concentration.` : 'Module ownership well distributed.',
      body: `<div class="stat-rows">${modBars}</div>`,
    }))
  }

  const contribRows = (fr?.topContributors || []).map(t => ({ label: t.name, value: t.commits, login: t.login }))
  if (contribRows.length > 0) {
    const maxCommits = Math.max(...contribRows.map(c => c.value))
    const contribBars = contribRows.slice(0, 5).map(c => {
      const avatar = c.login
        ? `<img class="frow-avatar" src="https://github.com/${esc(c.login)}.png?size=48" width="28" height="28" loading="lazy" alt="${esc(c.label)}">`
        : `<span class="frow-avatar frow-avatar-fallback">${esc((c.label || '').slice(0, 2).toUpperCase())}</span>`
      return frow({ avatar, label: c.label, fill: CONCERN.neutral, width: Math.round((c.value / maxCommits) * 100), val: c.value.toLocaleString() })
    }).join('')
    const totalContribs = contribRows.reduce((sum, c) => sum + c.value, 0)
    const allContribs = fr.contributors || contribRows.length
    cards.push(chart(I.users, 'Top contributors', {
      explanation: `${totalContribs.toLocaleString()} commits from the top ${contribRows.length}${allContribs > contribRows.length ? ` of ${allContribs.toLocaleString()}` : ''} contributors.`,
      body: `<div class="stat-rows stat-rows-lg">${contribBars}</div>`,
    }))
  }

  const couplingRows = (fr?.coupling || []).map(c => ({ label: `${baseName(c.a)} ↔ ${baseName(c.b)}`, full: `${c.a} ↔ ${c.b}`, value: c.count }))
  if (couplingRows.length > 0) {
    const maxCount = Math.max(...couplingRows.map(c => c.value))
    const couplingBars = couplingRows.slice(0, 5).map(c => frow({ label: c.label, full: c.full, fill: CONCERN.watch, width: Math.round((c.value / maxCount) * 100), val: c.value })).join('')
    cards.push(chart(I.branch, 'Change coupling', {
      bigNumber: `${couplingRows.length}`, subtitle: 'coupled pairs',
      explanation: 'Files that change together most often.',
      body: `<div class="stat-rows">${couplingBars}</div>`,
    }))
  }

  // Last card anchors the right edge so the grid never trails into empty black.
  cards.push(chart(I.eye, 'Oracle verdict', {
    status: { label: 'validated', color: CONCERN.healthy },
    explanation: r.verdict || 'Every surviving claim was re-read against the file it cites; uncited claims were dropped.',
    body: `<div class="health-list">
      ${healthRow('Claims cited', `${cited} / ${claims}`, CONCERN.healthy)}
      ${healthRow('Citation coverage', `${cov}%`, covColor)}
      ${healthRow('Uncited or unknown', String(claims - cited), claims - cited ? CONCERN.watch : CONCERN.healthy)}
    </div>`,
  }))

  return cards.join('')
}

// The actual operational issues, not just a count — severity rail, finding text, cited file.
function findingsList(r) {
  const RANK = { high: 0, medium: 1, low: 2 }
  const SEV = { high: 'High', medium: 'Medium', low: 'Low' }
  const ops = (r.opsFindings || []).slice().sort((a, b) => (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3))
  if (!ops.length) return ''
  const rows = ops.map(f => {
    const sev = f.severity || 'low'
    const file = f.file && f.file !== 'unknown' ? f.file : ''
    return `<div class="evidence evidence-${esc(sev)}">
      <span class="evidence-rail"></span>
      <div class="evidence-body">
        <div class="evidence-header">
          <span class="badge badge-${esc(sev)}">${esc(SEV[sev] || sev)}</span>
          ${f.smith ? `<span class="meta">${esc(f.smith)}</span>` : ''}
          ${file ? `<span class="path-chip">${esc(file)}</span>` : `<span class="meta">unknown location</span>`}
        </div>
        <div class="evidence-text">${esc(f.text || '')}</div>
      </div>
    </div>`
  }).join('')
  return `<div style="display:flex;flex-direction:column;gap:0.75rem">${rows}</div>`
}

function repoPage(r) {
  const full = repoFull(r), [org, name] = full.includes('/') ? full.split('/') : ['', full]
  const st = statusOf(r)
  const h = sevCount(r, 'high'), m = sevCount(r, 'medium'), l = sevCount(r, 'low')
  const fr = r.forensics
  const signals = repoSignals(r, h, m, l, fr)
  const archFacts = archCoverage(r.architecture).reduce((s, a) => s + a.value, 0)
  const hotN = (r.newCodeHotspots || []).length
  const soN = fr?.singleOwner?.length || 0
  const evPills = [
    (h + m + l) ? `<span class="ev-pill"><b style="color:var(--red)">${h}</b> high · <b style="color:var(--amber)">${m}</b> med · <b style="color:var(--green-brand)">${l}</b> low</span>` : '',
    fr && 'busFactor' in fr ? `<span class="ev-pill">bus factor <b>${fr.busFactor}</b></span>` : '',
    fr?.codeFiles ? `<span class="ev-pill"><b>${fr.codeFiles}</b> files${soN ? ` · <b>${soN}</b> single-owner` : ''}</span>` : '',
    archFacts ? `<span class="ev-pill"><b>${archFacts}</b> architecture facts</span>` : '',
    hotN ? `<span class="ev-pill"><b>${hotN}</b> hot files</span>` : '',
  ].filter(Boolean).join('')

  const grade = vibeScore(r)
  const gradeClass = `badge-grade-${grade.grade.toLowerCase()}`
  const gradeColor = grade.grade === 'A' ? 'var(--green-brand)' : (grade.grade === 'D' || grade.grade === 'F') ? 'var(--red)' : 'var(--amber)'

  const allTech = r.tech || []
  const visibleTech = allTech.slice(0, 4)
  const hiddenTech = allTech.slice(4)
  const techBadgesLimited = visibleTech.map(TECH_BADGE).join('')
    + (hiddenTech.length ? `<span class="tech-hidden" style="display:none">${hiddenTech.map(TECH_BADGE).join('')}</span><button type="button" class="tech-more" style="padding:0.2rem 0.5rem;background:var(--surface);border:1px solid var(--line);border-radius:4px;font-size:0.75rem;color:var(--text-muted);cursor:pointer">+${hiddenTech.length} more</button>` : '')

  const body = `${brandbar()}
<section class="section" style="padding-top:1rem">
  <div style="margin-bottom:1.25rem">
    <a class="btn btn-ghost" href="index.html" style="font-size:0.85rem">← All Repositories</a>
  </div>

  <div class="panel" style="padding:1.5rem">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1.5rem;flex-wrap:wrap">
      <div style="display:flex;align-items:flex-start;gap:1rem;min-width:0;flex:1">
        ${avatarImg(full)}
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:0.625rem;flex-wrap:wrap">
            ${r.url
              ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="repo-title-link" style="font-size:1.5rem;font-weight:700;letter-spacing:-0.02em;font-family:var(--font-display)" title="View ${esc(full)} on GitHub">${esc(org)}${org ? '<span style="color:var(--text-muted)">/</span>' : ''}${esc(name)}${EXT_ICON}</a>`
              : `<div style="font-size:1.5rem;font-weight:700;color:var(--text-primary);letter-spacing:-0.02em;font-family:var(--font-display)" title="Cloned locally — no public remote">${esc(org)}${org ? '<span style="color:var(--text-muted)">/</span>' : ''}${esc(name)}</div>`}
            <div class="score-ring" style="border-color:${gradeColor}" title="Risk grade ${grade.grade} — score ${grade.score}/100 from validated findings and code ownership (bus factor, single-owner files)" aria-label="Risk grade ${grade.grade}, score ${grade.score} of 100">
              <span class="score-ring-num">${grade.score}</span>
              <span class="score-ring-grade" style="color:${gradeColor}">${grade.grade}</span>
            </div>
          </div>
          <p style="margin-top:0.375rem;font-size:0.9rem;color:var(--text-secondary);line-height:1.5">${esc(repoBlurb(r, true))}</p>
          ${allTech.length ? `<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.75rem;align-items:center">${techBadgesLimited}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="divider" style="margin:1.25rem 0"></div>

    <div style="display:flex;flex-wrap:wrap;gap:1rem 2rem;font-size:0.85rem">
      <span style="color:var(--text-muted)">Status: <span style="color:${st === 'failed' ? 'var(--red)' : st === 'clean' ? 'var(--green-brand)' : 'var(--amber)'};font-weight:500">${st === 'failed' ? 'Signal Lost' : st.charAt(0).toUpperCase() + st.slice(1)}</span></span>
      <span style="color:var(--text-muted)">Stack: <span style="color:var(--cyan)">${esc(repoStack(r))}</span></span>
      ${r.commits ? `<span style="color:var(--text-muted)">Commits: <span style="color:var(--text-secondary)">${r.commits.toLocaleString()}</span></span>` : ''}
      ${(h + m + l) ? `<span style="color:var(--text-muted)">Findings: <span style="color:var(--red);font-weight:500">${h} high</span>, <span style="color:var(--amber)">${m} med</span>, <span style="color:var(--green-brand)">${l} low</span></span>` : ''}
      ${r.scanSeconds ? `<span style="color:var(--text-muted)">Scan: <span style="color:var(--text-secondary)">${r.scanSeconds}s</span></span>` : ''}
      ${r.cloneMB != null ? `<span style="color:var(--text-muted)">Clone: <span style="color:var(--text-secondary)">${r.cloneMB} MB</span></span>` : ''}
    </div>
  </div>

  <div style="margin-top:2.5rem">
    <div style="margin-bottom:1.25rem">
      <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em">Generated Artifact</span>
      <h2 style="margin-top:0.375rem;font-size:1.25rem;font-weight:600;color:var(--text-primary)">The Skill It Forged</h2>
      <p style="margin-top:0.375rem;font-size:0.9rem;color:var(--text-secondary)">Every claim is cited to a real file path or marked <strong style="color:var(--amber)">unknown</strong>.</p>
    </div>
    ${skillPanel(r)}
  </div>

  ${signals || fr?.topContributors?.length ? `
  <div style="margin-top:2.5rem">
    <div style="margin-bottom:1.25rem">
      <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em">Forensic Analysis</span>
      <h2 style="margin-top:0.375rem;font-size:1.25rem;font-weight:600;color:var(--text-primary)">Evidence it's grounded</h2>
      <p style="margin-top:0.375rem;font-size:0.9rem;color:var(--text-secondary)">The skill above is built only from these readings — architecture, ownership, risk, and coverage, read from the repo, not estimated.</p>
    </div>
    ${evPills ? `<div class="evidence-strip">${evPills}</div>` : ''}
    <details class="evidence-details" open style="margin-top:1rem">
      <summary>Show all readings</summary>
      <div class="grid" style="margin-top:1.25rem">${signals}</div>
    </details>
  </div>` : ''}

  ${(r.opsFindings || []).length ? `
  <div id="findings" style="margin-top:2.5rem;scroll-margin-top:1.5rem">
    <div style="margin-bottom:1.25rem">
      <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em">Operational Findings</span>
      <h2 style="margin-top:0.375rem;font-size:1.25rem;font-weight:600;color:var(--text-primary)">What the swarm flagged</h2>
      <p style="margin-top:0.375rem;font-size:0.9rem;color:var(--text-secondary)">${h} high, ${m} medium, ${l} low — each cited to a real file and validated by the Oracle.</p>
    </div>
    ${findingsList(r)}
  </div>` : ''}

  <div style="margin-top:2.5rem;display:flex;justify-content:flex-end">
    <button class="btn btn-danger delete-report" data-repo="${esc(r.repo)}" style="display:inline-flex;align-items:center;gap:0.4rem">${TRASH_SVG} Delete report</button>
  </div>
</section>
${siteFooter()}`
  return shell(`Llama Smith · ${full}`, body, COPY_JS + TECH_JS + DELETE_JS)
}

export function buildDashboard(results, out = outDir) {
  const saved = data
  data.length = 0
  data.push(...results)
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'index.html'), indexPage())
  for (const r of data) writeFileSync(join(out, `${safeName(r.repo)}.html`), repoPage(r))
  data.length = 0
  data.push(...saved)
  return out
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { data = JSON.parse(readFileSync(process.argv[2] || '/tmp/ls-results.json', 'utf8')) } catch { data = [] }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), indexPage())
  for (const r of data) writeFileSync(join(outDir, `${safeName(r.repo)}.html`), repoPage(r))
  process.stdout.write('wrote ' + (data.length + 1) + ' pages\n')
}
