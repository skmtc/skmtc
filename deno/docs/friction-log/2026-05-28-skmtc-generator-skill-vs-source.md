# 2026-05-28 — Generator skill / memory divergence from source surfaced during eval-corpus authoring

This session was building an eval harness to drive `/autoresearch` against `docs/skills/skmtc-generator/SKILL.md`. While authoring the corpus and `invariants.md` from SKILL.md and the project memory entries, three places where the doc-as-written reads stricter or differently than the actual source surfaced — and one structural pattern about how doc-vs-source drift compounds when an LLM authors an eval corpus.

Reads that informed these entries: `core/oas/schema/Schema.ts`, `core/oas/string/String.ts`, `core/oas/ref/Ref.ts`, `core/context/RenderContext.ts`, `core/dsl/SnippetBase.ts`, `core/dsl/ContentSettings.ts`, `core/dsl/Inserted.ts`, `core/dsl/model/ModelProjectionBase.ts`, `core/dsl/*` directory listing, `cli/commands/clone.tsx`, `docs/skills/skmtc-generator/design.md`, `docs/concepts/variants.md`, `skmtc-generators/gen-zod/src/ZodProjection.ts`, and grep of `core/` for `emit` and `class.*Projection`. **Still not read at time of writing:** the full `docs/skills/skmtc-generator/SKILL.md` (only first 80 lines + a grep of `## ` headings), `docs/llms.md` (the canonical operational-principles source per design.md), and `docs/concepts/how-generators-emit.md`. If nuances flagged below get further reshaped by those, follow-up entries can amend.

---

### 1. `OasBase` exists; §1 fact 4's "no class hierarchy" wording is over-broad [friction]

**What happened:** SKILL.md §1 fact 4 reads:

> OasSchema is a union type, not a class hierarchy. Sibling classes (`OasObject`, `OasArray`, `OasString`, …) each independently implement `.isRef()` returning `false`. … Do not add a `BaseSchema` class.

From that wording I authored:

- `docs/skills/skmtc-generator/eval/invariants.md` §4: "Do not introduce a `BaseSchema` / `BaseOasSchema` / `AbstractOasSchema` class. Do not refactor siblings to extend a common parent."
- Task `001-no-baseschema` rejecting any proposal of a parent class.

Opening `core/oas/string/String.ts:43` and `core/oas/ref/Ref.ts:142`, both classes `extends OasBase`. The shared base is real. The rule the author actually meant must be narrower: don't add a base that provides the type-discriminator methods (`.isRef()`) — those must remain independently implemented per sibling so the union narrows under `switch (schema.type)`. A generic infrastructure base (parse context, base utilities) is fine; it exists.

Additionally: `OasRef` is structurally NOT a member of the `OasSchema` union (`Schema.ts:111-119` lists only `OasArray | OasBoolean | OasInteger | OasNumber | OasObject | OasString | OasUnknown | OasUnion`). `OasRef<T>` is a parallel sibling under `OasBase`. Code that handles either uses the type `OasSchema | OasRef<'schema'>`. The skill's "OasRef is a sibling" phrasing is correct in spirit but doesn't make this structural detail explicit.

**What was expected:** SKILL.md as written admits a literal reading of "no shared base at all." The "Enforcement tests" pointer at the foot of fact 4 doesn't disambiguate.

**Why it matters:** An eval loop optimizing SKILL.md against my draft `invariants.md` would harden the rule against valid patterns — potentially treating `OasBase` itself as the anti-pattern if framed as inheritance. The risk compounds because an LLM building a corpus from SKILL.md inherits the same overstrict reading; two LLMs (judge + corpus author) agreeing on a too-strict rule is the canonical garbage-in/garbage-out for self-improving systems.

The same wording also quietly trains LLMs to generalize "no class hierarchy" to all of SKMTC — including Projections, which DO extend a class tree (see entry 3).

**Possible fixes:** SKILL.md §1 fact 4 could state the rule as "don't add a base above the union that provides type-narrowing methods (e.g. `.isRef()`); those must remain per-sibling so `switch (schema.type)` narrows. The existing `OasBase` (parse context / shared utilities) is fine — it's not the kind of base this rule prohibits." A worked counter-example showing the *right* kind of shared base would help. The OasRef-as-parallel-sibling-not-union-member detail could land in the same paragraph or via a small inheritance diagram.

**Version anchor:** `@skmtc/core@0.4.x` (current), `docs/skills/skmtc-generator/SKILL.md` as of the 2026-05-13 reorganization

**Status:** open

---

### 2. Vocabulary rule: canonical doc bans more than I thought; codebase has drifted, not the rule [friction]

