# llama-smith

**Repo forensics in. Claude Code skill out.**

Point it at a repo. A swarm of Ollama "Smiths" reads how the project actually works, finds the scars, and forges Claude Code skills from what they learn — so a fresh Claude acts like it has worked there for a year.

It looks like a co-pilot generator. Underneath it's reconnaissance.

```
Smiths map the codebase.
The Operator forges the skill.
Next run starts with: "I know this repo."
```

## What it does

- **The Brain** — detects a repo's infra and decides which `smith-*` skills it needs, each backed by a real file. Output: `.smith/manifest.json`.
- **The Forge** — writes each skill, grounded in the cited files. It never invents a command; if it can't find a source it writes "unknown".
- **Memory Matrix** — mines your own Claude Code session transcripts for battle-tested lessons ("deploy from `production`, not `main`"), each stamped with when you learned it, and folds them into the forged skills.
- **Gotcha feed** — the 3 most surprising-but-true facts about the repo, clickbait hook + hard fact.
- **The Construct** — a dashboard with a 0–100 vibe check across Safety, Runtime, Fragility, and Hygiene.

## Usage

```bash
node cli-brain.mjs   scan   <repo>     # detect infra → manifest + gotcha feed
node cli-forge.mjs   forge  <repo>     # write the smith-* skills into <repo>/.claude/skills/
node cli-lessons.mjs lessons <repo>    # mine your sessions → .smith/lessons.json
node cli-dashboard.mjs dashboard <repo> [repo...]   # build + open The Construct
```

Cloud models are primary; pass `--local` to use local Ollama models.

## Engine

Built on Ollama, dispatched the same way as [llama-review](https://github.com/artttj/llama-review). Zero dependencies — Node 20+ and `node --test`.

## Boundaries

Run it on repos you own or are authorized on. It references secrets by name, never by value. It never acts on production on its own.

## Status

Brain, Forge, Memory Matrix, gotcha feed, vibe-check, and the dashboard work today. Reality Check (live probes) and the Oracle Loop (skills that rewrite themselves from your corrections) are next. See `ROADMAP.md`.
