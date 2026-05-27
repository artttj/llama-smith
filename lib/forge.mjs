import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { readManifest } from './manifest.mjs'
import { gatherGrounding } from './grounding.mjs'
import { roleGuidance } from './templates.mjs'
import { buildDraftPrompt, parseDraft } from './draft.mjs'
import { checkCitations } from './citations.mjs'
import { writeSkill } from './skillwriter.mjs'
import { dispatch as realDispatch } from './ollama.mjs'

const ROLE_MODEL = { security: 'kimi-k2.6:cloud', deploy: 'glm-5.1:cloud', iac: 'glm-5.1:cloud' }

export function readLessons(root) {
  const p = join(root, '.smith', 'lessons.json')
  if (!existsSync(p)) return []
  try { const l = JSON.parse(readFileSync(p, 'utf8')); return Array.isArray(l) ? l : [] } catch { return [] }
}

// Route a lesson to a skill: overview gets all; others get lessons whose paths touch the evidence.
export function lessonsFor(entry, allLessons) {
  if (entry.skill === 'smith-overview') return allLessons
  const ev = entry.evidence || []
  return allLessons.filter(l => (l.paths || []).some(p => ev.some(e => p.includes(e) || e.includes(p))))
}

export function modelFor(skill, local) {
  const role = skill.replace(/^smith-/, '')
  const m = ROLE_MODEL[role] || 'qwen3.5:cloud'
  return local ? m.replace(/:cloud$/, '') : m
}

export async function forgeEntry(root, entry, { dispatchFn, host, local, lessons = [] }) {
  const grounding = gatherGrounding(root, entry)
  const prompt = buildDraftPrompt(entry, grounding, roleGuidance(entry.skill), lessons)
  const r = await dispatchFn(modelFor(entry.skill, local), prompt, host)
  if (!r.success) return { skill: entry.skill, status: 'failed', error: r.error }
  const skillMd = parseDraft(r.content)
  if (!skillMd) return { skill: entry.skill, status: 'unparseable' }
  const citations = checkCitations(skillMd, entry.evidence)
  const path = writeSkill(root, entry.skill, skillMd)
  return { skill: entry.skill, status: 'written', path, citations }
}

export async function runForge(root, { manifest, dispatchFn = realDispatch, host, local = false, only = null } = {}) {
  const m = manifest || readManifest(root)
  if (!m) throw new Error('no manifest — run the Brain (scan) first')
  const entries = only ? m.skills.filter(s => s.skill === only) : m.skills
  const allLessons = readLessons(root)
  const results = await Promise.all(entries.map(e => forgeEntry(root, e, { dispatchFn, host, local, lessons: lessonsFor(e, allLessons) })))
  return { project: m.project, results, exposure: m.exposure }
}