**What happened — initial reading:** The memory entry I had loaded at session start reads "in SKMTC prose, use `register` and `insert` (the actual API verbs); avoid 'emit'." From it I authored task `005-vocab-register-not-emit` with criterion C1 testing whether the response used `emit` anywhere. A grep of `core/` for `emit` returned extensive usage in JSDoc:

- `types/Settings.ts` — "every operation/model it would otherwise emit"
- `types/Preview.ts` — "Operation variant the artifact was emitted for"
- `context/CoreContext.ts` — "emit one sidecar per source File"
- `context/GenerateContext.ts` — "Operation variant the artifact was emitted for"

I concluded the memory rule was broader than reality and softened invariants.md §7 to "emit as plain English is fine."

**What happened — corrected reading via `llms.md`:** Reading `docs/llms.md` (the canonical operational-principles source per `design.md`) surfaced row 111 explicitly:

> | Use casual codegen verbs like *emit*, *dispatch*, *dispatcher*, *stitch* | Name the SKMTC primitive: `register`, `insertOperation`, `insertModel`, `insertNormalizedModel`, `defineAndRegister`, `findDefinition` | These words map to no exported surface in `@skmtc/core`. Using them in code or prose fabricates a mental model that doesn't connect to the API.

The canonical rule bans **four** verbs (`emit`, `dispatch`, `dispatcher`, `stitch`) **in code or prose**. My softening was wrong. The memory was directionally correct. **The drift is in the codebase, not in the canonical doc** — `core/` JSDoc uses these verbs because cleanup against the rule has been incomplete.

**What was expected:** When I grepped `core/` for `emit` and saw it in JSDoc, I assumed the codebase reflected the actual rule. The correct expectation is the inverse — when canonical docs and code disagree, the topic determines which is authoritative. For vocabulary policy, the doc is the rule and the code is in violation.

**Why it matters:** This entry is the inverse failure mode of entry 1.

- **Entry 1:** the doc was overstrict; reading code surfaced a clarifying nuance (`OasBase` exists).
- **This entry:** the doc is the rule; reading code surfaced *legitimate violations that the rule still applies against*.

Whether code or canonical doc is the source of truth depends on the topic. A corpus author who reads only one of the two — or reads them sequentially and updates conclusions monotonically — will land on whichever side of the drift they read last. The robust move: read both, identify the drift explicitly, then anchor to the canonical doc on policy questions and to code on implementation questions.

The corpus impact was directly mis-tuning: I softened task 005's C1 to test only "API verb invention" and excused `emit` in plain English. The corrected version (now in the corpus) checks against all four banned verbs as substitutes for the named primitives, matching `llms.md`.

**Possible fixes:**
- (Done this session) Restore the broader vocabulary list in invariants.md §7 and task 005's C1.
- Codebase cleanup: replace `emit` in `core/` JSDoc with the named primitive verbs or domain-specific language. Mechanical, low-risk, several files.
- More structurally: every operational-principle row in `llms.md` should have a `verify-catalog.ts`-style grep that flags codebase drift. If "no emit/dispatch/dispatcher/stitch" is the rule, the verify step catches every JSDoc comment that violates it.

**Version anchor:** `docs/llms.md` row 111 (last modified 2026-05-27); codebase violations observed in `types/Settings.ts`, `types/Preview.ts`, `context/CoreContext.ts`, `context/GenerateContext.ts`

**Status:** open — `invariants.md` §7 and task 005 now match `llms.md`. Codebase cleanup and verify-catalog row remain undone.

---

### 3. SKILL.md doesn't disambiguate "OasSchema has no hierarchy" from "Projections DO have a hierarchy" [friction]

**What happened:** Grepping `core/` for `class.*Projection` and reading the file paths returned, the Projection structure is:

```
SnippetBase                                    (core/dsl/SnippetBase.ts — abstract root)
├── ModelProjectionBase<EnrichmentType>        (core/dsl/model/ModelProjectionBase.ts)
├── OasOperationProjectionBase<EnrichmentType> (core/dsl/operation/oas/OasOperationProjectionBase.ts)
└── GqlOperationProjectionBase<EnrichmentType> (core/dsl/operation/gql/GqlOperationProjectionBase.ts)
```

Reading `skmtc-generators/gen-zod/src/ZodProjection.ts` revealed the *user-facing* hierarchy has one more layer. Authors don't extend `ModelProjectionBase` directly — they extend the *factory result*:

```
SnippetBase
└── ModelProjectionBase                  (core)
    └── ZodBase = toModelProjectionBase(…)  (package-internal factory call in gen-zod/src/base.ts)
        └── ZodProjection                (the concrete Projection authors write — 47 lines, mostly setup; heavy lifting in toZodValue())
```

