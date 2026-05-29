# llama-smith — cut to core, operational-risk wedge

**Date:** 2026-05-27
**Status:** design approved, ready for implementation plan
**One line:** Point it at a repo. It reads how the repo *deploys and breaks*, maps where the code actually churns, and forges that into a small set of Claude Code skills — every claim cited to a real file or marked `unknown`.

---

## Why this redesign

The current tool was tested on three famous repos this session (express, flask, svelte, full git history, live Ollama swarm). The findings were decisive:

- **The deterministic numbers are exact.** Churn counts and after-hours percentages matched raw git on all three. The half that counts instead of guesses is trustworthy.
- **The LLM operational read is genuinely sharp when there is material.** On flask it correctly parsed the publish workflow's job DAG and caught that `create-release` and `publish-pypi` both `needs: [build]` only, so the draft release cannot gate the publish. Verified true. On svelte it caught publish-to-npm-`latest` with no canary.
- **But the loudest output is mis-targeted.** The "complexity = line count" proxy flagged `Readme.md`, `History.md`, `uv.lock`, `CHANGES.rst`, `pyproject.toml`, `pnpm-lock.yaml` as hotspots across the three repos. None is code. The real signal (svelte's reactive core: `batch.js` 108 edits, `runtime.js` 53) was present but buried.
- **The headline features are dead on real repos.** The Brain's gotcha feed returned empty 0/3. The exposure line was null 0/3. The Construct dashboard declared all three repos "100% PRISTINE, no scars" — a tool that found real problems telling the user there are none. For a calling card, that is a credibility leak, not a feature.
- **The two engines do not talk.** The scan that finds the gold (`llama-smith.mjs`) and the forge that writes skills (`lib/brain.mjs` + `lib/forge.mjs`) are disconnected. The forge grounds each skill only on raw evidence files, never on the findings — so the forged svelte skills contained neither the churn-map nor the deploy race. The flagship `smith-overview` was an empty stub ("Stack: unknown"); `smith-conventions` was 315 lines of the model thinking out loud, written verbatim to disk because `parseDraft` failed to strip it.

The diagnosis is not a vision problem. The tool computes impressive things and then fails to deliver them to the artifact that is supposed to be the hero. That is a plumbing-and-discipline problem, and it is fixable.

## Competitive landscape (why the wedge)

The "git history → knowledge an AI coding agent uses" space exploded in early 2026 and is crowded. Direct, more-built-out competitors:

- **sentinel** (evo-hydra) — same thesis, plus hot-file scoring, pitfalls from bug-fix commits, MCP server, semantic search, PR risk gate, feedback loop.
- **repowise** — hotspots (churn × complexity), ownership, bus factor, co-change, blast radius, module health 0–100, MCP (9 tools), multi-repo.
- **skilgen** — "repo → `skills/` tree + AGENTS.md" with a quality score; the most direct overlap with the original llama-smith.
- **chronicle**, **mneme-ai**, **devcontext-engine**, **GitNexus** — git-history memory, decisions, knowledge graphs, mostly via MCP. CodeScene and code-maat are the established forensics layer.

Shipping a less-built version of skilgen or repowise gets ignored. The opening: almost everyone does code *memory, conventions, decisions, structure* — the "why" and the "what." Hardly anyone reads **how a repo operates and where it will bite**: the deploy path, the rollback gap, the cron that writes to `/dev/null`, the CI gate that does not gate. That is the wedge. It is the least crowded, the most "senior engineer" flavored, and it matches the one finding that already impressed on a real repo.

**Positioning:** llama-smith reads your *ops*, not your vibes.

## Goals

1. One pipeline. A single `findings` object is the contract between scan and forge, so a finding that is not in the skill is a visible, testable bug.
2. The operational-risk read is the hero: a `<project>-ops` skill grounded in real CI/deploy/cron files, every risk cited.
3. Every forged skill is trustworthy: cite the source file inline, write `unknown` when the evidence is absent, never invent a command. A skill with no real evidence is skipped, not stubbed. A draft that fails to parse or comes back truncated is not written.
4. The deterministic churn-map targets **code only** — no docs, lockfiles, changelogs, or generated files in hotspots.
5. Verifiable on famous repos: the throwaway harness from this session becomes the regression suite.

## Non-goals (v1)

- No MCP server, no semantic search, no knowledge graph. Static `.claude/skills/` files are the deliverable; competing on MCP is a different product.
- No dashboard, no vibe score, no gotcha feed, no "what I'd know in 60 seconds" exposure theater.
- Memory Matrix (session lessons) stays *compatible* — if `.smith/lessons.json` exists it folds into skills — but is not featured.
- Reality Check, Oracle Loop, Agent Duel (multi-model consensus), Skill Drop, the `diff` verb: out of scope (roadmap).

## Architecture

```
llama-smith <repo>
        │
   ┌────▼──────────  SCAN  ──────────────────┐
   │ deterministic (git, no LLM):             │  churn → CODE-only hotspots
   │   churn, ownership, hotspots             │  ownership / bus factor
   │ analytical (LLM, grounded, OPS-focused): │  deploy + CI-trust + cron/jobs risk
   │   stack/framework, operational risk      │  secrets by reference only
   └───────────────────┬──────────────────────┘
                        │ writes .smith/findings.json   ← the contract
                        │ prints findings to terminal    ← the live proof
   ┌────────────────────▼──────────  FORGE  ──┐
   │ each skill grounded on evidence files     │
   │   + the relevant FINDINGS  ◄──────────────┼─ the gold flows in here
   │ hardened parse, no truncation, dedup      │
   └────────────────────┬──────────────────────┘
                         │ writes .claude/skills/<project>-*/SKILL.md   ← the hero
```

The two existing engines merge into one `lib` pipeline. The deterministic collectors and the analytical prompts from `llama-smith.mjs` move into `lib`; `llama-smith.mjs` becomes a thin CLI.

### The findings object (`.smith/findings.json`)

```jsonc
{
  "project": "svelte", "sha": "...", "scannedAt": "...",
  "stack": { "language": "js", "framework": "Svelte", "packageManager": "pnpm@10.4.0" },
  "hotspots": [
    { "file": "src/internal/client/reactivity/batch.js", "edits": 108 }   // CODE only
  ],
  "ownership": [ { "file": "...", "authors": 1, "topShare": 1.0 } ],
  "commands": { "build": "...", "test": "vitest run", "release": "changeset publish" },
  "operations": {                                  // the wedge
    "deploy": [ { "text": "publish-pypi and create-release both need:[build] → draft can't gate", "file": "release.yml", "severity": "high" } ],
    "ci":     [ { "text": "...", "file": "...", "severity": "..." } ],   // CI-trust traps
    "jobs":   [ { "text": "cron writes to /dev/null, failures are invisible", "file": "...", "severity": "..." } ]
  },
  "exposure": null   // regex-only, high-confidence; no LLM narration
}
```

`severity` is `high | medium | low`. Findings are deduped by `(file, kind)` before they are written or printed.

## The scan

**Deterministic (no LLM, cannot hallucinate):**
- Churn over the configured window (default last year), counted `--name-only` (merge-free), which the test proved exact.
- `isCodeFile(path)`: allowlist of source extensions; blocklist `*.md`, `*.rst`, `*.txt`, `*lock*`, `*.lock`, `*.toml`, `*.d.ts`, `CHANGELOG/HISTORY/CHANGES`, `version.js`, and manifest files for hotspot purposes. **Only code is promoted to `hotspots`.**
- Ownership / bus factor per hotspot file.
- Drop the fix/feat "firefighting" scar — verified an artifact of commit-label convention (svelte: 422 `fix:` vs 27 `feat:` is changesets labeling, not firefighting).

**Analytical (LLM, grounded, OPS-focused):** a single ops read replaces the old deploy/secret/cron/scar smiths. It inspects CI, deploy, compose, cron, queue, and Makefile/script files and reports operational risk only:
- deploy: missing/partial rollback, manual-only deploy, no staging gate, publish that races its own review gate, destructive steps, hardcoded hosts.
- CI-trust: gates that do not gate (`continue-on-error` on tests/typecheck), unpinned or drifting action SHAs, workflows with write permissions that mutate PRs/issues/repo.
- jobs: silent cron failure (`2>/dev/null`, no logging), overlapping schedules, no lock, no alerting.
- secrets: by reference only (file + risk), never the value. The regex exposure scan (high-confidence patterns only) feeds `exposure`.

Speed: route lanes to the fast, accurate models observed this session (glm-5.1 ~5–10s, deepseek-v4-flash ~38s) and away from the bottleneck (qwen3.5 was 87–153s). Trim scan `num_predict`. Target a sub-60s scan.

## The forge — three skills, ops is the hero

Project-prefixed names so the artifact reads like a real product (`svelte-ops`, not generic `smith-ops`).

| Skill | Grounded on (evidence **+ findings**) | Role |
|---|---|---|
| **`<project>-ops`** | CI / deploy / cron / compose files **+ `operations` findings** | **Hero.** The operational-risk read, each risk cited. The wedge. |
| **`<project>-overview`** | file tree + README + **`stack` + `hotspots`** | What it is, stack, and where the code churns (fragility map). |
| **`<project>-commands`** | parsed `package.json` / `Makefile` / `composer.json` scripts | Real run/build/test/deploy commands. |

Forge rules (unchanged where they work, hardened where they failed):
- Ground every command and path in evidence; cite inline as `(← path/to/file)`; write `unknown` if absent; never invent.
- **The gold is fed in.** `buildDraftPrompt` receives the relevant findings (ops findings for the ops skill, hotspots + stack for overview), not just raw files. This is the central fix: the ops skill *contains* the deploy race because it was handed the finding.
- **Skip, do not stub.** A skill whose evidence and findings are both empty is not forged. (Kills the "Stack: unknown" overview stub.)
- **Optional `<project>-security`** is forged only when the regex exposure scan hits — no LLM guessing.
- `conventions` and `iac` are dropped from the default set.

### Hardening (the four bugs the forge run exposed)

1. **`parseDraft` rewrite.** Strip `<think>`/`<thinking>` blocks. Require the output, after trimming and fence-stripping, to *start* with `---` frontmatter containing `name:` and `description:`. Reject chain-of-thought signatures (lines beginning `Wait`, `Let me`, `Okay,`; repeated `--- EVIDENCE ---`; more than a sane number of `---` fences). On failure: one stricter retry ("Output ONLY the file content, beginning with ---"), else `status: failed` and do not write.
2. **Truncation guard.** Raise forge `num_predict` to ~5000. Detect a truncated draft (length-capped, ends mid-line, unbalanced) and refuse to write a half-skill; retry once with a higher budget or mark failed.
3. **Dedup findings** by `(file, kind)` before forge and print.
4. **Code-only hotspots** via `isCodeFile()` (also a scan concern, listed above).

## CLI surface — no verb

The name is the metaphor; the metaphor is the whole product. `llama-smith`
already says Smith — a verb like `swarm` would say it twice. So there is no verb.
Point it at a repo.

```bash
llama-smith <repo>              # scan (print findings = proof) → forge the skill
llama-smith <repo> --scan-only  # findings only, write nothing
llama-smith <repo> --json       # findings as JSON (tests / piping)
llama-smith <repo> --local      # strip :cloud, use local Ollama
llama-smith <repo> --only <skill>
```

`cli-brain`, `cli-forge`, `cli-dashboard`, `cli-lessons` collapse into this single entry. Terminal output: a calm, scannable report (the proof), then `forged → .claude/skills/`. Light Matrix flavor in the header only — not load-bearing.

**Naming, settled — one metaphor only.** `llama-smith` is Agent Smith for your repo, and the name carries it; nothing else wears a costume. The whole vocabulary is three words:

- **Smiths** — the parallel scanners that read the repo.
- **Glitches** — the operational tells that the system is broken: the deploy that races its own gate, the CI check that does not gate, the cron screaming into `/dev/null`. A Glitch is ops risk, never trivia. This is the wedge.
- **Skills** — the cited Claude Code output. A claim with no source file is written `unknown`, never invented.

Rejected: `swarm`/`construct`/`council`/`conclave`/`field-guide` as verbs (the name already does the work), and `Oracle`/`Reality Check`/`Memory Matrix`/`Scar Atlas`/`Foundry` as branding (each names a feature v1 does not ship). `scan` and `forge` stay internal stage names. The product fits on two lines: **Repo in. Skill out. Many Smiths enter, one skill comes out.**

## The cut list

Delete: `cli-dashboard.mjs`, `lib/dashboard.mjs` (The Construct), `lib/vibe.mjs`, `lib/gotchas.mjs` + the gotcha-feed path, `lib/consensus.mjs` + exposure narration theater, and the duplicated engine logic in `llama-smith.mjs` once merged into `lib`. Remove the fix/feat firefighting scar. Keep the `lib` module structure (signals, rules, manifest, grounding, citations, ollama, git) and the `lessonsFor` wiring.

## Testing — the famous-repo harness becomes the suite

- **Deterministic fixtures:** record `git log` outputs from express/flask/svelte; assert churn and hotspot numbers stay exact.
- **The regression we found:** assert no doc/lock/generated file ever appears in `hotspots`.
- **No duplicate findings;** `exposure` is regex-only.
- **Forge integrity (model-independent):** `buildDraftPrompt` includes the relevant findings; a fixture draft with a planted deploy finding survives `parseDraft`; a fixture think-dump is rejected; a truncated fixture is rejected; every cited `(← path)` exists in evidence.
- Update the existing 65 unit tests to the `findings` shape; delete dashboard/vibe/gotcha tests.
- A `--scan-only --json` mode enables snapshot testing of findings.

## Suggested build order

1. **Findings contract + code-only churn.** Define `findings.json`; move deterministic collectors into `lib`; add `isCodeFile`; fix hotspot targeting. Tests: exact numbers, no docs in hotspots.
2. **Ops scan.** One analytical ops smith (deploy + CI-trust + jobs + secret-by-reference) → `operations` findings, deduped, fast models. Tests on the three repos.
3. **Forge wiring + hardening.** Feed findings into `buildDraftPrompt`; rewrite `parseDraft`; truncation guard; skip-don't-stub. Forge `<project>-ops`, `-overview`, `-commands`. Tests: planted finding lands, think-dump rejected, truncation rejected, citations valid.
4. **CLI collapse + cut list.** One `llama-smith <repo>` entry, no verb; delete dashboard/vibe/gotcha/consensus; update README.
5. **Harness as suite.** Wire the recorded fixtures into `node --test`.

## Risks and open questions

- **Crowded field.** sentinel/repowise/skilgen are ahead on build-out. The bet is that a narrow, verifiable, ops-focused forge with visibly better judgment beats a broad me-too. If the ops read is not consistently sharper than the crowd's generic "pitfalls," the wedge is weak.
- **Ops read depth.** The deploy-race catch was excellent; it must be reproducible across stacks (npm, PyPI, Docker, k8s), not a one-off. Worth probing more repos.
- **Static skills vs MCP trend.** The market is trending to MCP servers and live queries. Static `.claude/skills/` is correct for Claude Code today but may date; noted, not addressed in v1.

---

## Agreed evolution (2026-05-29)

Decisions made after validating the tool live on 10 real repos (5 famous, 5 random low-star). The throwaway harness (`scripts/probe.mjs`, `scripts/report.mjs`, `scripts/forge-skill.mjs`, `scripts/serve.mjs`) proved each of these and stays as a regression/demo asset.

### 1. Swarm + Oracle (multi-model, picked from observed latency/quality)

The scan is a swarm of cheap, fast investigators; a single strong model validates. Picks are grounded in real runs this session:

| Role | Models | Why |
|---|---|---|
| **Investigators** (cast the net) | `glm-5.1:cloud` (deploy, ~5–13s, sharp), `deepseek-v4-flash:cloud` (~18–38s), `qwen3.5:cloud` (thorough) | Fast + diverse; each lane a different job. |
| **Oracle** (the single judge) | `kimi-k2.6:cloud` (1T) | Re-reads every finding against its cited file and kills anything unsupported. High recall from the swarm, high precision from the Oracle. |

This realises the roadmap's "Reality Check / Oracle" as a v1.x stage. Drop a finding the Oracle can't tie to its file.

### 2. Comprehensive, self-learning forge — `<project>-smith`

The forge is **deterministic rendering of cited findings**, not a second LLM guess (the model produced the findings; the forge only structures them, so nothing is hallucinated at forge time). Reference implementation: `scripts/forge-skill.mjs` → `buildSkill()`. It emits an Anthropic skill-creator-format `SKILL.md` (60–95 lines on real repos): trigger-rich frontmatter `description`, *When to use*, *What you most need to know*, sectioned cited findings (deploy / CI / cron / secret), fragility map (code-only hotspots), churn-discipline note, honest `unknown` for un-extracted commands, operating rules, and a self-learning *Lessons* section. Skill name is **`<project>-smith`** (project-scoped so each repo's skill is distinct; Matrix flavour). The old `<project>-devops` template forge is replaced.

### 3. Self-learning loop

Pattern adopted from the established append-log + confidence-graduation design (verified against the OSS ecosystem; star counts in that research were unverifiable — the *pattern* is what we copy, not any one repo):

```
.smith/lessons.jsonl   append-only: every correction / mined observation, raw
        │  dedup + Bayesian confidence update on read
        ▼
.smith/instincts.yaml  deduped, confidence-ranked, project-scoped
        │  only confidence > 0.7 graduates
        ▼
<project>-smith/SKILL.md   regenerated = findings + graduated lessons
```

- Explicit **corrections** enter HIGH ("correct once, never again"); **mined observations** enter LOW and graduate at >0.7.
- **Project-scoped** — one repo's lessons never bleed into another's.
- Contradicted lessons decay and drop, so the skill can't rot; atomic one-lesson-per-entry caps bloat; everything in git for rollback.
- Builds on the existing `lib/lessons.mjs` / `lessonsFor` wiring. A post-session hook feeds `lessons.jsonl`.

### 4. Editorial voice

Forge prose follows the sonto-news DETOX rules: name the fact first, no hedging, no setup, ban filler words / X-not-Y / em-dash overuse / tricolon abuse. The dashboard's "Glitch Feed" hooks demonstrate the target voice.
