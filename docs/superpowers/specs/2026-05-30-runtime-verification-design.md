# Design: Runtime Verification — read-only reality check

**Date:** 2026-05-30
**Feature:** Probe a running app with read-only checks and feed the result into the `runtime` vibe dimension (10x idea #7)
**Effort:** Medium-High
**Scope:** A new opt-in `verify` path that runs side-effect-free probes and writes results to `.smith/` only

---

## Safety invariants (the spine — read this first)

This feature touches a *running* system, so three invariants govern every design
decision below. They are non-negotiable and they align with the skill's own
Operating Rule at `lib/skill.mjs:97`: "Never act on production on your own.
Production steps need explicit approval."

1. **Read-only / side-effect-free.** No probe may mutate state, trigger a job,
   POST/PUT/PATCH/DELETE, run a migration, or write anywhere outside `.smith/`.
   The only HTTP method allowed is `GET` (and `HEAD`). The only filesystem write
   is `.smith/runtime.json`.
2. **Opt-in only.** Verification never runs as part of `run`/`scan`. It runs only
   when the user explicitly asks for it (`verify` verb or `--verify` flag) *and*
   a `.smith/probes.json` the user authored exists. No config → no probes → no
   network. There is no auto-discovery of endpoints to probe.
3. **Bounded and allowlisted.** Only four probe types exist (below). Each has a
   hard timeout, targets only hosts the user declared, and a `--dry-run` mode
   prints exactly what *would* be probed without opening a socket.

Everything else in this spec exists to enforce these three.

---

## Problem

Operational findings today are theoretical. The deploy/secret/cron Smiths read
code and say "this deploy script looks dangerous" or "this env var is referenced
but not in `.env.example`." None of it answers the only question an operator
actually cares about: *is it actually broken right now?*

The codebase already anticipated this. The `runtime` vibe dimension and its
plumbing exist but are dead:

- `lib/vibe.mjs:19` — the signature accepts the inputs:
  `export function vibeScore(manifest, { lessons = [], runtimeVerified = false, runtimePenalty = 0 } = {})`
- `lib/vibe.mjs:33` — the one line that would make `runtime` real:
  `if (runtimeVerified) dims.runtime = Math.max(0, 25 - runtimePenalty)`
- The dimension is seeded at a flat 25 (`lib/vibe.mjs:20`:
  `const dims = { safety: 25, runtime: 25, fragility: 25, hygiene: 25 }`).

Because `runtimeVerified` defaults to `false` and **no caller anywhere passes it
`true`**, line 33 never executes. A grep across `lib/`, `scripts/`, and
`llama-smith.mjs` finds exactly one other reference: `lib/dashboard.mjs:28`,
which reads the flag only to grey the bar out:

```js
const grey = k === 'runtime' && !v.runtimeVerified
```

So the runtime bar renders permanently as a greyed, unearned 25 with a `?`, and
the dashboard help text at `lib/dashboard.mjs:10` literally promises the missing
feature: `'is it actually alive — needs Reality Check to verify'`. The contract
is even tested already — `test/vibe.test.mjs:27-31` proves that *if* a caller
passes `{ runtimeVerified: true, runtimePenalty: 19 }`, `dims.runtime` correctly
collapses to 6. There is a tested receiver with no producer. This feature builds
the producer.

## Solution

A new module `lib/probes.mjs` runs a small, fixed set of read-only probes against
targets the user declares in `.smith/probes.json`, scores the results into a
`runtimePenalty`, and sets `runtimeVerified = true`. A thin `verify` verb (or
`--verify` flag) on the CLI is the only way to trigger it. The probe results are
written to `.smith/runtime.json` and threaded into `vibeScore` so the `runtime`
bar stops being grey and starts reflecting reality. Probe outcomes also mark
matching operational findings as `confirmed live` vs `theoretical`.

---

## Architecture

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Probe runner | `lib/probes.mjs` (new) | Pure orchestration: take a config + an injected probe executor, return results. No I/O of its own. |
| Probe executors | `lib/probes.mjs` (new) | The four read-only executors (HTTP GET, TCP connect, env presence, cron recency). Each strictly read-only. |
| Config loader | `lib/probes.mjs` (new) | Read + validate `.smith/probes.json`. Reject anything not on the allowlist. |
| Scorer | `lib/probes.mjs` (new) | Map probe results → `{ runtimeVerified, runtimePenalty }` and tag findings. |
| Vibe wiring | `lib/vibe.mjs:19,33` (existing) | Already accepts `runtimeVerified` + `runtimePenalty`. No change to its logic — only its callers start passing real values. |
| CLI entry | `llama-smith.mjs:12,14-29,32-51` (existing) | Add `verify` verb + `--verify`/`--dry-run` flags; call the runner. |
| Persistence | `.smith/runtime.json` (new artifact) | Last probe run: per-probe status, latency, scored penalty, timestamp. The only write target. |
| Dashboard | `lib/dashboard.mjs:10,28` (existing) | Bar un-greys once `runtimeVerified` is true; help text already written for this. |

### Data flow

1. User authors `.smith/probes.json` declaring what to probe (see Config model).
2. User runs `node llama-smith.mjs verify <repo>` (or `run --verify`).
3. The config loader reads and validates the file. Unknown probe `type`, a
   non-GET HTTP method, or a missing config → the run aborts with a clear message
   and opens no sockets.
4. The runner executes each allowlisted probe with its timeout, collecting
   `{ id, type, target, status: 'pass' | 'fail' | 'skip', detail, ms }`.
5. The scorer turns failures into a `runtimePenalty` and sets
   `runtimeVerified = true` (the run *happened*, regardless of pass/fail).
6. Results are written to `.smith/runtime.json`.
7. The findings that a probe maps to are tagged `confirmed live` (a probe failed
   and corroborates the finding) or left `theoretical` (no probe covers it).
8. `vibeScore(manifest, { ..., runtimeVerified, runtimePenalty })` is called with
   the real values; the dashboard bar earns its number.

---

## The read-only probe set (the allowlist)

Exactly four probe types. The set is closed — adding a fifth is a deliberate
spec change, not config. Each probe is read-only by construction, not by
convention.

### 1. `health` — HTTP health endpoint (GET only)

Issue a single `GET` (or `HEAD`) to a URL the user declared, e.g.
`http://localhost:3000/health`. Pass if the status is in the user's expected set
(default `[200]`). The HTTP method is hard-coded to `GET`/`HEAD` in the executor;
the config cannot supply a method, a body, or headers that carry state-changing
intent. No redirects are followed to a different origin. This is the probe the
10x doc names as the starting point ("start with read-only health probes").

*Read-only guarantee:* `GET`/`HEAD` are defined as safe/idempotent by HTTP
semantics; the executor refuses any other verb and sends no request body.

### 2. `tcp` — TCP connectivity check

Open a TCP socket to `host:port` (e.g. a Postgres or Redis port the user
declared), confirm the connection establishes, then immediately close it. Pass =
connection accepted within the timeout. We send **zero application bytes** — no
auth handshake, no query, no protocol negotiation. This verifies the port is
listening, nothing more. It is the safe substitute for "verify DB connectivity":
we confirm reachability, we never log in or query.

*Read-only guarantee:* connect-then-close writes no application data; the remote
sees a dropped connection, identical to a port scan with no payload.

### 3. `env` — env-var presence / resolution

Check that named environment variables are present and non-empty in the verifying
process's environment (or in a user-pointed env file inside the repo, read-only).
Pass = every required name resolves to a non-empty value. We report only
**presence and length**, never the value — values never enter `.smith/runtime.json`
or any log. This derives from what the secret Smith and `detectBoundaries`
(`lib/project.mjs:120-129`, which flags `.env`) already know the app expects.

*Read-only guarantee:* reads `process.env` / a file; writes nothing; never emits
a secret value.

### 4. `cron` — last-run recency

For a declared cron/job, check a freshness signal the user points at: the mtime
of a heartbeat/log file, or a `lastRun` timestamp in a user-named JSON file. Pass
= the signal is newer than the declared `maxAgeMinutes`. We never *trigger* the
job — we only read evidence that it ran. The job inventory comes from what the
cron Smith already surfaces; this probe confirms recency.

*Read-only guarantee:* `stat()` / read of a file the user named; never invokes a
scheduler or runs the job.

### Mapping probes to findings: confirmed live vs theoretical

A probe optionally carries a `finding` selector (`{ smith, file }` or a finding
id). When a probe **fails** and matches a finding, that finding is tagged
`confirmed live` — the scary-looking code is now corroborated by a live failure
("the deploy health endpoint is actually 500ing"). When a probe **passes** and
matches a finding, the finding is tagged `runtime-clear` (looks scary, runs
fine). Findings with no probe stay `theoretical` — the honest default. The tag
is advisory metadata on the finding object; it never deletes or rewrites a
finding (the Oracle owns truth about whether a finding is *supported*; probes
only add a runtime observation on top).

### Scoring into the runtime dimension

The scorer maps results to a penalty against the 25-point `runtime` budget:

- A failed `health` probe is the strongest signal: high penalty (e.g. 12).
- A failed `tcp` probe: medium (e.g. 8).
- A failed `env` probe: medium (e.g. 6).
- A stale `cron` probe: low (e.g. 4).
- Penalties sum and clamp so `25 - runtimePenalty` floors at 0 (matching the
  existing `Math.max(0, ...)` at `lib/vibe.mjs:33`).

`runtimeVerified` is set to `true` whenever a verify run completes — even if
everything passes (a verified-healthy runtime is 25/25, no longer greyed). The
exact penalty weights are tunable constants in `lib/probes.mjs`; the contract
(`runtimeVerified` boolean + integer `runtimePenalty`) is what `vibeScore`
consumes and what `test/vibe.test.mjs:30` already pins.

---

## Config model

The user declares targets in `.smith/probes.json`. This file is the *only* source
of probe targets — there is no auto-discovery. Its presence is also the second
half of opt-in: even with `--verify`, no config means no probes.

```json
{
  "version": 1,
  "probes": [
    { "id": "web-health", "type": "health", "url": "http://localhost:3000/health", "expect": [200], "timeoutMs": 3000,
      "finding": { "smith": "deploy", "file": ".github/workflows/deploy.yml" } },
    { "id": "db-port", "type": "tcp", "host": "127.0.0.1", "port": 5432, "timeoutMs": 2000 },
    { "id": "env-present", "type": "env", "require": ["DATABASE_URL", "SESSION_SECRET"] },
    { "id": "nightly-job", "type": "cron", "evidenceFile": "var/log/nightly.heartbeat", "maxAgeMinutes": 1500 }
  ]
}
```

Validation rules (enforced by the loader, fail-closed):

- `type` must be one of `health | tcp | env | cron`. Anything else → reject the
  whole run.
- `health.url` must be `http`/`https`; no method field is accepted (GET is forced).
- `host`/`url` targets are taken as-is from the user — the user owns the decision
  of *what* to point at. The tool only guarantees it won't do anything but read.
- `timeoutMs` defaults per type and is capped (e.g. 10s) so a probe can't hang.
- Any path (`evidenceFile`) is resolved inside the repo root; `..` escapes are
  rejected.

### Flags

- `verify` verb — `node llama-smith.mjs verify <repo>` runs only the probes
  (reads existing `findings.json`, does not re-run the swarm).
- `--verify` flag on `run` — run the normal pipeline, then probe, in one pass.
- `--dry-run` — print the resolved probe plan (id, type, target, timeout) and
  exit without opening any socket or reading any env. The honest preview.

`verify` joins `VERBS` at `llama-smith.mjs:12`; the flags join `parseArgs`
(`llama-smith.mjs:14-29`).

---

## Safety section

### Threat model — what could go wrong

| Risk | Mitigation |
|------|------------|
| A probe mutates prod (triggers a job, deletes data) | Method allowlist: only GET/HEAD over HTTP; TCP sends zero bytes; cron only reads evidence. No verb/body/query is ever configurable. |
| Verification runs by accident in CI / a default scan | Double opt-in: explicit `verify`/`--verify` **and** a hand-authored `.smith/probes.json`. Neither alone runs anything. |
| A secret value leaks into `.smith/runtime.json` or logs | `env` probe records presence + length only, never the value. Results schema has no value field. |
| A probe hangs and blocks the run | Per-probe `timeoutMs`, capped; a timed-out probe is a `fail`, not a hang. |
| Path traversal via `evidenceFile` | Resolve inside repo root; reject `..`. |
| User points a probe at the wrong (production) host | `--dry-run` shows the exact plan first; the user owns target selection, the tool owns "read-only only". Documented loudly. |
| Following a redirect to a state-changing URL | No cross-origin redirect following on the `health` probe. |

### Guardrails that enforce read-only

- The HTTP executor is constructed with a fixed `method: 'GET'` (or `HEAD`); the
  config schema has no `method`, `body`, or `data` field, so there is no path to
  a non-GET request.
- The TCP executor calls connect then `socket.destroy()` with no `write()`.
- The env executor returns `{ name, present: boolean, length: number }` — the
  value is never read into the result object.
- The only filesystem write in the whole feature is `.smith/runtime.json`.
- `--dry-run` is the proof: it exercises the full config + plan path with the
  network/env/file steps stubbed out, so a user can audit intent risk-free.

---

## Testing

| Test | Location | What it checks |
|------|----------|---------------|
| Scorer maps failures to penalty | `test/probes.test.mjs` (new) | Injected results → expected `{ runtimeVerified: true, runtimePenalty }`. |
| All-pass run verifies at full marks | `test/probes.test.mjs` | All-pass → `runtimeVerified: true, runtimePenalty: 0`. |
| Config loader rejects unknown type | `test/probes.test.mjs` | A probe with `type: "delete"` aborts the run, opens nothing. |
| Config loader rejects HTTP method override | `test/probes.test.mjs` | A `method` field is ignored/rejected; GET is forced. |
| env probe never emits values | `test/probes.test.mjs` | Result objects contain `present`/`length`, never the value. |
| health probe against a mock local server | `test/probes.test.mjs` | Spin up a `node:http` server on `127.0.0.1:0`, GET `/health`, assert pass on 200 / fail on 500. Never touches a real or prod host. |
| dry-run opens no socket | `test/probes.test.mjs` | With executors spied, `--dry-run` calls none of them. |
| findings tagged confirmed-live on failure | `test/probes.test.mjs` | A failed probe with a `finding` selector tags the matching finding. |
| vibe consumes real values | `test/vibe.test.mjs:27-31` (existing) | Already passes — proves the receiver. The new tests prove the producer. |

The probe **runner and scorer are pure** (config + injected executor results in,
verdict out), so the bulk of coverage is fast unit tests with hand-built results.
The single live test uses a mock `node:http` server on an ephemeral localhost
port. **Tests never probe a real or production system.**

---

## Risks + non-goals

### Risks

- **Mis-targeted probes.** The user could point `health` at production. We
  guarantee read-only, not that the user picked the right host. `--dry-run` and
  documentation are the mitigation.
- **Penalty weight tuning.** Initial weights are guesses; they live as constants
  and can be tuned without touching the contract.
- **Partial environments.** Many repos won't have a runtime to probe. That is
  fine — no config means the bar stays honestly grey, exactly as today.

### Non-goals (explicit)

- **No writes** anywhere except `.smith/runtime.json`.
- **No production actions** — no deploys, no job triggers, no migrations.
- **No auto-remediation** — probes observe; they never fix.
- **No auto-discovery** of endpoints or services to probe. The user declares
  every target.
- **No authenticated/stateful protocol probing** — TCP confirms a port listens;
  it does not log into the database or run a query.
- **No continuous/daemon probing** — this is a one-shot, opt-in run. (Continuous
  monitoring is 10x idea #1, out of scope here.)

---

## Open Questions

- Should a failed `verify` run set a non-zero exit code (useful for a manual
  post-deploy gate) or always exit 0? Leaning exit 0 by default with an opt-in
  `--strict` for the gate use case.
- Where should `.smith/runtime.json` surface in the per-repo report page — under
  the vibe block, or as its own "Reality Check" section? Defer to the report
  pass.

---

## Success Criteria

- [ ] With a valid `.smith/probes.json`, `verify` runs only read-only probes and
      writes only `.smith/runtime.json`.
- [ ] `vibeScore` receives real `runtimeVerified` + `runtimePenalty`; the runtime
      bar in the dashboard stops being greyed and reflects probe outcomes.
- [ ] No probe can be configured to issue a non-GET request, send TCP payload
      bytes, run a job, or emit a secret value.
- [ ] `--dry-run` prints the plan and opens nothing.
- [ ] Without `--verify`/`verify` or without a config file, nothing is probed.
- [ ] All new logic covered by unit tests; the one live test uses a mock local
      server, never a real system.
