# Design: Continuous Skill — The Living Repo Memory

**Date:** 2026-05-30
**Feature:** A `watch`/`continuous` mode that keeps a forged skill in sync with the repo and surfaces a skill-health view of what went stale and when
**Effort:** High (phased — first milestone is Low)
**Scope:** New `watch` verb + a thin continuous-loop module; reuses the existing incremental and freshness modules. No new dependencies.

---

## Problem

A forged skill is a point-in-time snapshot. The moment a scan finishes, the repo keeps moving and the skill rots silently. The 10x analysis names this directly (idea #1, `.claude/docs/ai/llama-smith/10x/session-1.md:42-53` and current-pain `:26` "Skill is point-in-time — no mechanism to detect staleness or auto-update").

Today the tool is one-shot: `runPipeline(root, opts)` runs once when a human types `node llama-smith.mjs <repo>` (`llama-smith.mjs:31-56`). There is no recurring trigger, no automatic re-scan when code changes, and no running view of which cited claims now point at files that moved. A user has to *remember* to re-scan and then *remember* to read the badge.

Two pieces of the fix already exist and must be built **on**, not reinvented:

- **#5 Incremental scanning** — `lib/incremental.mjs` hashes the working tree (`fileHashes`), diffs against the last run's cache (`diffHashes`), and `runPipeline` skips the swarm + Oracle entirely when nothing scan-relevant changed (`lib/pipeline.mjs:100-120`). This is the cheap "did anything matter?" gate.
- **#8 Skill Health Badge** — `lib/freshness.mjs` computes staleness from the scan timestamp and the set of cited files that changed (`computeFreshness`, `repoFreshness`, `freshnessBadge`), and `scripts/health.mjs` already writes `.smith/health.json` and prints a badge. This is the cheap "is it stale, and which claims?" surface.

What's missing is the connective tissue: a loop that *notices* change, decides whether it's worth a re-scan, runs an incremental scan when it is, and reports drift without spamming the user.

## Solution

A `watch` verb that runs a debounced, relevance-gated loop:

1. On a trigger (commit / file event / timer), compute the current file hashes and diff against `.smith/scan-cache.json`.
2. Gate: if no **scan-relevant** file changed, do nothing but refresh the freshness view (timestamps still age).
3. If a relevant file changed, run an **incremental** scan (`runPipeline(root, { incremental: true })`) — which reuses cached findings for untouched files and only re-runs Smiths when relevance fires.
4. Compute a **staleness diff**: which previously cited claims now point at changed files, and which findings appeared / disappeared since the last scan.
5. Notify **once per settled batch**, only when the drift crosses a threshold. Refresh `.smith/health.json` so the dashboard and badge stay current.

The first shippable milestone is much smaller — a scheduled re-scan plus a printed staleness report — and is described under "Phasing / First Milestone" below and in the plan.

---

## Architecture

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Continuous loop | `lib/continuous.mjs` (new) | Pure orchestration: given a change set, decide rescan-or-skip, run the staleness diff, build a report object. No I/O timers, no `runPipeline` call inside — takes them as injected functions so it stays unit-testable. |
| Staleness diff | `lib/continuous.mjs` (new) | `stalenessDiff(prevFindings, nextFindings, changedSet, freshness)` → `{ staleClaims, added, removed, status }`. Pure. |
| Debounce + relevance gate | `lib/continuous.mjs` (new) | `shouldRescan(changedSet, { debounceMs, lastRunAt, now })` and reuse of `relevantChanged` from `lib/incremental.mjs`. Pure. |
| Watch CLI | `scripts/watch.mjs` (new) | Owns the trigger (timer / `fs.watch` / hook-invoked single shot), debounce timing, calls `runPipeline`, and prints/writes the report. The only place with side effects. |
| Trigger: git hook | `hooks/post-commit` (new, opt-in) | One line: `node <ls>/scripts/watch.mjs <repo> --once`. Installed by `scripts/watch.mjs --install-hook`. |
| Reused: incremental | `lib/incremental.mjs` (exists) | `fileHashes`, `diffHashes`, `relevantChanged`, `readCache` — the change-detection and relevance gate. |
| Reused: freshness | `lib/freshness.mjs` (exists) | `computeFreshness` / `repoFreshness` / `freshnessBadge` — staleness grading and badge. |
| Reused: pipeline | `lib/pipeline.mjs` (exists) | `runPipeline(root, { incremental: true })` — the actual scan, unchanged. |

### Data flow

```
trigger ─▶ scripts/watch.mjs
            │  read .smith/scan-cache.json  (readCache)
            │  fileHashes(root, listFiles)   ─▶ diffHashes ─▶ changedSet
            ▼
        shouldRescan(changedSet, debounce)         ── no ──▶ refresh freshness only, exit quiet
            │ yes (relevant + debounce elapsed)
            ▼
        runPipeline(root, { incremental: true })   ── reuses cached findings, lib/pipeline.mjs:100-120
            │  prevFindings = cache.findings (before run)
            │  nextFindings = res.json.opsFindings
            ▼
        stalenessDiff(prev, next, changedSet, repoFreshness(root))
            ▼
        write .smith/health.json   +   notify(report) if report.status crossed threshold
```

Everything left of `runPipeline` is cheap and runs on every trigger. The expensive swarm only runs when the relevance gate passes — exactly the existing `reuse` branch in `lib/pipeline.mjs:101`.

---

## Trigger options

Three candidate triggers. The recommendation is to support **git post-commit hook as the primary trigger**, with a **scheduled timer as the fallback**, and treat a raw file watcher as out of scope for v1.

### 1. Git post-commit hook (RECOMMENDED primary)

A `.git/hooks/post-commit` that calls `node <ls>/scripts/watch.mjs <repo> --once`.

- **Why:** A commit is the natural unit of "scan-relevant change." It is debounced for free — one fire per commit, not per keystroke. The hash diff against `.smith/scan-cache.json` is the same logic incremental already uses, and a commit boundary is where the cited-file set is most likely to have actually moved. It also aligns with where #4 (PR-time scanning) will eventually plug in.
- **Cost control:** Naturally low frequency. The relevance gate (`relevantChanged`) still suppresses re-scans for commits that touch only docs/tests.
- **Limit:** Only fires for *this* working copy's commits. A teammate's push won't trigger it. That's acceptable for v1 (the skill is per-checkout) and is why the scheduled fallback exists.

### 2. Scheduled timer / cron (RECOMMENDED fallback + first milestone)

A long-lived `setInterval` inside `scripts/watch.mjs`, or an external cron entry calling `--once`.

- **Why:** Catches change that arrives by `git pull` rather than local commit. Trivial to reason about. The "simplest thing that works" first milestone (below) is exactly this minus the daemon: a single `--once` invocation a human or cron runs.
- **Cost control:** Interval is the throttle. Default 10 minutes; the relevance gate makes most ticks free (hash + diff only, no swarm).

### 3. File watcher via `fs.watch` (DEFERRED — not v1)

- **Why deferred:** `fs.watch` is noisy (editor swap files, formatter-on-save, build output) and platform-inconsistent (recursive watch is unreliable on Linux). It would fire on every save and lean hard on the debounce + relevance gate to avoid waste. The 10x doc explicitly warns about re-scan cost and notification overload (`session-1.md:51`). A commit hook gives us a clean, already-debounced signal without that risk. We can add `fs.watch` later behind a `--watch-fs` flag once the loop is proven.

**Recommendation rationale:** commit hook + timer covers both "I committed locally" and "I pulled someone else's work" with zero noisy-event handling, reuses the existing hash/relevance machinery verbatim, and keeps the only stateful component (the timer) in one file we can test by injecting a fake clock.

---

## Reusing incremental for cheap change detection

The loop never decides on its own what "changed enough" means. It calls the same primitives `runPipeline` already uses (`lib/pipeline.mjs:15` imports them):

1. `fileHashes(root, listFiles(root))` → current tree hashes (large files hashed by size:mtime, `lib/incremental.mjs:13`).
2. `diffHashes(cache.fileHashes, current)` → `{ changed, added, removed, unchanged }`.
3. `changedSet = [...changed, ...added, ...removed]`.
4. `relevantChanged(changedSet, [SCAN_PATTERNS])` → boolean gate (same expression as `lib/pipeline.mjs:101`).

If the gate is false, the loop does not invoke `runPipeline` at all — it only refreshes freshness (timestamps age even when files don't). If true, it calls `runPipeline(root, { incremental: true })`, which internally reuses cached findings for untouched files (`partitionFindings`, `lib/pipeline.mjs:118`) and only re-runs the swarm where needed. We get the cost savings for free because we are calling the same code path the manual `--incremental` flag already exercises.

## Reusing freshness for staleness

After a (possibly skipped) scan, the loop calls `repoFreshness(root)` (`lib/freshness.mjs:31`). That already does the right git work: it reads `.smith/findings.json`, collects cited files from `opsFindings` + `architecture`, diffs the working tree against the stored `sha`, and returns `{ status, daysSince, changedCited }`. The loop writes that to `.smith/health.json` exactly as `scripts/health.mjs:32` does today, so the dashboard badge and the README badge stay in sync with zero new staleness logic.

## Staleness-diff surface

`repoFreshness` gives a *count* of changed cited files. The continuous mode needs the *list* and the *deltas* so it can tell the user what specifically rotted. `stalenessDiff` (pure, in `lib/continuous.mjs`) takes the previous findings (from `readCache(root).findings`, captured before the rescan), the next findings (`res.json.opsFindings`), the `changedSet`, and the freshness object, and returns:

- `staleClaims`: cited claims whose `file` is in `changedSet` — "this claim points at code that moved."
- `added`: findings present now but not in the previous cache (keyed by `findingKey` from `lib/escalation.mjs:16`, which already gives a stable smith+file+text identity).
- `removed`: findings that were in the cache but are gone now.
- `status`: the freshness `status` (`fresh` / `aging` / `stale`).

This is the data both the notification and a future dashboard "skill health timeline" render from. It reuses `findingKey` so identity matches how escalation already tracks findings across scans (`lib/escalation.mjs:33-43`).

## Notification strategy (avoiding alert fatigue)

The 10x risk is explicit: "Could overwhelm users with notifications if not carefully designed" (`session-1.md:51`). Rules:

- **One notification per settled batch.** Debounce collapses a burst of triggers into a single evaluation. A rebase that touches 40 files notifies once.
- **Threshold, not every tick.** Notify only when `status` becomes `stale` **or** `staleClaims.length > 0` **or** there are `added`/`removed` findings. A scan that confirms everything is still true is silent.
- **Quiet refresh on no-op.** When the relevance gate is false, the loop still rewrites `.smith/health.json` (so the badge ages correctly) but prints nothing and sends nothing.
- **Channel for v1 is stdout + the health file.** `scripts/watch.mjs` prints a one-line drift summary and writes `.smith/health.json`. No Slack/webhook in v1 — that waits until there is a clean integration point (the 10x doc backlogs auto-escalation alerts for the same reason, `session-1.md:191`). A `--notify-cmd "<shell>"` hook is the extension seam if a user wants desktop/Slack notification; the loop just execs it with the summary.

## Cost control

- **Relevance gate first, swarm last.** The hash+diff+`relevantChanged` check is pure-Node and sub-second; the Ollama swarm only runs when it passes. Most ticks cost nothing.
- **Debounce.** `shouldRescan` refuses to run if `now - lastRunAt < debounceMs` (default 30s) regardless of trigger volume. Save-storms and rebases collapse into one run.
- **Incremental always on in watch mode.** `runPipeline(root, { incremental: true })` reuses findings for unchanged files, so even a triggered scan re-runs Smiths only where relevance fired.
- **No architecture re-map churn unless needed** — see the tradeoff below; this is the one place the existing incremental gate does *not* save us, and we must scope around it.

---

## Tradeoffs and risks (honest)

- **Ollama token cost on every relevant change.** Even incremental scans invoke the swarm + Oracle when relevance fires. On a fast-moving repo with frequent deploy/secret/cron edits, that is real local-model load. Mitigation: debounce + the relevance gate; default to the scheduled trigger at a conservative interval; document that `watch` is for steady repos, not minute-by-minute churn.
- **Architecture is NOT gated by incremental.** This is the sharp edge. In `lib/pipeline.mjs`, the `reuse` branch (`:101`) only short-circuits the **ops swarm** — `mapArchitecture` still runs on every non-`scanOnly` call (`:121`). So a triggered scan that passes the relevance gate re-maps architecture every time, which is an extra Oracle-validated LLM pass that incremental does not currently cache. v1 of watch should run with `scanOnly`-style behavior for the *gate check* but accept that a full re-scan re-maps architecture; a follow-up should extend the incremental cache to cover architecture (cache `findings.architecture`, invalidate only when an `ARCH_RELEVANT` file changes). Flagged here so the implementer does not assume incremental already makes watch cheap on architecture — it does not.
- **Notification noise** if thresholds are too loose. Mitigated by the batch/threshold/quiet-refresh rules above, but thresholds will need tuning against a real repo.
- **Stochastic swarm causes phantom add/remove churn.** The swarm is non-deterministic (`session-1.md:23`, `pipeline.mjs:48`), so `added`/`removed` in the staleness diff can flicker between runs even when code didn't change. Mitigation: key deltas on `findingKey` and treat a finding as "removed" only if absent for the run; consider requiring a finding to be missing for *two* consecutive relevant scans before reporting it removed (future tuning, not v1).
- **Hook portability.** A `post-commit` hook only covers the local checkout and is bypassed by `--no-verify` and by `git pull`. The scheduled fallback exists precisely because the hook is not authoritative.
- **Large-file hashing is mtime-based** (`lib/incremental.mjs:13`), so a touched-but-unchanged large file can look changed. Acceptable: it only over-triggers, never under-triggers, and the relevance gate usually filters it.

## Non-goals

- **No long-lived always-on daemon in v1.** v1 is `--once` (hook/cron) plus an optional foreground `--interval` loop. A supervised background service (pm2/systemd) is explicitly out of scope.
- **No `fs.watch` file watcher in v1.** Deferred behind a future `--watch-fs` flag.
- **No cross-machine / team triggering.** Watch is per-checkout. A teammate's commits do not trigger your watcher. Org-wide monitoring is idea #3, backlogged.
- **No Slack/webhook/email transport.** v1 notifies via stdout + `.smith/health.json` and an optional `--notify-cmd` exec seam. No built-in integrations.
- **No changes to scan/Oracle/skill-forge logic.** Watch orchestrates existing `runPipeline`; it does not alter how Smiths scan or how skills are forged.
- **No new runtime dependencies.** Node 20+, `node:fs`/`node:timers`, native `node:test`, consistent with the repo's zero-dependency stance (`session-1.md:20`).

---

## Open questions

- Default scheduled interval (proposed 10m) and debounce window (proposed 30s) — need tuning against a real repo's commit cadence.
- Should `removed` findings require two consecutive relevant scans before being reported, to absorb swarm flicker? Lean yes, but defer to after v1 data.
- Architecture caching (the un-gated re-map) — design it as a follow-up extension to `lib/incremental.mjs` or fold it into watch's gate? Lean: extend incremental so both manual `--incremental` and watch benefit.

## Success criteria

- [ ] A user can run `node scripts/watch.mjs <repo> --once` after a commit and get either a "no relevant change" quiet exit or a one-line staleness report plus a refreshed `.smith/health.json`.
- [ ] Re-scans only fire when a scan-relevant file changed (verified by the relevance gate reusing `relevantChanged` + `SCAN_PATTERNS`).
- [ ] Debounce collapses a burst of triggers into one scan.
- [ ] The staleness diff correctly lists cited claims whose files changed, plus added/removed findings, all derived from cached vs. fresh findings.
- [ ] No new dependencies; all new pure logic has unit tests; the daemon timing is tested with an injected clock, never `sleep`.
