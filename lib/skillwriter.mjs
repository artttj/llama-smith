import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function writeSkill(repoRoot, skillName, skillMd, references = {}) {
  const dir = join(repoRoot, '.claude', 'skills', skillName)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), skillMd.endsWith('\n') ? skillMd : skillMd + '\n')
  const refNames = Object.keys(references)
  if (refNames.length) {
    const rdir = join(dir, 'references')
    mkdirSync(rdir, { recursive: true })
    for (const name of refNames) writeFileSync(join(rdir, name), references[name])
  }
  return join(dir, 'SKILL.md')
}
