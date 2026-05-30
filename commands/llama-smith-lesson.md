---
description: Teach a forged skill a correction; the Self-Learning Memory folds it in on the next run
argument-hint: "<path-to-repo> \"<lesson, e.g. deploy from production not main>\""
---

Record a correction for a repo's forged skill. The **Self-Learning Memory** takes it in at high confidence and folds it into `memory.md` on the next run. Corrections are kept per repo, so one project's scar tissue never leaks into another's.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lesson.mjs" $ARGUMENTS
```

After it runs, confirm which repo the lesson was saved to and how many lessons that repo now holds. Pass through exactly what the user said — never invent or reword the lesson.
