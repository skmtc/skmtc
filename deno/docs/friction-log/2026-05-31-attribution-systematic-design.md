# 2026-05-31 — Schema→code attribution: how systematic can it be?

Architecture investigation (no code changes): evaluating whether schema→generated-code
attribution can be a systematic part of core, and where it genuinely fails. Drove a
deep read of the `anchors/` subsystem, `OasBase`/`StackTrail`, `_merge-all-of`, and the
schema-router seams across all 17 example generators. Started from an A-vs-B placement
question for `schemaPointer` capture; the real question turned out to be the structural
alignment between schema nodes and rendered spans.

## Knowledge acquired

Operating in `@skmtc/core`'s attribution/gen-map subsystem and the generator corpus.
**Caveat:** I loaded `skmtc-generator` + `skmtc-cli` this session, not `skmtc-architecture`
— whose description claims to cover the "attribution / gen-maps (provenance) subsystem."
Several rows below may already be documented there; the doc implication for each is
"verify against `skmtc-architecture`; if absent, add." That itself is a signal (K1/F3).

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | Attribution is a **resolved property of rendered character-spans, not an intrinsic per-snippet scalar**. `anchors/attribute.ts` resolves `schemaPointer` in three tiers: producer's own `schemaPointer` → nearest-ancestor (via render tree) → `schemaPointerFromKey(generatorKey)`. The question the system answers is "for this output span, what's the most specific schema location in scope," not "what single node is this snippet." | Verify in `skmtc-architecture`; if absent, this is the core mental model for the whole subsystem and belongs there explicitly. |
| K2 | `OasBase.toLocation()` is **instance-carried**: `stackTrail` is captured and `.clone()`d at parse time (`OasBase.ts:40-42`) and immutable after. A schema's location is independent of where it's later re-parented. This is the linchpin that makes attribution survive object synthesis. | API reference for `OasBase`/`StackTrail`; note the location-independence invariant. |
| K3 | The render tree (`SnippetBase._children`) is built **transparently** by an instrumented `toString` installed only when `context.attribution` is set (`SnippetBase.ts:104-136`): a module-level render-stack pushes/pops, recording parent→child *output* edges. Authors write nothing. Includes a render-cycle guard that throws on recursive `toString`. | `skmtc-generator` could note that composition edges are auto-captured and why `toString` purity + acyclic composition matter for it. |
| K4 | `anchors/resolveSpans.ts` localizes a child by finding its `_rendered` text **verbatim** (`indexOf`) inside the parent's text; if the parent transformed the child's output, the span is dropped. So span localization (not just attribution origination) depends on the "render from objects, never manipulate rendered strings" invariant. | Tie the no-string-manipulation rule to span localization in `skmtc-generator`. |
| K5 | `allOf` merge runs on **raw JSON pre-parse** (`toSchemasV3.ts:84-92`): `mergeIntersection` spreads plain `SchemaObject`s, then the merged blob is parsed at `stackTrail.trace('allOf', …)`. Result: merged fields get field-level stackTrails rooted at a **synthetic** path (`X/allOf/properties/name`) that is **not resolvable** against the source document (under `allOf` is an array). `addProperty`/`synthesizeArgsObject` instead reuse the original instances (locations survive); only their synthetic *container* lacks a location. | Candidate `_merge-all-of` correctness note + the synthesis-vs-merge distinction. |
| K6 | `schemaPointerFromKey` (`attribute.ts:57-73`) reconstructs `oas:#/paths/<path>/<method>` / `#/components/schemas/<refName>` from the **GeneratorKey alone** — so coarse (operation/model) attribution works even if parse-time attribution was disabled. Only fine-grained pointers require parse-time attribution on. | API reference. |
| K7 | `producerName` = `producer.constructor.name`, **interned as display data** in `buildSidecar.ts:142` (not used as a lookup key). Fragile under minification (flagged in `attribute.ts:42-44`); since it's display-only, baking it is a label-correctness fix, not graph-correctness. | None (captured here). |
| K8 | **Live-verified (post-migration, core `0.6.10`):** the own-pointer tier (`attribute.ts:43`, `producer.schemaPointer.toJsonPointer()`) emits the **entire** `StackTrail` — including the run's operational prefix `[traceId, spanId, 'parse']` seeded by the worker + `CoreContext.toArtifacts`. So a live gen-map's granular pointer reads `#/trace-<id>/span-<id>/parse/components/schemas/Pet/properties/name`, **not** the resolvable `#/components/schemas/Pet/properties/name`. Document-position and operational-trace frames are conflated on one trail; only the key-derived fallback (`schemaPointerFromKey`) is document-relative. See entry #4. | API-reference note on `StackTrail.toJsonPointer()` (it is NOT document-relative); core fix in `0.6.11`. |
| K9 | **Live-verified:** with identical `${key}: ${value}` property rendering, `gen-typescript`'s inner snippets (`TsObject`/`TsString`) appear in the gen-map render tree but `gen-zod`'s (`ZodObject`/`ZodString`) do **not** — gen-zod yields only `Definition` + `ZodProjection` (Definition-level). So render-tree child-capture (`SnippetBase._children`) is sensitive to something beyond "interpolate a Snippet in `toString`"; the two generators differ in a way that silently drops gen-zod's edges. See entry #5. | `skmtc-generator` (what exactly makes a child captured vs dropped) once root-caused. |
| K10 | **How to build a self-contained skmtc deploy bundle by hand** (the manual equivalent of the CLI's `bundleDeploy`, for live-test rigs): write a `createServer({ toGeneratorConfigMap, logsPath })` entry (`@skmtc/server`), then `deno bundle --platform browser --output <out>.js server.ts` with the project's `deno.json` import map in scope (generators → local clone `mod.ts`, `@skmtc/core`/`@skmtc/server` → JSR/mirror). **One core instance is achieved iff every pin transitively resolves to the same `@skmtc/core` version** — `@skmtc/server`'s own core pin included. Verify directly from the `deno bundle` download log: a single `@skmtc/core/<ver>/…` fetch ⇒ one instance (the thing the 2026-05-29 bundle collapse was about). `JSR_URL` (direnv) points resolution at the local mirror. | How-to doc: "build a deploy bundle for live testing" — the handoff left this as an explicit OPEN item. |
| K11 | A skmtc project has **two distinct derived entry files**, both gitignored, that can silently drift: `server.ts` (the `createServer` *deploy* entry the runner executes) and `worker.ts` (the `toWorker` *bundle* entry `skmtc bundle`/`generate` uses). They are regenerated independently, so the checked-out `server.ts` can list a different generator set than `worker.ts`/the `deno.json#workspace` (here `server.ts` imported `@skmtc/gen-tanstack-query-fetch-zod`, absent from the workspace, while `worker.ts` listed the 4 real clones). Never trust `server.ts` as the source of truth for "what generators this project runs" — `worker.ts` + `deno.json#workspace` are. | API/CLI reference: document both derived entries + which is authoritative. See entry #6. |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Reasoning from the `schemaPointer` field name alone yields a wrong attribution model | friction | open |
| 2 | `allOf`-merged nodes get a synthetic, non-resolvable schema pointer | friction | open |
| 3 | Attribution `anchors/` subsystem not discoverable from the loaded skills | polish | open |
| 4 | Own-pointer tier emits the operational trace prefix → granular pointers not resolvable | friction | open |
| 5 | gen-zod inner snippets silently absent from the render tree (gen-typescript's present) | friction | open |
| 6 | Deploy `server.ts` and bundle `worker.ts` are independent gitignored entries that drift | friction | open |

---

### 1. Reasoning from the `schemaPointer` field name alone yields a wrong attribution model [friction]

Investigating whether per-snippet schema attribution is well-defined across the operation
generators (`SupabaseHono`, `QueryFn`, `MutationFn`, accumulators).

**What happened:** Working from the `SnippetBase.schemaPointer` field and the generator
source (without yet reading `anchors/`), I concluded that operation composites have "no
clean attribution" because a single snippet draws on zero-or-multiple schema nodes. I
presented this as a structural limitation. The user challenged it twice. Only after
reading `anchors/attribute.ts` did the correct model surface: attribution is a *span*
property resolved through three tiers (own → ancestor → key-derived), so every span is
well-defined — composites resolve to their operation pointer via the key, and synthesized
objects keep per-leaf locations because `toLocation()` is instance-carried (K2). My
"worst case" (`MutationFn`'s synthesized args object) is actually clean per-property.

**What was expected:** that `schemaPointer` was an intrinsic per-snippet scalar I had to
populate uniformly, and that a snippet with no single originating node was unattributable.

**Why it matters:** the field name `schemaPointer` (singular, on each snippet) actively
suggests the wrong abstraction. An agent reasoning about attribution from the type surface
will conflate "snippet→schema cardinality" (static, per-class) with "span→location
resolution" (dynamic, per-render-node, with fallback) — and reach a wrong conclusion about
what the system can do. The correct model is only visible by reading the `anchors/`
resolver, which nothing in the loaded skills pointed at.

**Possible fixes:** unresolved — could be a one-paragraph "attribution is span-resolution,
not per-snippet scalar" note wherever the subsystem is documented; could be a doc-comment
on `schemaPointer` pointing at `attribute.ts`'s three-tier fallback; could be a naming
reconsideration. The recursive lesson for an agent: when reasoning about attribution, read
`anchors/attribute.ts` + `resolveSpans.ts` *first*.

**Version anchor:** `@skmtc/core@0.6.9`

**Status:** open

### 2. `allOf`-merged nodes get a synthetic, non-resolvable schema pointer [friction]

Tracing whether `allOf` merging preserves source locations for fine-grained attribution.

**What happened:** `toSchemasV3.ts:84-92` merges `allOf` members on raw JSON
(`mergeIntersection`, which spreads plain `SchemaObject`s and discards member origin),
then parses the merged blob at `stackTrail.trace('allOf', …)`. The merged fields therefore
get field-level stackTrails like `#/components/schemas/Pet/allOf/properties/name` — but
that path is **not resolvable in the source document**: under `allOf` is an array
(`allOf/0`, `allOf/1`), there is no `allOf/properties` node. A gen-map "jump to schema
source" would land on nothing. Non-overlapping fields (the common case) are verbatim
passthroughs from exactly one member (`merge-properties.ts:21`), so their *resolvable*
origin (`Pet/allOf/1/properties/name`) is known but discarded by the re-rooting.

**What was expected:** I initially (wrongly) assumed merged nodes were location-*less* and
degraded to the model pointer. The reality — a precise-looking but non-resolvable synthetic
pointer — is arguably worse, because it looks authoritative.

**Why it matters:** attribution faithfulness. A synthetic pointer that doesn't resolve
against the source is a silent correctness gap in any consumer that round-trips the pointer
back to the schema document. The honest model: a merged field's identity is its originating
member; only genuinely-combined (overlapping) keys are irreducibly synthetic and should
fall back to the `allOf` *array* node (which is resolvable).

**Possible fixes:** unresolved — options span (a) a provenance side-channel threading each
raw fragment's source pointer through `_merge-all-of` so passthrough fields keep their true
member origin and overlapping fields fall back to the `allOf` node; (b) a minimal fix that
re-roots merged fields to the `allOf` node rather than the synthetic `allOf/properties/...`
path; (c) leaving it if no consumer round-trips merged pointers. Gate on the gen-map UX.

**Version anchor:** `@skmtc/core@0.6.9`

**Status:** open

### 3. Attribution `anchors/` subsystem not discoverable from the loaded skills [polish]

Trying to answer "how systematic is attribution" with `skmtc-generator` + `skmtc-cli`
loaded.

**What happened:** Neither loaded skill pointed at the attribution engine. I found the
entire subsystem (`anchors/attribute.ts`, `resolveSpans.ts`, `postPass.ts`,
`buildSidecar.ts`, `sidecar.ts`) only by grepping core for `_children` and `schemaPointer`.
The `skmtc-architecture` skill *description* does claim to cover the provenance subsystem,
so the knowledge may exist there — but the two skills a generator-author would naturally
load give no cross-reference to it.

**What was expected:** that the skills covering generator authoring / CLI would at least
cross-reference where attribution lives, given `schemaPointer` is a field on the base class
every generator extends.

**Why it matters:** the missing cross-reference is what let entry #1 happen — I reasoned
locally instead of reading the resolver. A one-line "attribution/gen-maps: see
`skmtc-architecture` + `core/anchors/`" pointer in `skmtc-generator` would have routed me
correctly in seconds.

**Possible fixes:** unresolved — likely a cross-reference line in `skmtc-generator` (and/or
confirming `skmtc-architecture` actually covers the three-tier resolution model from K1).

**Version anchor:** `@skmtc/core@0.6.9`

**Status:** open

### 4. Own-pointer tier emits the operational trace prefix → granular pointers not resolvable [friction]

The live verification of point 2b (post-migration, core `0.6.10`): trigger a real run against
petstore, fetch `…/runs/1/gen-map`, assert an inner snippet for `Pet.name` resolves to
`#/components/schemas/Pet/properties/name`.

**What happened:** the granular capture *worked* — `gen-typescript`'s `TsString` snippets for
`id`/`name`/`tag` each carried a per-property pointer (not the Definition-level one), proving
the C2 constructor-args mechanism end-to-end. But the pointer string was
`#/trace-1780233682442/span-1780233682442/parse/components/schemas/Pet/properties/name`, not the
resolvable `#/components/schemas/Pet/properties/name`. The own-pointer tier
(`attribute.ts:43`) serializes `producer.schemaPointer.toJsonPointer()` over the *whole*
`StackTrail`, and that trail is seeded by the worker with `[traceId, spanId]` and extended by
`CoreContext.toArtifacts` via `.trace('parse', …)` before parse traverses
`components/schemas/…`. The clean Definition-level pointers in the same gen-map
(`#/components/schemas/Pet`) come from the key-derived fallback (`schemaPointerFromKey`), which
never touches the trail — which is why the two tiers disagree.

**What was expected:** that after the migration, the own-pointer (fine-grained) tier would emit
the same document-relative form as the key-derived (coarse) tier — just deeper. The handoff
even framed 2b as "free after the bundle collapse." It is not: the collapse fixed the
*two-core-instance* fragility, but the trail-serialization was a separate latent issue that
only surfaced once granular pointers actually flowed (nothing exercised the own-pointer tier
before C2).

**Why it matters:** a granular pointer that doesn't resolve against the source document defeats
the entire purpose of 2b (jump-to-schema-source in the gen-map viewer). It's the same
faithfulness failure mode as entry #2 (a precise-looking pointer that points at nothing), but
on the *common* path, not just `allOf`. The root cause is conceptual: **document position and
operational trace are conflated on one `StackTrail`.**

**Possible fixes:** three candidates, mutually exclusive, surfaced to the user for decision
(core `0.6.11`): (A) a `StackTrail.toDocumentPointer()` that strips up to & including the phase
anchor, called at the resolver — smallest diff, couples StackTrail to phase-frame names; (B)
parse traverses on a fresh trail so `OasBase` nodes capture document-relative positions, with
operational trace kept separate — most correct, bigger, touches error-trace reporting; (C)
rebase in `OasBase` at capture time — same coupling as A, applied earlier. Note the `toStackRef`
method already assumes `stack[0] === 'components'`, i.e. a document-relative trail — evidence
the codebase already has two implicit notions of "where the trail starts."

**Version anchor:** `@skmtc/core@0.6.10`

**Status:** open

### 5. gen-zod inner snippets silently absent from the render tree (gen-typescript's present) [friction]

Same live gen-map. Comparing what each model generator contributed.

**What happened:** `gen-typescript` produced `TsProjection`, `TsObject`, `TsObjectProperties`,
and three `TsString` entries (granular, per-property). `gen-zod` produced only `Definition` +
`ZodProjection` — both Definition-level (`#/components/schemas/Pet`). No `ZodObject` /
`ZodString` entries at all, even though the hub's gen-zod clone was converted in the same
migration to thread `schema` into those snippets. Both generators' property rendering is
structurally identical: `ZodObject.toString` does `z.object({${…}: ${value}})` and
`TsObjectProperties.toString` does `{${…}: ${value}}` — both interpolate the child Snippet via
`${value}`.

**What was expected:** symmetric behaviour — if gen-typescript's children are captured in the
render tree, gen-zod's should be too, since the composition shape is the same.

**Why it matters:** the render-tree child-capture (`SnippetBase._children`, the instrumented
`toString`) is supposed to be transparent and author-invisible (K3). That two near-identical
generators get different capture is a sign the mechanism has a hidden precondition — likely
*when* `toString` is first invoked relative to the render walk (e.g. a value stringified eagerly
in a constructor, or cached, escapes instrumentation), or a difference in how each wraps its
properties sub-snippet. Until root-caused, "thread `schema` into the snippet" is necessary but
not sufficient for granular attribution — and the gap is silent (no error, just missing
entries).

**Possible fixes:** unresolved — needs focused debugging of the gen-zod render path vs
gen-typescript's (where/when each property snippet's `toString` runs, whether `ZodProjection`
or `ZodObject` eagerly stringifies). Fix likely lands in the generator (canonical
`skmtc-generators` + hub clone); if the precondition is subtle, K3's "transparent capture"
claim needs a documented caveat.

**Version anchor:** `@skmtc/core@0.6.10`, gen-zod / gen-typescript hub clones

**Status:** open

### 6. Deploy `server.ts` and bundle `worker.ts` are independent gitignored entries that drift [friction]

Building the live-test fixture bundle: the handoff explicitly left "OPEN: locate/author the fixture's `server.ts` entry (composes the two generators + `createServer`)."

**What happened:** the project (`.skmtc/skmtc-hub/`) had a checked-out `server.ts` — but it imported `@skmtc/gen-tanstack-query-fetch-zod`, a generator **not in the project's `deno.json#workspace`** (which lists `gen-hono-api`, `gen-zod`, `gen-typescript`, `gen-react-query-zod`). The sibling `worker.ts` listed the correct four. Both are gitignored derived artifacts: `server.ts` is the `createServer` *deploy* entry; `worker.ts` is the `toWorker` *bundle* entry. They're regenerated by different code paths and had drifted — so I couldn't take `server.ts` at face value as "what this project deploys," and had to author a fresh entry (gen-zod + gen-typescript + `createServer`) from the workspace + `worker.ts` rather than trust the stale one.

**What was expected:** that the project's `server.ts` reflected the project's actual generator set — i.e. that the deploy entry and the bundle entry agreed.

**Why it matters:** an agent reaching for "what generators does this project run?" will naturally read `server.ts` (it's the human-readable `createServer` composition) and be silently wrong. The authoritative sources are `worker.ts` + `deno.json#workspace`/`#imports`. Because both files are gitignored, neither is version-controlled to catch the drift, and a stale `server.ts` referencing an absent generator would fail to bundle in a confusing way (missing import) if used directly. This is the same class as the CLAUDE.md "stale-lock gotcha" (derived files cache an old workspace shape) but for the entry files rather than the lockfile.

**Possible fixes:** unresolved — could be that `skmtc bundle`/`generate` regenerates `server.ts` alongside `worker.ts` so they can't drift; could be a `doctor` check that the deploy entry's generator set matches the workspace; could be documenting (K11) that `worker.ts`/`deno.json` are authoritative and `server.ts` is regenerated only by the deploy path. Gate on whether the deploy `server.ts` is even meant to live in the project tree vs be produced on-demand by `deploy`.

**Version anchor:** `@skmtc/cli@0.4.3`, `@skmtc/core@0.6.10`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #4 — own-pointer tier emits the operational trace prefix | Blocks 2b on the **common** path (every threaded snippet), not just `allOf`: granular pointers don't resolve to source. Root cause (trace/document conflation on one `StackTrail`) is the same class as #2 but far broader | SKMTC core `0.6.11` (decision A/B/C pending user) |
| 2 | #5 — gen-zod inner snippets absent from render tree | "Thread `schema` into the snippet" is necessary-but-not-sufficient for granular attribution; the gap is silent. Undermines K3's transparent-capture claim | Generator debugging (gen-zod render path) + possible K3 caveat |
| 3 | #2 — `allOf` synthetic non-resolvable pointer | A precise-looking pointer that doesn't resolve against source is a silent attribution-faithfulness bug; affects any consumer round-tripping pointers | SKMTC code (`_merge-all-of` + `toSchemasV3`), after confirming gen-map UX need |
