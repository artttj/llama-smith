import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function assembleManifest({ project, sha, entries, exposure }) {
  return { version: 1, project, scanned_sha: sha, skills: entries, exposure: exposure || null }
}

export function writeManifest(root, manifest) {
  const dir = join(root, '.smith')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
}

export function readManifest(root) {
  const p = join(root, '.smith', 'manifest.json')
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}
