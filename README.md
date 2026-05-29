# llama-smith

Point it at a repo. A swarm of Ollama models reads how the project actually deploys, leaks, and breaks, then writes a Claude Code skill from what they can prove. The next Claude that opens the repo already knows where the bodies are buried.

Models run through your own Ollama. Cloud models by default; `--local` keeps everything on your machine.

It reads your ops, not your vibes.

```
Many Smiths enter.
One skill comes out.
```

## What it actually does

Most "repo to AI context" tools summarize what the code *is*. llama-smith cares about how it *runs*: the deploy that SSHes into a hardcoded IP, the release that publishes on any tag with no gate, the cron that pipes its errors to `/dev/null`. The stuff nobody writes in the README (yes, including this one).

Three things happen when you run it.

1. **The swarm reads the repo.** Three Ollama models look at CI, deploy scripts, compose files, and cron config at the same time, one each for deploy/rollback, secrets, and background jobs. A single pass is moody, so it runs a couple of rounds and unions the results.
2. **The Oracle checks their work.** A stronger model re-reads every finding against the file it cites and throws out anything the file doesn't actually support. On real repos it has caught the swarm overstating things. One example: "previous image versions are lost", except the workflow also pushes a content-hash tag, so they aren't. Dropped.
3. **The forge writes the skill.** A deterministic step turns the surviving, cited findings into a `<repo>-smith/` folder: a `SKILL.md`, one reference file per Smith, and a `lessons.md` that grows as you correct it. No model writes the skill, so the skill can't hallucinate. It only contains findings that survived the Oracle.

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

That lesson enters at high confidence and gets folded into `lessons.md` on the next run. Corrections are kept per repo, so one project's scar tissue never leaks into another's. Observations mined from past sessions enter low and only stick if they keep showing up.

## Under the hood

Zero dependencies. Node 20+ and `node --test`. The whole thing is a thin CLI over a few small modules: the swarm (`lib/scan.mjs`), the Oracle (`lib/oracle.mjs`), the forge (`lib/skill.mjs`), the code-only churn map (`lib/churn.mjs`), and the lessons store. Built on Ollama, dispatched the same way as [llama-review](https://github.com/artttj/llama-review).

## Honest limits

- It's only as good as the models. The swarm is stochastic, which is why it runs rounds, and a fully reworded duplicate finding can still slip past the dedup.
- The Oracle fixes false positives, not false negatives. If no Smith looks at a file, nothing catches what it missed.
- Run it on repos you own or are cleared to scan. It names secrets by location, never by value, and it never touches production on its own.

## Status

Working today: the swarm, the Oracle, the multi-file forge, the self-learning lessons, and a Matrix-flavored dashboard for browsing results across repos. Next on my list is smarter dedup (the current word-overlap trick is fine, not clever) and a deeper deploy read across more stacks.
