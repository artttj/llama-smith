# Dashboard refresh: the skill is the hero, + delete reports

- Date: 2026-05-30
- Status: approved in-chat ("inline exec spec"), implementing inline
- Surface: `scripts/report.mjs`, `scripts/serve.mjs`, `assets/dashboard-v2.css`
- Untouched: `lib/` (the brain). This is presentation + one mutation endpoint only.

## Problem

The per-repo detail page (`repoPage()` in `scripts/report.mjs`) leads with a repo
report card (a 2.75rem score + "Grade F") and seven forensic cards. The forged
skill — the product's actual output — sits last, below the fold. The loudest
signal on the page answers a question nobody asked. The product is "point at a
repo, get a skill"; the page should say that, first.

Separately, the dashboard can only show reports — never remove one.

## Spec A — Detail page: the skill is the hero

One sentence: *"Here's the skill we forged from this repo, and the proof it's grounded."*

All changes live in `repoPage()` and its helpers:

1. **Order.** Emit `skillPanel(r)` BEFORE the forensic section. The skill is the
   first big block under the repo identity.
2. **Grade → chip.** Replace the right-side 2.75rem score block with a compact
   `badge-grade` chip in the identity row (`<grade> · <score>`, e.g. `F · 19`).
   It grades the repo's risk, not the skill, so it stops being the headline.
3. **Metadata.** The Status/Stack/Commits/Scan/Clone row collapses to one thin
   line. Findings (H/M/L) move into the evidence strip.
4. **Forensics demoted, not deleted.** `repoSignals(r)` wraps in a new container:
   a one-line "Evidence it's grounded" summary strip stays visible (findings,
   bus factor, code files + single-owner, architecture facts, hot files); the
   existing 7-card grid moves inside a collapsed `<details>` ("Show readings").
   No data removed — only demoted from headline to proof.
5. **Headers.** "The Skill It Forged" is the hero header (moved up). The forensic
   header becomes "Evidence it's grounded".

## Spec C — Delete report (report-only)

One sentence: *"Remove a report from the dashboard; never touch the repo."*

- **`scripts/serve.mjs`:** add `POST /api/delete`, body `{ repo }`.
  - Validate `repo` is present in `/tmp/ls-results.json` (the known set). Reject
    anything not in the set (404); reject non-POST (405).
  - On success: remove the entry, write results.json, `unlink`
    `reports/<safeName>.html` (guarded by the existing root-prefix check),
    rebuild `index.html` via `buildDashboard`.
  - Stays `127.0.0.1`-bound, `no-store`.
- **`scripts/report.mjs`:**
  - Detail page: `Delete report` button near the bottom → `confirm()` → POST →
    on 200 redirect to `index.html`.
  - Index `card()`: restructure from a bare `<a>` to a positioned container (link
    inside, trash button top-right, outside the anchor) → confirm → POST → remove
    the card node on success.
- **Security (threat model: repo names are untrusted):** deletion maps repo → file
  ONLY via `safeName` AND membership in the results set. Never deletes a path we
  did not emit. Inherit `serve.mjs`'s existing `path.startsWith(root + '/')` guard.

## Hero copy (index)

`heroSection()` H1 becomes a three-beat naming the Oracle, mirroring the pipeline:

> Many Smiths enter. The Oracle judges. One skill comes out.

The existing "Oracle validated" proof chip and "Oracle validates" pipeline step stay.

## Visited links

New `--link-visited` token in `assets/dashboard-v2.css` (a muted lavender,
~`#a99bd6`), applied to content links (back link, footer links, in-content links)
— never buttons or badges.

## Testing

- `test/serve.test.mjs`: `POST /api/delete` removes the entry + html file; unknown
  repo → 404 with no file touched (traversal guard); `GET /api/delete` → 405.
- `test/report.test.mjs`: rendered detail page has the skill panel before the
  forensic section; grade renders as a chip; hero H1 contains "Oracle".
- Manual: serve on :7777, screenshot the detail page (skill above the fold),
  exercise delete + confirm.

## Out of scope (separate specs)

- **Spec B:** collapse raw `node scripts/*.mjs` (lesson, report, diff, serve) into
  plugin slash commands, per current Claude Code plugin docs. Next, after this.
- Laravel/artisan command pointer (see Appendix).

## Appendix — artisan commands (debug finding, 2026-05-30)

`lib/commands.mjs` extracts commands ONLY from Makefile, `package.json`,
`composer.json`, and CI `run:` lines. Artisan's command registry is runtime-resolved
(`php artisan list`) and declared in no manifest, so only the artisan commands
literally written in composer scripts / CI appear. Surfacing the rest would require
running the app or hardcoding framework knowledge — both violate "never invent a
command." Working as designed. Optional future enhancement: if an `artisan` file
exists, emit one pointer line ("Laravel app — run `php artisan list`") without
inventing specific commands.
