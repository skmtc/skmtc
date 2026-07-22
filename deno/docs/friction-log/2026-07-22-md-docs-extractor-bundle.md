# 2026-07-22 — gen-md-docs as a deep-search extractor (spike → published stack)

Evaluated `@skmtc/gen-md-docs` as the extraction stage for a deep search
index over skmtc-hub's ~7,000-spec catalog: ran it out-of-band over a
60-spec sample to measure coverage, then scaffolded, bundled and published
a single-generator project (`@dmitrigrabov/skmtc-md-docs@0.1.0`) to a local
hub so the runner can load it. Observations are about SKMTC itself, not the
consuming hub work.

## Knowledge acquired

Working across the CLI (`init`/`install`/`generate`/`clean`/`publish`/`doctor`),
`@skmtc/core`'s parse stage, and `gen-md-docs` output shape.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | A project has **two distinct bundle artifacts** over the same generators: `bundle.js` (~991 KB, built from `worker.ts` → `@skmtc/worker`) is what `skmtc generate` runs in a local worker, and `server.js` (~1.14 MB, `@skmtc/server`) is what `publish` uploads and the hub runner loads via its Worker Loader. **A successful local `generate` does not prove the runtime path**, because it exercises a different entry point. | Missing from skmtc-cli skill §4; the `generate` row says only "Run the pipeline". Worth a short "two bundles" note next to `bundle`/`publish` |
| K2 | `skmtc publish` requires `deno.json#name` in `@account/slug` form, but `skmtc init` does **not** scaffold `name` or `version` — so the first publish of every new project fails at stage `identity` until both are hand-added. Publish then injects the `@skmtc/server` import pin into `deno.json` itself. | skmtc-cli publish card already documents the `name` requirement; it does not say `init` omits it. Add "init does not create these" to the card, or have `init` scaffold them |
| K3 | `@skmtc/core` rejects Swagger 2.0 outright at parse (`Unsupported OpenAPI version: (missing) — expected 3.0.x or 3.1.x`), producing zero artifacts. On a random 60-spec sample of real scraped specs that was **19 of 22 total failures**; catalog-wide it is 27% of documents. A conversion package exists (`@skmtc/swagger2openapi`, pulled in transitively by `@skmtc/server`) but nothing in the generate pipeline applies it. | Explicit statement in the CLI/troubleshooting docs that Swagger 2.0 is unsupported and must be pre-converted, with a pointer at the conversion package |
| K4 | `toArtifacts` from `@skmtc/core` is directly callable **out of band** — no CLI, no worker, no project — as `toArtifacts({ traceId, spanId, startAt, document, settings, stackTrail, silent, toGeneratorConfigMap })`, returning `{ artifacts, manifest }` where `artifacts` is a plain `path → content` record. This is the shape `gen-md-docs`' own `test/e2e.test.ts` uses. Ideal for corpus-scale experiments. | Not in the skmtc-cli skill (correctly — it's an engine API), but a recipe for "run a generator over N schemas without the CLI" would have saved real time |
| K5 | `gen-md-docs` emits one `.md` per operation, plus a per-tag `index.md`, a top-level `index.md` and an `index.json` catalog. Frontmatter carries `type`/`title`/`operationId`/`method`/`path`/`servers`/`tags`. Output is stable enough to diff between runs (byte-identical across the Deno and CLI paths). | Fine as-is; would be useful in a `gen-md-docs` README output-shape section |
| K6 | `skmtc doctor` compares each project's `@skmtc/core` pin against the CLI's major.minor and warns on drift. A freshly-`init`ed project gets the CLI's current version, so a repo with older projects silently ends up with **mixed core versions side by side** (0.26.0 vs 0.28.2 here). | Already surfaced by doctor; no doc change needed |
| K7 | `bundle.js` is gitignored by repo convention (`.skmtc/*/bundle.js`), so a **fresh git worktree has no bundle** and doctor reports `project-bundle/<project>` warnings for every project until re-bundled. Not a corruption signal. | Worth a line in the skmtc-cli skill's doctor table — the warning reads alarming and the cause is mundane |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `skmtc generate --json` breaks its own strict-JSON contract | friction | open |
| 2 | A large spec hard-crashes the process during parse, with no catchable error | blocker | open |
| 3 | Swagger 2.0 is rejected at parse though a conversion package ships in the same graph | friction | open |
| 4 | `gen-md-docs` inlines each referenced schema into every operation doc | friction | open |
| 5 | The CLI writes settings files without a trailing newline, oscillating against repo formatters | polish | open |
| 6 | Running `toArtifacts` out-of-band to measure a generator across a corpus | win | open |