The same pattern holds for the operation arms (`TsProjection` extends a `TsBase` factory result, etc.). `ModelProjectionBase`'s own JSDoc (lines 30-39) states this explicitly: "User code extends this class (typically via the `toModelProjectionBase` factory)…"

This is a legitimate, expected class hierarchy — and is the *whole authoring pattern* for generators.

SKILL.md §1 fact 4 ("OasSchema is a union type, not a class hierarchy") is the only place in the skill that addresses "class hierarchy" head-on. The rule is easily generalizable by an LLM to "no hierarchies anywhere in SKMTC."

**What was expected:** While authoring the corpus I came close to adding a holdout task baiting an LLM into proposing a Projection class hierarchy — which would have been a wrong-expected-outcome task (extending the bases IS the right move). The reason I didn't is I happened to read the deno/core/CLAUDE.md that explicitly states the Projection inheritance — but that's not part of SKILL.md.

**Why it matters:** Generator authoring is the skill's primary use case, and Projection inheritance is central. An LLM that generalizes the "no hierarchy" rule will refuse to extend `ModelProjectionBase`, or try to copy its contents inline. This is a likely silent failure: SKILL.md technically doesn't say "don't use Projection inheritance," but it never explicitly says "use it" either.

The eval-corpus risk is sharper: a loop driven by my draft corpus could accidentally encode "no hierarchies" as a SKMTC-wide invariant because the corpus author (me) generalized from a fact that should have stayed scoped.

**Possible fixes:** SKILL.md could open §1 fact 4 with a scope tag — "Within OAS schema types only…" — and elsewhere (perhaps where Projection authoring is discussed) explicitly state the converse: "Projections DO have a class hierarchy. Generator authoring extends one of `ModelProjectionBase` / `OasOperationProjectionBase` / `GqlOperationProjectionBase` via the corresponding factory (`to*Base`)." A small ASCII tree or pointer to `core/dsl/SnippetBase.ts` would help.

**Version anchor:** `@skmtc/core@0.4.x`

**Status:** open

---

### 4. Doc-vs-source drift compounds when an LLM authors an eval corpus [friction]

**What happened:** Entries 1–3 are individually wording / scoping issues. The structural pattern they illustrate together is sharper:

When an LLM authors an eval corpus to drive *automated* improvement of a doc artifact (here, SKILL.md), the LLM's source of truth for the corpus IS the doc being improved. If the doc has overstrict or under-scoped wording, the corpus inherits the same wording. The judge (also an LLM, reading the doc-derived `invariants.md` as ground truth) confirms the corpus's framing. Both can be wrong together, in the same direction. The loop then drives the doc further in that direction.

This is the canonical garbage-in / garbage-out failure mode for self-improving systems, but with a twist: the in is *the artifact you are trying to improve*. The loop has no external anchor unless the corpus author independently verifies the doc against source — which happened only because the user explicitly prompted a confidence-calibration question. Without that, the corpus would have been treated as authoritative and the loop launched against it.

**What was expected:** I assumed reading SKILL.md + memory entries was sufficient context to author a high-quality eval corpus. The assumption is wrong when the doc itself has known-or-unknown discrepancies with source.

**Why it matters:** The session pattern generalizes beyond this one skill. Any time `/autoresearch` (or similar eval-loop tooling) is used to improve a SKMTC doc, the corpus author must verify the doc's claims against source. Without that verification step, the loop optimizes confidence in the doc's existing errors.

The cheapest workable check: before authoring an eval corpus from doc X, grep source for the load-bearing claims X makes. If any grep result contradicts the doc's framing, surface as a friction-log entry *before* the corpus is finalized. (`discrepancy-catalog.md` already encodes this pattern for the 2026-05 docs audit; the same shape could become a corpus pre-flight requirement.)

**Possible fixes:**
- Codify a "corpus pre-flight check" in any future eval-driven skill: before treating doc X as ground truth, sample-verify against source for the load-bearing claims.
- More structurally, `invariants.md`-style ground-truth artifacts should themselves be source-anchored (with grep-runnable verification commands, like `discrepancy-catalog.md` already does) rather than written by hand. The `verify-catalog.ts` pattern is the existing reference.

**Version anchor:** N/A — methodological observation

**Status:** open — candidate for adoption as a corpus-author skill or recipe; cross-references `[[discrepancy-catalog.md]]`

---

### 5. SKILL.md is documented as deriving from `llms.md`, but the synchronization isn't verified [friction]

**What happened:** While reading `docs/skills/skmtc-generator/design.md` (the planning outline for the skill), this passage stood out (lines 222-231):

