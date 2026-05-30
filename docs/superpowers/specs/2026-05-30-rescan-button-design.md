# Design: One-Click Re-scan from Dashboard

**Date:** 2026-05-30
**Feature:** Per-repo re-scan button in the HTML dashboard
**Effort:** Low
**Scope:** Static HTML only — no server, no API

---

## Problem

Re-scanning a repo requires CLI knowledge (`node llama-smith.mjs ./path`). Non-technical stakeholders who review the dashboard can't trigger a re-scan without asking a developer.

## Solution

A copy-to-clipboard button on each repo page that embeds the exact CLI command needed to re-scan that repo.

---

## Architecture

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Command builder | `scripts/report.mjs` | Generates the CLI string for each repo |
| Button renderer | `scripts/report.mjs` | Emits the HTML + JS for the button |
| Copy utility | Inline JS in HTML | `navigator.clipboard` with fallback |

### Data flow

1. `repoPage(r)` receives the repo object `r`
2. If `r.repoPath` exists (absolute path from JSON source), build: `node <llama-smith-absolute> <repoPath>`
3. If not, build: `cd ../<r.repo> && node llama-smith.mjs .` (best-guess relative)
4. Embed as `data-cmd` on a `<button>` element
5. Click → copy to clipboard → show "Copied" toast for 1.5s

---

## UI Placement

The button sits in the repo page header, between the "back" link and the repo title block:

```
← all scanned sites    [⟳ re-scan]    llama·smith · Wolg/kerge
```

Visual treatment: small text button with `⟳` icon, same styling as existing `.back` link but right-aligned in the header row.

---

## Accessibility

- `<button>` element (not `<a>`) — it's an action, not navigation
- `aria-label="Copy re-scan command to clipboard"`
- `type="button"` to prevent form submission if ever nested
- Toast uses `role="status"` with `aria-live="polite"` so screen readers announce it
- Focus visible via existing `:focus-visible` styles

---

## Command Generation

### When repoPath is known (preferred)

The JSON source should carry an optional `repoPath` field — the absolute or relative path to the repo when the scan was run. The command becomes:

```
node /Users/art/.claude/skills/llama-smith/llama-smith.mjs /Users/art/projects/kerge
```

### When repoPath is unknown (fallback)

```
cd ../kerge && node llama-smith.mjs .
```

This assumes the report HTML and the repo share a parent directory. In the common case (reports generated from repo sibling directories), this works. If it doesn't, the user pastes and adjusts.

### Degraded state

If the button can't generate any command (no repo name), hide the button entirely via `display:none` — no broken promises.

---

## Copy Mechanism

```javascript
const copyCmd = async (btn) => {
  const cmd = btn.dataset.cmd
  try {
    await navigator.clipboard.writeText(cmd)
    showToast('Copied — paste in terminal')
  } catch {
    // Fallback: create temp textarea, select, copy, remove
    const ta = document.createElement('textarea')
    ta.value = cmd; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); document.body.removeChild(ta)
    showToast('Copied — paste in terminal')
  }
}
```

The toast is a small fixed-position div that fades in and out, reused across all buttons on the page.

---

## Testing

| Test | Location | What it checks |
|------|----------|---------------|
| Button renders with correct `data-cmd` | `test/report.test.mjs` | `repoPage()` includes a button with the expected command string |
| Button is absent when no repo path | `test/report.test.mjs` | `repoPage({repo: null})` omits the button |
| Copy JS is included in page output | `test/report.test.mjs` | `repoPage()` includes the `copyCmd` inline script |
| Toast element exists | `test/report.test.mjs` | The generated HTML contains a `#toast` div with `role="status"` |
| Accessibility attributes | `test/report.test.mjs` | Button has `aria-label`, `type="button"` |

All tests are unit-level — they assert on the generated HTML string, not on browser behavior. Clipboard interaction is not tested (browser API, not our code).

---

## Open Questions

None — this is a scoped, low-effort feature with clear boundaries.

---

## Success Criteria

- [ ] A user viewing a repo page can click a button and paste a working re-scan command
- [ ] Screen reader users hear confirmation when the command is copied
- [ ] The button degrades gracefully when path info is unavailable
- [ ] All new code has tests in `test/report.test.mjs`