---

### 1. `skmtc generate --json` breaks its own strict-JSON contract [friction]

Measuring generate throughput on a 2.1 MB OpenAPI document via the
documented agent-native invocation.

**What happened:** `skmtc generate skmtc-md-docs <spec> --json` wrote
**675 KB to stdout**, of which the first 1,924 lines were ANSI-coloured
`[WARN]` records (642 of them, benign `UNEXPECTED_PROPERTY` parse notes).
The JSON envelope began at **line 1925 of 6,642**. `stderr` received
**0 bytes**. Exit code was 0 and the run was fully successful (203 files,
no errors).

```
stdout bytes: 675633   stderr bytes: 0
```

Recovery required stripping ANSI escapes, then scanning forward line by
line for the first offset at which the remainder parses as JSON.

**What was expected:** the behaviour the skill documents for strict JSON
mode — "Single JSON object on stdout. Logs/warnings on stderr." That is
also what makes the mode composable: `skmtc generate <p> --json | jq`.

**Why it matters:** `--json` exists specifically so agents and CI can
consume output without scraping. As shipped, the canonical pipeline fails,
and the usual reflex (`2>/dev/null`) does nothing because stderr is empty —
so the failure looks like the command produced no JSON at all rather than
like a stream-routing bug. The contract is documented in the skill and in
`--json`'s own promise, so the divergence silently invalidates guidance
agents are told to rely on. Worse, it degrades with schema size: the
noisier the spec, the deeper the envelope is buried, so a small test
project can appear to work while a real one doesn't.

**Possible fixes:** route the logger to stderr whenever `--json`/strict
mode is active; or suppress non-error logs entirely in JSON mode and fold
warnings into the envelope (`parseIssues` already exists for exactly this);
or emit the envelope as the first line. Unresolved which is preferable —
the third is the most backward-compatible for anyone already scraping.

**Version anchor:** `skmtc@0.9.38`, `@skmtc/core@0.28.2`,
`@skmtc/gen-md-docs@0.1.1`, `@skmtc/worker@0.3.50`

**Status:** open

---

### 2. A large spec hard-crashes the process during parse, with no catchable error [blocker]

Running `gen-md-docs` over a corpus that included Microsoft Graph
(`graph-v1-0`: 38 MB, 10,755 paths, 5,040 component schemas).

**What happened:** the Deno process **died** with a stack-overflow dump
(dozens of unresolved `0x…` frames) rather than throwing. The harness wraps
the call in `try/catch`; the catch never ran, and the surrounding loop over
the corpus was terminated along with the process. Smaller documents in the
same corpus were fine — Cloudflare's spec (11.3 MB, 2,009 paths) produced
3,742 documents in 1.48 s.

**What was expected:** either successful generation, or a thrown
`ConfigValidationError`/parse error that a caller can catch, record and
skip — the same contract the 743 recoverable `parseIssue` errors on the
Cloudflare spec follow.

**Why it matters:** an uncatchable crash is qualitatively different from a
failed generation. It means **no host can defend itself with `try/catch`** —
any batch pipeline must guard *before* the call, by inspecting document size
or path count, and must know the threshold empirically. It also means one
pathological document can take down a worker mid-batch, losing unrelated
in-flight work; a queue consumer would redeliver and crash again, so it is a
poison-pill shape. Recursion depth appears to scale with schema nesting
rather than raw byte size, which makes a byte-size guard a proxy rather than
a real fix.

