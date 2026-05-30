# Design: Interactive Query Interface — Local RAG Over Scanned Material

**Date:** 2026-05-30
**Feature:** Cited natural-language Q&A over the forged skill + `findings.json`
**Effort:** High
**Scope:** Local only (Ollama, zero new dependencies). CLI first; dashboard integration is out of scope for this spec.
**10x source:** Idea #2 — "start with a simple local chat using existing scanned material as RAG context."

---

## Problem

A forged skill is read-only markdown. `buildSkillFiles` (`lib/skill.mjs:185`) produces `SKILL.md`, `references/*.md`, `memory.md`, and `AGENTS.md`. Those files are already the best file-cited map of a repo we have, but the only way to use them is to read them top to bottom. There is no way to ask a question and get a scoped, cited answer.

The accumulated knowledge is structured — `lib/pipeline.mjs:136` persists `findings.json` as `{ project, sha, scannedAt, repoPath, stack, tech, architecture, opsFindings, hotspots, forensics, commands, entrypoints, boundaries }`, and every architecture fact, ops finding, and command already carries a `file` citation. The data is queryable; we just have not made it so.

The 10x analysis frames the gap as "the difference between having a document and having a teammate who read the document" (`.claude/docs/ai/llama-smith/10x/session-1.md:61`). This feature closes that gap: ask "What happens if I change the auth middleware?" and get an answer drawn from `references/architecture.md` plus the relevant findings, cited to files.

## Solution

A local retrieval-augmented chat scoped to one repo's scanned material. The corpus is the forged skill files plus `findings.json`. Questions are embedded with Ollama's `/api/embed`, matched against a small in-repo vector index by cosine similarity, and answered by a local chat model that is constrained to cite files from the retrieved context and to say "unknown" when the corpus does not cover the question.

This mirrors the project's existing ethos: the Oracle keeps only claims that cite a real file (`lib/pipeline.mjs:170-175`), and the skill's operating rules already state "every claim cites a file" (`lib/skill.mjs:99,102`). The query interface inherits that discipline — retrieval is the grounding, citation is mandatory, and absence of evidence produces "unknown," never a guess.

---

