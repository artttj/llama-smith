---
description: Build and serve the forensic dashboard of every scanned repo on localhost
argument-hint: "[--port N] [--open] [--no-serve]"
---

Build the self-contained HTML dashboard from existing scan results and serve it on localhost (default port 7777).

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/llama-smith.mjs" serve $ARGUMENTS
```

It rebuilds `reports/` and starts a local server. Give the user the URL it prints (for example http://localhost:7777). `--open` opens a browser; `--no-serve` only writes the HTML and exits.