**Possible fixes:** unresolved — needs reflection. Candidates: an explicit
depth counter in the parse walk that throws a proper error past a bound; an
iterative rather than recursive resolver for the pathological path; or a
documented "maximum supported document size" plus a fast pre-parse check the
CLI and hosts can call. Whatever the fix, the failure needs to become
catchable.

**Version anchor:** `@skmtc/core@0.26.0` (via `@skmtc/gen-md-docs@0.1.1`),
Deno 2.x

**Status:** open

---

### 3. Swagger 2.0 is rejected at parse though a conversion package ships in the same graph [friction]

Measuring what fraction of a real 7,000-spec catalog `gen-md-docs` can
process, over a random 60-spec sample.

**What happened:** 22 of 60 specs produced zero artifacts, and **19 of those
22 failed for the single reason** `Unsupported OpenAPI version: (missing) —
expected 3.0.x or 3.1.x` — they are Swagger 2.0. Catalog-wide the figure is
1,915 of 7,130 current public documents (27%). Converting them first (any
Swagger 2.0 → OpenAPI 3 converter, `patch` + `warnOnly`) recovered 13 of 19
at 0–110 ms each, lifting sample coverage from 63% to 85%.

Separately, `@skmtc/swagger2openapi` turns out to be **already in the
dependency graph**, arriving transitively via `@skmtc/server` — it appeared
in the project lockfile after `publish`.

**What was expected:** given how much real-world OpenAPI is still Swagger
2.0, some acknowledgement in the pipeline — either automatic conversion or
an error that names the remedy.

**Why it matters:** the error message is accurate but terminal: it states
what is unsupported without hinting that conversion is both possible and
already available inside SKMTC's own package graph. An integrator measuring
SKMTC against a real corpus concludes "37% of my specs don't work" when the
true figure after a cheap, mechanical pre-step is 15%. That is a large
difference in perceived fitness, and the information needed to close it is
not discoverable from the failure.

**Possible fixes:** unresolved. Options span a docs fix (state the
limitation and point at the converter), an error-message fix (name the
remedy in the `Unsupported OpenAPI version` text), and a behaviour change
(auto-convert on detecting `swagger: "2.0"`, perhaps behind a setting). The
docs/error fixes are cheap and independent of the behaviour question.

**Version anchor:** `@skmtc/core@0.26.0`, `@skmtc/gen-md-docs@0.1.1`,
`@skmtc/swagger2openapi@0.1.3` (transitive via `@skmtc/server@0.2.57`)

**Status:** open

---

### 4. `gen-md-docs` inlines each referenced schema into every operation doc [friction]

Chunking `gen-md-docs` output for a retrieval index over one API
(sequencehq/sequence — 115 paths, 346 component schemas).

**What happened:** the same seven-variant price-structure union was rendered
in full inside **21 of 244 chunks** — every operation document that
references the `Price` schema carries a complete copy of it. Document sizes
reflect this: p50 3.5 KB but p90 17.8 KB and max 36 KB, with 25% of
documents over 8 KB.

**What was expected:** something closer to how the generator already handles
intra-document repetition — it de-duplicates `$ref`s into anchor links
within a single file (`[`Type`](#anchor)`), so the inlining is clearly
deliberate for self-containedness, but it does not extend across files.

**Why it matters:** for the intended use (human-browsable Markdown docs)
self-containedness is right — a reader on one page should not have to
navigate away. But it makes output size scale with
`operations × referenced-schema-size` rather than with schema count, which
hurts two secondary uses badly: retrieval indexes pay embedding and storage
cost per duplicate and then return near-identical chunks that waste an LLM's
context, and any diff of generated docs shows one schema edit touching
dozens of files. A per-schema document plus links would serve both, but
would weaken the browsing case — so this is a genuine design tension, not
an oversight.