> Currently I've described it as canonical in `llms.md` with this skill deriving from it. But for authoring specifically, the table is the most operationally-needed content — arguably it should be canonical *here* and `llms.md` should derive.

And design.md's outline §4 says the operational principles table is "the canonical operational principles table — every row from `llms.md`'s 'Operational principles for proposing changes' section." `docs/llms.md` exists (619 lines, 37 KB).

**The SKILL.md is the load-bearing artifact agents load**, but the canonical principles source is `llms.md`. Whether the two are in sync was not verified this session. There is no automated check (analogous to `verify-catalog.ts` for `discrepancy-catalog.md`) that the operational principles in SKILL.md still match the rows in `llms.md`.

**What was expected:** When `design.md` describes a derivation chain like "skill derives from canonical doc," I expect either (a) a single source with the other auto-generated, or (b) a verification step that catches drift.

**Why it matters:** This is entry 4 (doc-vs-source drift compounds in eval corpora) re-applied one layer up. The chain is:

```
llms.md  (canonical)
  ↓ derive (manual, unverified)
SKILL.md  (agent-loaded — what I read this session)
  ↓ derive (manual, unverified)
eval/invariants.md  (judge ground truth — what I just authored)
  ↓ judge feedback
SKILL.md  (loop output)
```

If `llms.md` has been updated and SKILL.md hasn't been re-synchronized, every link below SKILL.md in the chain — including the eval-corpus we built this session — inherits the stale framing. Worse, the `/autoresearch` loop pulls SKILL.md *further* away from `llms.md` over iterations, because the loop has no reference to `llms.md` at all.

Two of the three SKILL.md → invariants.md gaps I found this session (the `OasBase` wording and the `emit` rule) might trace to `llms.md` having been updated more recently than SKILL.md — I don't know, because I haven't compared them. The drift could already exist between `llms.md` and SKILL.md, and I'd be encoding stale rules without noticing.

**Possible fixes:**
- Add `llms.md` → SKILL.md verification to `verify-catalog.ts` (or a new `verify-skill-sync.ts`). For each canonical row in `llms.md`'s operational-principles table, grep SKILL.md for the matching content; flag any mismatch.
- Resolve the canonicity question raised in design.md. If one is canonical, the other becomes a derived view; if both are "in their own right," the verification check is what keeps them honest.
- For LLM corpus authoring: read `llms.md` first, *then* SKILL.md, then compare. Any discrepancy is a pre-existing drift worth surfacing before the corpus solidifies.

**Concrete drift observed this session (added after reading `llms.md`):**

- **`SKILL.md` §1** is titled "The five facts that override default LLM intuitions" and lists five top-priority rules (variants is fact 5).
- **`llms.md` §"Read this first"** is titled "four facts that override default LLM intuitions" and lists four. Variants live in `concepts/variants.md` and `llms.md`'s broader operational-principles table, not at the top.

Either `SKILL.md` added variants as a fifth fact after `llms.md` was last updated (and `llms.md` is stale at the top), or `llms.md` is intentionally pruned and `SKILL.md` has over-promoted variants. Without resolution, the "Read this first" sections in the two artifacts give an agent different first-impression priorities. The corpus's invariants.md inherited "five facts" framing from SKILL.md — fine for now but worth knowing it traces to SKILL.md's framing, not to `llms.md`.

This is direct evidence that the derivation chain `llms.md` → `SKILL.md` is not currently verified.

Also confirmed concretely from `llms.md` row 111: the vocabulary rule is broader than I had inferred from the codebase (see entry 2's correction). Same pattern — without reading `llms.md`, the corpus had encoded a softer rule than the canonical doc requires.

**Version anchor:** `docs/llms.md` last modified 2026-05-27, 619 lines / 37 KB; `docs/skills/skmtc-generator/SKILL.md` 1604 lines

**Status:** open — same shape as entry 4 but one derivation layer up. Worth resolving before launching any `/autoresearch` loop against SKILL.md.

---

### Cross-references

- 2026-05-13-graphql-generator-friction.md #4 — the parametric-vs-feature-toggle distinction (config flags are anti-pattern, parametric values are legitimate). Already verified-fixed by landing in `explanation/why-clone-to-customize.md` and `llms.md`, but **not absorbed into the `skmtc-generator` SKILL.md**. Same shape as entries 1–3 here: rule exists in adjacent docs but doesn't surface in the load-bearing authoring skill. Also a concrete instance of the entry 5 derivation gap — a row added to `llms.md` that didn't propagate down.
- 2026-05-12-stock-generator-docs-vs-source.md — prior doc-vs-source audit; entries 1–3 here are continuations of that pattern.
