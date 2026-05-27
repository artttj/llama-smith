# llama-smith — Roadmap

Matrix-named feature map. Each name does one job. Built on the Brain + Forge + gotcha feed already shipped.

## Already shipped (the spine)
- **The Brain** — detects infra, decides which `smith-*` skills a repo needs → `.smith/manifest.json`. (branch `brain`)
- **The Forge / Operator** — writes each skill grounded in real files, cites sources, never invents. (branch `forge`)
- **Gotcha feed** — `glm-5.1:cloud` finds the top-3 surprising-but-true facts, short + humanized, in the scan window. (branch `gotchas`)

## Core (the wow-engine)
- **Memory Matrix** — mine this repo's own Claude Code + OpenCode session transcripts (`~/.claude/projects/<slug>/*.jsonl`, OpenCode `storage/`) for lessons: every "use X not Y", every facepalm, every fix. The depth the file-scan can't reach. *Status: not built.*
- **Reality Check** — opt-in active probes: ssh in, `docker compose ps`, real row counts, what cron *actually ran* vs scheduled. Runtime truth, not file guesses. *Status: not built.*
- **Oracle Loop** — correct a forged skill once, Smith reflects and rewrites its own `SKILL.md`. Self-evolution. *Status: not built.*

## Surface (what you see)
- **The Construct** — Matrix HTML dashboard: all repos, skills, gotchas, exposure, bus-factor. Opens in browser. *Status: generator written (`lib/dashboard.mjs`), needs wiring + open.*
- **Glitch Radar** — rank gotchas by *days until it bites* (churn + schedule): "the Friday cron misfires on next cutover." Predictive, not descriptive. *Status: not built.*
- **Blast Radius** — for the one fragile point/secret, show what it takes down (dependency fan-in). Visual. *Status: not built.*

## Advanced (power moves)
- **Smith Swarm** — the 10-agent `ollama launch claude` deep-recon, and/or point it at all repos at once → one mega-dashboard ranking the scariest. Maxes the $80 stack. *Status: not built.*
- **Agent Duel** — two models forge the same skill, a third judges/merges. Anti-hallucination by adversarial agreement. *Status: not built.*
- **Skill Drop** — Smith opens a PR adding the `smith-*` skills, gotchas as the PR description. Ships itself. *Status: not built.*
- **The Operator** — load the forged skills + lessons, then *talk to the repo*: "how do I deploy?" answered by the repo's resident expert. The endgame. *Status: lore exists (the forge persona); the conversational layer not built.* **(needs your confirm — see below)**

## One thing to disambiguate
**The Operator** has two readings: (a) the forge/dispatcher persona we already use for writing skills, or (b) a new conversational layer — load the skills and chat with the repo. I read it as (b), the endgame "talk to the repo." Confirm?

## Suggested build order
Core first (they compound the wow): **Memory Matrix → Reality Check → Oracle Loop**. Surface in parallel (cheap, visual): finish **The Construct** now. Advanced last (Swarm, Duel, Skill Drop, Operator) once Core proves out.
