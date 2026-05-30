---
description: Scan only what a PR or branch changed and report new operational findings
argument-hint: "<path-to-repo> [--base <ref>] [--head <ref>] [--local]"
---

Run an incremental scan over a diff range and report findings only for the changed files — fast enough for a pre-merge check.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/llama-smith.mjs" diff $ARGUMENTS
```

The default range is `HEAD~1...HEAD`. After it runs, list the changed files and any new findings (by Smith and severity, with the cited file). Report only what the tool output — never invent findings. Results are written to `<repo>/.smith/pr-findings.json`.