**Possible fixes:** unresolved — needs reflection. Possibly an option
selecting inline vs referenced schema rendering; possibly an additional
per-schema artifact emitted alongside the operation docs, leaving the
inlining intact.

**Version anchor:** `@skmtc/gen-md-docs@0.1.1`, `@skmtc/core@0.26.0`

**Status:** open

---

### 5. The CLI writes settings files without a trailing newline, oscillating against repo formatters [polish]

Running CLI commands inside a repo whose pre-commit hook runs `oxfmt`.

**What happened:** every CLI command that touches
`.skmtc/<project>/.settings/client.json` or `.skmtc/<project>/deno.json`
rewrites them **without a trailing newline**. The repo's `oxfmt` adds one
back on commit. The two never converge, so `git status` shows those files
modified after any CLI invocation — including for projects the command did
not target.

**What was expected:** files written with a trailing newline, matching the
POSIX convention nearly every formatter enforces.

**Why it matters:** small, but it produces permanent phantom diffs in any
repo that formats JSON. The practical hazard is that the noise is
indistinguishable from real configuration drift, which invites sweeping
unrelated files into commits — in this session four unrelated `.skmtc/`
files sat modified for the whole session and were initially misread as
another agent's in-flight work.

**Possible fixes:** append `\n` when serialising these files.

**Version anchor:** `skmtc@0.9.38`

**Status:** open

---

### 6. Running `toArtifacts` out-of-band to measure a generator across a corpus [win]

Needing a coverage number for `gen-md-docs` over 60 real scraped specs,
rather than an estimate.

**What happened:** instead of scripting the CLI once per spec, a ~60-line
Deno script imported `toArtifacts` from `@skmtc/core` and the generator's
entry directly, looped over a directory of documents, and tallied outcomes
per spec (`ok` / `partial` / `empty` / `threw`), with timings:

```ts
const { artifacts, manifest } = toArtifacts({
  traceId: 'sample', spanId: name, startAt: Date.now(),
  document: { type: 'oas', value: documentObject },
  settings: { basePath: './src' },
  stackTrail: new StackTrail([]), silent: true,
  toGeneratorConfigMap: () => ({ '@skmtc/gen-md-docs': mdDocsEntry })
})
```

Sixty specs processed in 890 ms total, in-process, with structured results
and no filesystem writes.

**Why it matters:** the obvious approach — a shell loop around
`skmtc generate` — needs a project per schema source, writes artifacts to
disk for every spec, costs CLI startup each time, and (per entry #1) cannot
reliably parse its own `--json` output. The engine API sidesteps all four
and yields a typed `manifest` with `parseIssues` already classified by
level, which is exactly what a coverage measurement needs. Another agent
asked to "measure how many of these specs work" would very likely reach for
the CLI loop, because the CLI is the documented surface and `toArtifacts` is
only visible from generator test files.

**Possible fixes:** n/a — codification candidate. A short recipe ("evaluate a
generator across many schemas") pointing at `toArtifacts` with this shape
would make it discoverable.

**Version anchor:** `@skmtc/core@0.26.0`, `@skmtc/gen-md-docs@0.1.1`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — `skmtc generate --json` breaks its own strict-JSON contract | The mode built specifically for agents cannot be consumed by the invocation the docs prescribe, and it fails worse as schemas grow | SKMTC code — route logs to stderr in strict mode (or emit the envelope first); the skill's §3 contract is correct and should not change |
| 2 | #2 — Large spec hard-crashes the process during parse | An uncatchable crash means no host can defend itself with `try/catch`; it is a poison-pill for any queue-driven pipeline | SKMTC code — make the failure throwable (depth bound), plus a documented size/complexity limit hosts can pre-check |
| 3 | #3 — Swagger 2.0 rejected with the remedy already in the package graph | 27% of a real corpus fails on a limitation that a cheap pre-step fixes, and nothing in the error or docs points at it | Docs + error message first (cheap, independent); auto-conversion is a separate behaviour decision |
