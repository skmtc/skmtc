# 2026-06-15 — gen-kotlin-sdk/jackson-s config→`_stack` migration + idiomatic-structure drift

A long session: ran the OneBusAway byte-parity gate against the freshly-released
core 0.11.0 stack, migrated `gen-kotlin-jackson-s` and `gen-kotlin-sdk` off
baked-in JSON config to the `_stack` enrichment, dropped the redundant
`JacksonSModel` projection, and held an extended architecture dialogue about
converging the Kotlin generators to idiomatic SKMTC — during which I repeatedly
drifted toward non-idiomatic solutions and the author had to pull me back.

## Knowledge acquired

Operating on the embedded-engine composition (`gen-kotlin-sdk` import-and-constructs
`gen-kotlin-jackson-s`'s model engine) and the three-tier enrichment scopes.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | An **embedded/shared engine** (jackson-s, reached by import-and-construct from the SDK) is **id-blind** — it cannot read `enrichments[host.id]._generator` because it doesn't know the host's id. Shared config must live in **`_stack`** (the id-agnostic scope via `toStackEnrichment`); both generators read the same blob, each through its own partial schema (Valibot `v.object` drops keys it doesn't declare). This is the concrete answer to "which scope for the SDK config." | concept `enrichments.md` + skmtc-generator: add "embedded engine ⇒ `_stack`, not `_generator`" |
| K2 | `insertNormalizedModel`'s inline path builds the value via `schemaToValueFn({context, schema, destinationPath, rootRef?, required})` — it is **not handed the resolved name**. But the name is on the **return Definition** (`def.identifier.name`), and because `toString()` runs at render, a self-naming value can have its name set *after* construction. So a self-naming target (Kotlin Stainless class) *can* be composed via `insertNormalizedModel` — get the name from the return, set it on the value. | skmtc-generator / lang-kotlin: record the name-from-return pattern for self-naming inline models |
| K3 | Registering a model **value directly** via `defineAndRegister(value)` makes the Definition's value the value itself, so `KtDefinition` reads the value-protocols (`KtConstructed`/`KtSupertyped`/`KtDocumented`) off it **natively** — no spec-28 mirror. The mirror is needed *only* when a Projection wraps a value (the Driver wraps the projection); and even then it's a couple of plain fields, not a framework concern. | lang-kotlin skill: note that the spec-28 mirror is avoidable (register the value) and trivial when not |
| K4 | `toArtifacts` artifact **keys include `basePath`** (e.g. `ours/<pkg>/...`). A runner that writes them under a `corpusRoot/<basePath>` dir double-prefixes (`ours/ours/...`) → 0 files match the SDK tree. Write keys relative to the SKMTC **root**, not the basePath dir. | how-to / CLI reference: `toArtifacts` output-key format |
| K5 | `docs/authoring/generator-code-quality.md` (Rule 0–7) + `notes/lang/33` ARE the codified "idiomatic generator structure" rules — and they precisely name every drift I made (Rule 0 foreign vocabulary; Rule 1 producer-is-the-model). I did not load/recall them until the author pointed me there. | skmtc-generator skill: link/surface generator-code-quality.md so it's loaded *before* authoring/refactoring |
| K6 | The SDK's response models carry **per-operation policy** the model value bakes in — shared-model substitution (`sharedHashes`), envelope detection (`detectEnvelope`), enrichment `addFields` — none of which `insertNormalizedModel`'s `schemaToValueFn` can receive. So they must stay **operation projections** that build the value with policy, not be composed via `insert*`. This is *why* import-and-construct persists. | concept: when import-and-construct is forced over `insert*` |
| K7 | A Projection that builds a **per-resource (cross-member) aggregate by rescanning on its first member operation** is fragile under fail-open pruning: if that first op later errors (e.g. an unsupported union response), `removeErroredItems` prunes the op's contributions **including the aggregate it built**, and the other members have already skipped it via the `findDefinition` guard — so the aggregate is **silently dropped** (recorded in the manifest, not stderr). A gen-msw-style **accumulator** (each member `findDefinition`-or-`defineAndRegister`s the aggregate, then `.add()`s its part) is immune — the aggregate is (re)created by whichever member runs and survives as long as one completes. | generator-code-quality / skmtc-generator: prescribe the accumulator over build-on-first-member for cross-member aggregates |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Recurring drift to non-idiomatic solutions; foreign vocabulary is the tell | friction | open |
| 2 | The idiomatic-structure rules exist but aren't surfaced by the generator skill | friction | open |
| 3 | `toArtifacts` keys include basePath → corpus runner double-prefixed | friction | open |
| 4 | Per-resource aggregate built on its first member op is silently dropped when that op errors | friction | open |

