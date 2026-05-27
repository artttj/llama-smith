import { readSlice } from './git.mjs'
import { parseMakefile, parsePackageScripts, parseComposerScripts } from './commands.mjs'

export function gatherGrounding(root, entry) {
  const files = entry.evidence.map(f => ({ path: f, content: readSlice(root, f) }))
  const commands = {}
  for (const { path, content } of files) {
    if (/(^|\/)Makefile$/i.test(path)) commands[path] = parseMakefile(content)
    else if (/(^|\/)package\.json$/.test(path)) commands[path] = parsePackageScripts(content)
    else if (/(^|\/)composer\.json$/.test(path)) commands[path] = parseComposerScripts(content)
  }
  return { skill: entry.skill, evidence: entry.evidence, files, commands }
}
