---
description: Forge a self-learning ops co-pilot skill for a repo (swarm → Oracle → <repo>-smith)
argument-hint: "<path-to-repo> [--scan-only] [--rounds N] [--local] [--no-oracle] [--json]"
---

Run **llama-smith** against the target repository, then report what it found and forged.

Requirements: Node 20+ and Ollama running (cloud models by default; pass `--local` to use local models). No other dependencies.

Run this command (it can take a few minutes — a multi-round swarm plus Oracle validation):

```bash
node "${CLAUDE_PLUGIN_ROOT}/llama-smith.mjs" $ARGUMENTS
```

It writes, into the target repo:
- `.claude/skills/<repo>-smith/` — the forged skill: `SKILL.md` + `references/*.md` (one per Smith) + a self-learning `lessons.md`
- `.smith/findings.json` — every operational finding, cited to a file

After it runs, summarize for the user: the operational findings grouped by Smith (deploy / secret / cron), how many the Oracle dropped (and why, if shown), the code-only churn hotspots, and the path to the forged skill folder. Do not invent findings — report only what the tool output.

To teach the skill from a correction (self-learning loop — applied to the next forge at HIGH confidence):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lesson.mjs" <path-to-repo> "deploy from production, not main"
```

The forged `<repo>-smith` skill is a normal Claude Code project skill — once written into a repo's `.claude/skills/`, open Claude Code in that repo and it activates from its description (or invoke it).
