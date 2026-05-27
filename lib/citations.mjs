export function checkCitations(body, knownFiles) {
  const cited = [...body.matchAll(/\(←\s*([^)]+)\)/g)].map(m => m[1].trim())
  const known = new Set(knownFiles)
  const unknownCitations = [...new Set(cited.filter(c => !known.has(c)))]
  return { cited, unknownCitations, ok: unknownCitations.length === 0 }
}