## Architecture

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Embedding client | `lib/embed.mjs` (new, **shared with #6**) | Zero-dep `/api/embed` caller over `node:http`, mirroring `lib/ollama.mjs` |
| Corpus + chunking | `lib/rag.mjs` (new) | Read skill files + `findings.json`, split into cited chunks |
| Vector store | `lib/rag.mjs` (new) | Build / read `.smith/index.json`; cosine top-k ranking |
| Answer prompt | `lib/rag.mjs` (new) | Constrained-answer prompt builder for the chat model |
| Query CLI | `scripts/ask.mjs` (new) | `node scripts/ask.mjs <repo> "question"` |

### Data flow

1. **Index build** (once per scan, or on demand): read the forged skill files under `.claude/skills/<name>/` and `<repo>/.smith/findings.json`, chunk them, embed each chunk via `lib/embed.mjs`, write `{ model, dim, builtAt, sha, chunks: [{ id, source, file, heading, text, vector }] }` to `<repo>/.smith/index.json`.
2. **Query:** embed the question with the same model → cosine-rank all chunk vectors → take top-k.
3. **Answer:** build a constrained prompt from the top-k chunks (each labeled with its source and cited file) → `dispatch` to a local chat model via `lib/ollama.mjs` → return the answer plus the list of cited files.
4. **Degraded:** if `.smith/index.json` is missing or stale relative to `findings.json`, rebuild before querying; if Ollama is unreachable, fail with a clear message (no fabricated answer).

---

## Corpus

The corpus is exactly the scanned material — nothing from the raw repo source is embedded, which keeps the index small and keeps every chunk traceable to a validated, cited claim.

Two sources, both already on disk after a scan:

1. **Forged skill files** — `SKILL.md`, `references/architecture.md`, `references/deploy.md`, `references/ci.md`, `references/jobs.md`, `references/secrets.md`, `references/fragility.md`, `references/forensics.md`, `references/commands.md`, `references/boundaries.md`, `memory.md`, `AGENTS.md`. These are markdown produced by `lib/skill.mjs`; `references/architecture.md` is the factual spine (`lib/skill.mjs:120`).
2. **`findings.json`** — the structured record at `<repo>/.smith/findings.json` (`lib/pipeline.mjs:138`). Its `architecture` (`{area, claim, file}`), `opsFindings` (`{severity, text, file, smith}`), and `commands` (`{cmd, raw, file, kind}`) entries are each already file-cited and become first-class chunks.

`AGENTS.md` largely restates the reference files (`lib/skill.mjs:158`). To avoid burying retrieval in near-duplicates, `AGENTS.md` is **excluded** from the corpus when the `references/*` files are present; it is only indexed for repos where the swarm produced no reference files. This is a corpus-construction choice, not semantic dedup — the embedding-based dedup work lives in #6.

### Why both the markdown and the JSON

The markdown carries prose framing and the operating rules an answer should respect ("never act on production on your own", `lib/skill.mjs:96-100`). The JSON carries the exact `file` citation per claim without the markdown's `_(← \`file\`)_` decoration (`lib/skill.mjs:16`), so chunks derived from JSON get a clean, machine-readable citation. Indexing both lets retrieval surface the prose and attach the precise citation.

---

## Chunking

Chunking is per cited unit, so a retrieved chunk maps to exactly one claim and one file wherever possible. No fixed-size token windows — the scanned material is already segmented into small, self-contained, file-cited units.

| Source | Chunk granularity | `file` citation | `heading` |
|--------|-------------------|-----------------|-----------|
| `findings.json` `architecture[]` | one chunk per `{area, claim, file}` | `claim.file` | the area title (`What it is`, `How data flows`, …) from `lib/skill.mjs:12` |
| `findings.json` `opsFindings[]` | one chunk per finding | `finding.file` | smith title (`Deploy & rollback`, `Secrets & exposure`, …) from `lib/skill.mjs:6-11` |
| `findings.json` `commands[]` | one chunk per command, text = `` `cmd` — raw `` | `command.file` | command group (`Build`, `Test`, …) from `lib/skill.mjs:13` |
| `references/*.md`, `SKILL.md`, `memory.md` | one chunk per `##` / `###` markdown section | parsed from the trailing `_(← \`file\`)_` citation in the section, when present; else `null` | the section heading text |

Splitting markdown on heading boundaries matches how `lib/skill.mjs` builds the files in the first place (`block(level, title, body)`, `lib/skill.mjs:19`), so chunk boundaries align with authored sections. A section longer than a soft cap (about 1200 characters) is split on blank lines into sub-chunks that inherit the parent heading and citation, so one giant section cannot dominate a single vector.

Forensics and fragility sections (`lib/skill.mjs:133-148`) cite multiple files in a list; those chunks keep `file: null` and instead carry the file paths inside their text so the answer model can quote them. The structured `findings.json` path is preferred for anything that has a single clean citation.

---

## Embedding & retrieval

### Shared embedding module (dependency on #6)

`lib/embed.mjs` is a new module that both #2 (this feature) and **#6 Semantic Dedup** depend on. It must be built once and shared — not duplicated. It mirrors `lib/ollama.mjs` exactly: raw `node:http` request to `OLLAMA_HOST`, no dependencies, a single retry, a timeout, and a parse-or-throw response handler.

Contract:

- `embed(text, { model, host })` → `Promise<number[]>` — one vector.
- `embedBatch(texts, { model, host })` → `Promise<number[][]>` — many vectors, sequential or small-concurrency, reusing the same lane discipline the swarm already relies on (`lib/pipeline.mjs:51-54`).
- `EMBED_MODEL` — a default embedding model name (e.g. `nomic-embed-text`), overridable by `OLLAMA_EMBED_MODEL`.
- Endpoint: `POST /api/embed` with `{ model, input }`; parse `embeddings` (or `embedding`) from the response; throw on `error`.

Calling this out explicitly so the two features land on one module: **#2 builds `lib/embed.mjs`; #6 reuses it for finding-to-finding similarity.** Neither feature should ship a second embedding caller.

### Vector store: in-repo JSON, zero-dep

No external vector database. The index is a plain JSON file at `<repo>/.smith/index.json`, written alongside the existing `findings.json`, `anomalies.json`, `scan-cache.json`, and `history` artifacts (`lib/pipeline.mjs:137-142`). Shape:

```json
{
  "model": "nomic-embed-text",
  "dim": 768,
  "builtAt": "2026-05-30T...",
  "sha": "<headSha at index time>",
  "chunks": [
    { "id": "arch-3", "source": "findings.architecture", "file": "src/app.ts", "heading": "How data flows", "text": "...", "vector": [ ... ] }
  ]
}
```

Retrieval is brute-force cosine over the in-memory array. For the scanned-material corpus this is small — tens to low hundreds of chunks per repo — so a linear scan is well within budget and needs no index structure. This is the same "stay zero-dep, keep it in `.smith/`" choice the rest of the pipeline makes; an external store would be the first dependency the project has ever taken, and the corpus size does not justify it.

`cosine(a, b)` is a pure function: dot product over magnitude product, guarding the zero-vector case. `topK(queryVec, chunks, k)` sorts by cosine descending and returns the top k with scores. Both are pure and unit-testable with injected vectors — no live model in tests.

### Query flow

1. Embed the question with `EMBED_MODEL`.
2. `topK` over the index (default k = 6, tunable).
3. Build the constrained-answer prompt (below) from the retrieved chunks.
4. `dispatch(chatModel, prompt)` via `lib/ollama.mjs` (the same `/api/chat`, `num_predict`, retry path the swarm uses, `lib/ollama.mjs:31-39`).
5. Return `{ answer, citations, chunks }` where `citations` is the de-duplicated list of `file` values from the chunks the model was given.

### Constrained-answer prompt

The prompt is where hallucination is fought. It must:

- Present only the retrieved chunks as the allowed evidence, each labeled with its source and `file`.
- Instruct the model to answer **only** from the provided context, to cite the file path for every claim it makes (matching the skill's "every claim cites a file" rule, `lib/skill.mjs:102`), and to respond exactly "unknown — the scan does not cover this" when the context does not contain the answer.
- Forbid drawing on general knowledge of frameworks or the model's training; the scope is this repo's scanned material only.
- Echo the operating-rules posture: it is a co-pilot, it never invents commands (`lib/skill.mjs:125-126`), and a claim is only as fresh as its cited file (`lib/skill.mjs:99`).

The CLI prints the answer followed by the cited files, so a reader can open the source and verify — the same verifiability the dashboard's "every claim cites a file" promise depends on.

---

## When to (re)build the index

The index is derived from `findings.json`, so it goes stale exactly when the scan does. Rebuild triggers:

- **No index, or `index.json` older than `findings.json`** → rebuild before querying. `scripts/ask.mjs` does this lazily so the first question after a scan just works.
- **Tie to #5 Incremental Scanning** — when an incremental run reuses cached findings (`lib/pipeline.mjs:104-107`) the index is unchanged and is not rebuilt; when a run produces new findings the index is marked stale. Index rebuild should reuse the same change signal incremental scanning already computes (`relevantChanged`, `lib/incremental.mjs:41`) rather than re-embedding everything blindly.
- **Tie to #1 / #8 Staleness** — the freshness check already grades a skill fresh / aging / stale by comparing the scan timestamp and cited files to the repo's current state (`lib/freshness.mjs:15-29`). The index inherits that judgment: querying against a `stale` skill should warn the user that answers may not match current code, exactly as the operating rule says ("if the file no longer matches, the claim is stale — re-scan," `lib/skill.mjs:105`).

Embedding all chunks happens once per scan, not per query, so the per-question cost is one embedding call plus one chat call.

---

## Risks

### Hallucination despite citations

The headline risk the 10x doc names (`session-1.md:66`). A model can cite a real file and still misstate what it contains. Mitigations:

- Retrieval-only grounding: the model only sees scanned chunks, never the raw repo, so it cannot cite a file that retrieval did not surface.
- Mandatory "unknown" path in the prompt, plus a low-confidence fallback when the top cosine score is below a floor — if nothing retrieved is similar enough, answer "unknown" without calling the chat model at all.
- Citations are printed from the **chunk metadata**, not parsed from the model's prose, so a hallucinated file path in the answer text cannot masquerade as a real citation in the citation list. A mismatch (model cites a file not in the retrieved set) is flagged.
- The first shipped milestone is retrieve-and-cite with **no generation** (see the plan), which removes hallucination entirely for the initial release and lets us measure retrieval quality before adding the answer step.

### Local embedding quality and performance on large repos

Embedding quality varies by model (`session-1.md:128`). Because the corpus is the scanned material and not the whole repo, chunk count stays small even for large repos, so embedding cost is bounded by findings count, not file count. The embedding model is configurable (`OLLAMA_EMBED_MODEL`) so a repo can swap in a stronger model. `dim` and `model` are stored in the index so a model change invalidates the index and forces a clean rebuild rather than mixing incompatible vectors.

### Index drift

An index built against an old scan answers from stale claims. Handled by the rebuild triggers above and the staleness warning; the index never silently outlives its `findings.json`.

### Ollama unavailability

Both embedding and chat require a running Ollama. On connection failure the CLI fails fast with the same posture as `dispatch` (`lib/ollama.mjs:38`) — a clear error, never a fabricated answer.

---

## Non-goals

- **Not a general chatbot.** The scope is one repo's scanned material. Questions outside the corpus get "unknown," by design.
- **No cloud.** Local Ollama only, consistent with the rest of the tool (`lib/ollama.mjs:3`).
- **No external vector database.** The index is `.smith/index.json`; brute-force cosine is sufficient at this corpus size.
- **No raw-source indexing.** Only validated, cited scanned material is embedded. Indexing the whole repo is a different, larger feature and would dilute the citation guarantee.
- **No multi-repo / cross-repo querying.** That is idea #3; this feature answers within a single repo.
- **No dashboard chat UI in this spec.** CLI first. A browser surface can come later and reuse `lib/rag.mjs` unchanged.

---

## Success Criteria

- [ ] `node scripts/ask.mjs <repo> "question"` returns an answer scoped to the repo's scanned material with a list of cited files.
- [ ] An out-of-corpus question returns "unknown" rather than a guess.
- [ ] Citations come from chunk metadata, so every cited file is one retrieval actually surfaced.
- [ ] The index lives in `.smith/index.json` with no external dependency.
- [ ] Embedding goes through a single shared `lib/embed.mjs`, reused by #6.
- [ ] Chunking and cosine top-k ranking are covered by pure unit tests with injected vectors — no live model in the test suite.
