# llama-smith

![license MIT](https://img.shields.io/badge/license-MIT-3ddc84)
![node 20+](https://img.shields.io/badge/node-20%2B-3ddc84)
![zero dependencies](https://img.shields.io/badge/dependencies-0-3ddc84)
![tests](https://img.shields.io/badge/tests-node--test-3ddc84)
![runs on Ollama](https://img.shields.io/badge/runs%20on-Ollama-3ddc84)

Point it at a repo. A swarm of Ollama models maps how the project is built — its architecture, modules, and data flow — and how it deploys, leaks, and breaks, then forges a Claude Code skill from what they can prove. The next agent that opens the repo acts like it has worked there for a year.

Models run through your own Ollama. Cloud models by default; `--local` keeps everything on your machine.

```
Many Smiths enter.
One skill comes out.
```

## What it actually does

Most "repo to AI context" tools summarize what the code *is* and stop there. llama-smith builds the project's map and grounds every line in a file: what the app is and how data moves through it, the deploy that SSHes into a hardcoded IP, the release that publishes on any tag with no gate, the files only one person understands. The stuff nobody writes down (yes, including this README).

Four things happen when you run it.

1. **The swarm reads the repo.** An architecture Smith maps what the app is, its modules, data flow, data model, and entrypoints. Three more look at CI, deploy scripts, compose files, and cron config, one each for deploy/rollback, secrets, and jobs. A single pass is moody, so the ops Smiths run a couple of rounds and union the results.
2. **The Oracle checks their work.** A stronger model re-reads every claim against the file it cites and drops anything the file does not support. It caught the swarm claiming "previous image versions are lost" when the workflow also pushes a content-hash tag, so they aren't. Architecture claims go through the same gate, and an uncited claim never survives.
3. **Deterministic extractors fill in the facts.** No model touches these: the stack and entrypoints from manifests, the real build/test/deploy commands from `package.json` and CI, the do-not-touch boundaries (lockfiles, generated dirs, `.env`), the churn hotspots, and the git forensics — bus factor and single-owner files.
4. **The forge writes the skill.** A deterministic step turns the surviving, cited material into a `<repo>-smith/` folder. No model writes the skill, so the skill can't hallucinate.

## What you get

A skill folder, architecture-first:

```
<repo>-smith/
├── SKILL.md                       what to read first, and when
├── references/
│   ├── architecture.md            what the app is, modules, data flow, data model
│   ├── deploy.md / jobs.md / secrets.md   operational risk, by Smith
│   ├── fragility.md               churn hotspots, single-owner ones flagged
│   ├── forensics.md               bus factor, single-owner files, module ownership
│   ├── commands.md                real build/test/deploy commands, cited
│   └── boundaries.md              files an agent must not hand-edit, and why
├── memory.md                      long-term memory, grows as you correct it
└── AGENTS.md                      the same map for opencode, Cursor, and Codex
```

The `AGENTS.md` is the cross-tool version: a single thorough file so anyone on opencode or Cursor gets the same architecture-first map, not just Claude Code.

## Dashboard

Generate a forensic HTML dashboard to browse scan results across repos:

```bash
node scripts/report.mjs /path/to/results.json ./reports
```

The dashboard shows:
- **Repo grades** (A-F) based on validated risks, architecture coverage, and ownership concentration
- **Findings by severity** — high, medium, and low, with file path citations
- **Architecture coverage** — how well the Smiths mapped the codebase
- **Ownership risk** — bus factor and single-owner files
- **Forged skills** — the Claude-ready output with claim counts and validation status

Colors are semantic: green for validated/success, red for high severity, amber for warning, cyan for technical metadata. The design prioritizes scan results over atmosphere — content sits on clean dark panels with strong contrast and readable typography.

## Install (Claude Code plugin)

```
/plugin marketplace add artttj/llama-smith
/plugin install llama-smith@llama-smith
```

Then point it at a repo:

```
/llama-smith ./path/to/repo
```

You need Node 20+ and Ollama running. Cloud models by default; add `--local` to keep everything on your machine.

In cloud mode the swarm sends file contents to your cloud Ollama, including config and `.env` files the secret Smith reads. Run it only on repos you own or are authorized to scan, and use `--local` when the contents must not leave your machine.

Or skip the plugin and run it directly:

```bash
node llama-smith.mjs ./repo                # scan, validate, forge the skill
node llama-smith.mjs ./repo --scan-only    # findings only, write no skill
node llama-smith.mjs ./repo --local        # local Ollama models
node llama-smith.mjs ./repo --rounds 3     # more recall, more time
```

It writes the skill into `<repo>/.claude/skills/<repo>-smith/` and the raw findings into `<repo>/.smith/findings.json`. Open Claude Code in that repo and the skill shows up on its own.

## It learns

When the agent gets something wrong and you correct it, tell the skill:

```bash
node scripts/lesson.mjs ./repo "deploy from production, not main"
```

The **Self-Improvement Oracle** takes that lesson in at high confidence and folds it into `memory.md` on the next run. Corrections are kept per repo, so one project's scar tissue never leaks into another's. Observations mined from past sessions enter low and only stick if they keep showing up.

## Under the hood

Zero dependencies. Node 20+ and `node --test`. A thin CLI over a few small modules: the swarm and architecture Smith (`lib/scan.mjs`), the Oracle (`lib/oracle.mjs`), the deterministic extractors (`lib/project.mjs`, `lib/commands.mjs`), the git forensics (`lib/forensics.mjs`, `lib/churn.mjs`), the forge (`lib/skill.mjs`), and the lessons store. Built on Ollama, dispatched the same way as [llama-review](https://github.com/artttj/llama-review).

## Honest limits

- It's only as good as the models. The ops swarm is stochastic, which is why it runs rounds, and a fully reworded duplicate finding can still slip past the dedup.
- The Oracle fixes false positives, not false negatives. If no Smith looks at a file, nothing catches what it missed.
- Forensics read git authorship. They surface real contributor names from history and need a few months of commits to mean anything.
- Run it on repos you own or are cleared to scan. It names secrets by location, never by value, and it never touches production on its own.

## Status

Working today: the architecture Smith, the ops swarm, the Oracle, the deterministic extractors, the git forensics, the multi-file forge, the `AGENTS.md` output, the self-learning memory, and a forensic dashboard for browsing results across repos. Next on my list is smarter dedup (the current word-overlap trick is fine, not clever) and a deeper deploy read across more stacks.
