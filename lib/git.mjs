import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const MAX_FILE_BYTES = 12000

export function git(cmd, cwd) {
  try { return execSync(`git ${cmd}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 }) }
  catch { return '' }
}

export function headSha(root) { return git('rev-parse HEAD', root).trim() }

export function listFiles(root) {
  const tracked = git('ls-files', root).split('\n').map(s => s.trim()).filter(Boolean)
  if (tracked.length) return tracked
  const out = []
  const walk = (dir, depth) => {
    if (depth > 4) return
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name.startsWith('.git') || e.name === 'node_modules' || e.name === 'vendor') continue
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full, depth + 1)
      else out.push(relative(root, full))
    }
  }
  walk(root, 0)
  return out
}

export function readSlice(root, file) {
  try {
    const buf = readFileSync(join(root, file), 'utf8')
    return buf.length > MAX_FILE_BYTES ? buf.slice(0, MAX_FILE_BYTES) + '\n…(truncated)' : buf
  } catch { return '' }
}
