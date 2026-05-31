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

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Reasoning from the `schemaPointer` field name alone yields a wrong attribution model | friction | open |
| 2 | `allOf`-merged nodes get a synthetic, non-resolvable schema pointer | friction | open |
| 3 | Attribution `anchors/` subsystem not discoverable from the loaded skills | polish | open |

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

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #2 — `allOf` synthetic non-resolvable pointer | A precise-looking pointer that doesn't resolve against source is a silent attribution-faithfulness bug; affects any consumer round-tripping pointers | SKMTC code (`_merge-all-of` + `toSchemasV3`), after confirming gen-map UX need |
| 2 | #1 / K1 — attribution is span-resolution, not a per-snippet scalar | The field name misleads agents into a wrong structural conclusion (cost two correction cycles this session) | `skmtc-architecture` (confirm/add the three-tier model) + doc-comment on `schemaPointer` |
| 3 | K4 — span localization needs verbatim child text | Couples the no-string-manipulation invariant to attribution correctness, not just style — a stronger reason to enforce it | `skmtc-generator` (tie the rule to span localization) |