---

### 1. Recurring drift to non-idiomatic solutions; foreign vocabulary is the tell [friction]

Spanned the whole architecture dialogue about converging `gen-kotlin-sdk`/jackson-s
to idiomatic SKMTC.

**What happened:** Repeatedly, when a problem looked hard, I reached for the wrong
*kind* of solution and the author corrected me:
- Proposed a **lang-framework change** ("let `KtDefinition` read value-protocols off
  the inner value to remove the spec-28 mirror tax"). The author: "you have a poor
  structure that prevents you from fully utilising SKMTC… complexity is minimal if
  you structure the problem the right way." The mirror is plain fields / a reusable
  snippet — userland, no framework change.
- Invented **foreign vocabulary** — "families", "shared rendering engine", "three
  identity strategies". The author flagged "families" as not-SKMTC; re-derived, it's
  just "an entry inserts several Projections" (already idiomatic, the orchestrator-entry
  pattern).
- Built an **over-engineered lazy getter** (`getClassName` deferral) to support an
  `insertNormalizedModel`-inline path the SDK doesn't even use; the name is known at
  construction. Reverted to plain `className`.
- Twice proposed **core/lang API changes** (pass the name to `schemaToValueFn`) to
  paper over structure, before checking the userland path.

**What was expected:** that "hard" problems need new framework capability or new
abstractions. They mostly needed re-derivation from Projections / Snippets / `insert*`
+ better userland structure.

**Why it matters:** this is the exact failure mode `generator-code-quality.md` Rule 0
("Speak SKMTC") and the design-philosophy override table exist to catch — and the
**tell is foreign vocabulary**. When I can only state a design in imported terms
("renderer", "engine", "tax", "families"), the idea wasn't derived from how SKMTC
works. It cost a large fraction of the session in propose→correct cycles. The cost
order was also inverted: I reached for the heaviest change (core/lang) first, when
the lightest (userland structure) was correct.

**Possible fixes:** unresolved — candidates: surface Rule 0/1 of generator-code-quality.md
in the skmtc-generator skill so it loads before any authoring/refactor (see #2); a
self-check "if I'm proposing a framework/lang change or a new abstraction, first prove
the Projection/Snippet/`insert*` userland path fails"; treat non-SKMTC vocabulary in my
own proposals as a stop-and-re-derive signal.

**Version anchor:** `@skmtc/core@0.11.0`, `@skmtc/lang-kotlin@0.8.0`, `@skmtc/gen-kotlin-sdk` (local, post `fe49ff7`), `@skmtc/gen-kotlin-jackson-s` (local, post `a724fca`)

**Status:** open

### 2. The idiomatic-structure rules exist but aren't surfaced by the generator skill [friction]

Recursive/discoverability observation about how #1 was allowed to happen.

**What happened:** The codified rules that would have prevented #1
(`docs/authoring/generator-code-quality.md` Rule 0–7, mined from the endorsed
reference generators by contrast with gen-kotlin-sdk's own drift; plus `notes/lang/33`)
existed the whole time. I did not load or recall them until the author asked me to find
the record of "the auto-improvement process." Once read, they matched my corrections
one-for-one.

**What was expected:** that the `skmtc-generator` skill (which I *did* load) would point
to or embody the "what good generator code looks like" rules. It covers the DSL,
operational principles, and anti-patterns, but does not surface generator-code-quality.md
or its Rule 0/Rule 1 framing.

**Why it matters:** a doc only works if it's loaded at the moment of risk. The
generator-code-quality rules are exactly the right content, written in the right
vocabulary, and they're invisible from the skill an agent loads to author/refactor a
generator. The drift in #1 is the direct consequence.

**Possible fixes:** unresolved — candidates: the skmtc-generator skill references (or
inlines a digest of) generator-code-quality.md, especially Rule 0 (Speak SKMTC) and
Rule 1 (the producer IS the model); promote the doc out of its "provisional home";
have the skill name the foreign-vocabulary tell explicitly.

**Version anchor:** `@skmtc/core@0.11.0` (docs in `skmtc/deno/docs`)

**Status:** open

### 3. `toArtifacts` keys include basePath → corpus runner double-prefixed [friction]

Writing a local-source runner to byte-parity-check OneBusAway during the config migration.

**What happened:** A runner mirroring the existing lithic harness wrote each artifact to
`join(corpusRoot, 'ours', path)`. With `basePath: 'ours'` and artifact keys already of
the form `ours/<package>/...`, every file landed at `ours/ours/<package>/...`. The
compare against the Stainless SDK reported `0 common, 232 only-A` — no overlap — which
read as a total mismatch rather than a path bug. Fixing it to `join(corpusRoot, path)`
gave the correct `ours/<package>/...` and 232/232 byte-identical.

**What was expected:** that artifact keys are relative to `basePath` (so the runner
prepends the basePath dir). They are relative to the SKMTC **root** — `basePath` is part
of the key.

**Why it matters:** the key format isn't obvious, and the failure presents as "wrong
output / 0 matches," not "wrong path" — easy to misdiagnose as a content regression. A
naive harness that prepends the output directory double-prefixes silently.

**Possible fixes:** unresolved — candidates: document the `toArtifacts` return-key format
(keys include basePath) in a how-to / CLI reference; or have the corpus runners share one
correct write helper.

**Version anchor:** `@skmtc/core@0.11.0`

**Status:** open

### 4. Per-resource aggregate built on its first member op is silently dropped when that op errors [friction]

Discovered while replacing gen-kotlin-sdk's service-insert guard with a gen-msw-style
accumulator. (The guard itself was a workaround for a different mismatch: a per-resource
service Definition carries a per-*operation* `generatorKey`, so a second operation's
re-insert trips `affirmDefinition`'s key check.)

**What happened:** The SDK's services are per-resource but emitted from a per-operation
transform. The old design built the *whole* service on the resource's **first** operation
(a document rescan) and guarded later operations with `findDefinition` to avoid
re-inserting. For 3 lithic resources (`AccountHolder`, `AuthRuleV2`, `ExternalBankAccount`)
the first operation (`create`) has a **union response** that errors at the response step;
`removeErroredItems` then prunes that operation's contributions — **including the service
it had just built**. Every later operation had already skipped the service via the guard,
so nothing rebuilt it. The 3 parent services + their response models (33 files) vanished
with **no error on stderr** (the throw lands in the manifest only). The loss was invisible
because the lithic gate is a self-snapshot, not a vs-reference file-set check — the
snapshot had been missing those files all along. The accumulator (each op
`findDefinition`-or-create then `.add()`) recovered all 33; OneBusAway (full-parity) stayed
byte-identical at 232.

**What was expected:** that a guard which only prevents *re-insertion* is safe, and that
the byte-parity snapshot reflected complete output.

**Why it matters:** this is a **silent correctness bug** — generated files dropped with no
surfaced error — and the fragility is structural. "Build the aggregate when you first see a
member" couples the aggregate's existence to that one member's success; under fail-open
pruning, *any* error on the first member takes the whole aggregate down, and a guard over
the remaining members guarantees no recovery. The accumulator decouples them: the aggregate
is owned by no single member and survives as long as one completes. This generalises to any
generator emitting a cross-member aggregate (a tag controller, a barrel, a registry) from a
per-member transform.

**Possible fixes:** unresolved — candidates: a generator-code-quality rule "for a
cross-member aggregate emitted from a per-member transform, use an accumulator
(find-or-create + append), never build-the-whole-thing-on-the-first-member"; consider
whether `removeErroredItems` pruning a Definition that *other* non-errored items still
reference warrants a warning; note that a self-snapshot gate can mask missing output where a
vs-reference file-set check would catch it.

**Version anchor:** `@skmtc/core@0.11.0`, `@skmtc/gen-kotlin-sdk` (local, post `fafe6bf`)

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #4 — per-resource aggregate dropped when its first member op errors | Silent correctness bug (33 files dropped, no surfaced error) with a clean, generalizable fix; the accumulator should be the prescribed shape for any cross-member aggregate emitted per-member | generator-code-quality: add "accumulator (find-or-create + append), never build-on-first-member" |
| 2 | #2 — generator-code-quality rules not surfaced by the skill | Surfacing Rule 0/1 in the skmtc-generator skill would have prevented the whole session's drift (#1); highest leverage, single edit | skmtc-generator skill: link/inline generator-code-quality.md (Rule 0 Speak-SKMTC, Rule 1 producer-is-the-model) |
| 3 | K1 — embedded engine reads config from `_stack`, not `_generator` | The non-obvious, load-bearing decision of the whole migration; an agent would default to `_generator` and hit the id-blindness wall | concept `enrichments.md` + skmtc-generator: "embedded/shared engine ⇒ `_stack`" |
