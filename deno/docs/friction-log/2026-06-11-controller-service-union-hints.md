# 2026-06-11 — Controller+service replacement and union hints (Milestones C & D)

Executed Milestones C (generated `@RestController` + `<Tag>Service`
seam replacing interfaceOnly; lang-kotlin 0.4.0) and D
(enrichment-asserted discriminators routing undiscriminated/inline
unions through the sealed machinery; gen-kotlin 0.0.5), both released,
both validated on the Sequence schema. Distinct from
`2026-06-11-spring-server-execution.md` (the Milestone A arc).

## Knowledge acquired

Operating across multi-artifact generator design, sub-schema
enrichment addressing, and local/registry wrapper composition.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `toKtValue`'s `destinationPath` couples TWO concerns: where imports register AND where inline-shape siblings synthesize. The synthesis dedup keys `(name, exportPath)`, so building the same logical type against two destination files duplicates classes in one Kotlin package. | Generator skill / lang-template: "multi-artifact generators sharing types must share a destination file" (entry #1) |
| K2 | An item that THROWS mid-value-construction leaves an import-only residue file: the Driver creates the file and constructors register imports before the throw; only the Definition is lost. Artifacts of errored items are partial, not absent. | Engine-semantics note for skmtc-debug / manifest docs (entry #3) |
| K3 | Enrichments reach a generator with NO declared `toEnrichmentSchema` as untyped data at `context.settings.enrichments[id][refName][variant]` — runtime narrowing required; the Valibot schema is the typed-path option, not a gate. | Generator skill enrichments section — the untyped fallback path is undocumented |
| K4 | Sub-schema enrichment addressing works by resolving config paths to PARSED schema node objects once per document (WeakMap keyed on node identity — stable per run). This is the only way to hand site-specific config to value-layer snippets that don't know their own path. | Candidate pattern for the generator skill if a second generator needs sub-schema enrichments |
| K5 | Non-ref schema classes implement `resolveOnce()` returning themselves (the union duck-type), so `schema?.resolveOnce()` is always safe — no `isRef()` pre-check needed before resolving. (Dmitri's simplification.) | API reference row for `resolveOnce` on the `OasSchema` union |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Two-file artifact splits silently duplicate inline-shape synthesis | friction | resolved 2026-06-11 (note 25 amendment: one file per tag) |
| 2 | Module-scope generator state is a second dual-copy hazard (gen-level) | friction | open |
| 3 | Errored items leave import-only residue files | polish | open |
| 4 | Consumer config can alias one synthesized identity from several sites | friction | resolved 2026-06-11 (claim dedup) |

---

### 1. Two-file artifact splits silently duplicate inline-shape synthesis [friction]

Milestone C step 2: the spec put `<Tag>Service` and `<Tag>Controller`
in separate files, both needing the same parameter/body/return types.

**What happened:** Calling `toKtValue` once per destination (so each
file gets its own DTO imports) made inline shapes (`PostUsersBody`)
synthesize TWICE — the fallback-name sibling dedups on
`(name, exportPath)`, two destinations → two same-named classes in one
package → Kotlin compile error. No engine warning; caught by the
byte-pinned e2e.

**What was expected:** That type construction was destination-neutral —
imports per file, synthesis deduped globally.

**Why it matters:** K1's coupling is invisible at the API surface;
any future generator emitting one operation's types into several files
(client + server pair, DTO + validator pair) hits the same wall. The
clean resolution was architectural (one file per tag), not a
workaround — that design rule should be stated so the next
multi-artifact generator starts there.

**Possible fixes:** record the design rule in the generator skill;
longer-term, the synthesis path could dedup package-wide rather than
per-file (needs a package-identity concept).

**Version anchor:** `@skmtc/gen-kotlin@0.0.4`, `@skmtc/gen-kotlin-spring@0.1.0`, `@skmtc/core@0.9.0`

**Status:** resolved 2026-06-11 (note 25 amendment: one file per tag)

---

### 2. Module-scope generator state is a second dual-copy hazard (gen-level) [friction]

Milestone D step 3: sequence-demo wrappers mixed a LOCAL gen-kotlin
source (for unpublished 0.0.5) with `jsr:@skmtc/gen-kotlin-spring@0.1.1`
(which pins `jsr:@skmtc/gen-kotlin@0.0.4`).

**What happened:** Two copies of gen-kotlin landed in one bundle. The
wrapper's `toKotlinEntry({ basePackage })` set the LOCAL copy's
module-scope state; spring's KtRef path ran the JSR copy, whose
`basePackage` was never set → 159 `basePackage is not set` errors
across every spring item, while all model files generated fine —
maximally confusing until the stack trace showed `bundle.js` line
numbers from the second copy.

**What was expected:** That the earlier lang-level dual-copy finding
(`instanceof` breakage) was the whole hazard class.

**Why it matters:** Dual copies break TWO ways: cross-copy
`instanceof` (lang-level, logged in
`2026-06-11-spring-server-execution.md` #1) and SPLIT MODULE-SCOPE
STATE (gen-level, this entry). Any generator using the documented
`setBasePackage` module-state pattern is exposed whenever a local-path
wrapper coexists with a jsr pin of a DEPENDENT generator. The rule
generalizes: a wrapper project must resolve exactly ONE copy of every
shared package — and during pre-release validation that means pointing
ALL wrappers at local sources, not just the changed one.

**Possible fixes:** unresolved — candidates: a `doctor` check for
duplicate `@skmtc/*` package versions in a bundle; a CLI bundle-time
warning; documenting the all-local-or-all-jsr wrapper rule in the
local-generator task card.

**Version anchor:** `@skmtc/gen-kotlin@0.0.5-dev`, `@skmtc/gen-kotlin-spring@0.1.1`, `@skmtc/cli@0.5.1`

**Status:** open

---

### 3. Errored items leave import-only residue files [polish]

Milestone D e2e: asserting the invalid-hint throw's effect.

**What happened:** The thrown item (`Broken`) still produced an
artifact — `package … import kotlinx.serialization.Serializable` with
no definitions — because the Driver creates the file and the value
constructor registers imports before the throw aborts the Definition.
The test had to assert "no `data class Broken`" rather than "file
absent".

**What was expected:** Fail-open meant the errored item contributes
nothing.

**Why it matters:** Consumers get a compilable-but-empty `.generated.kt`
for errored items — easy to mistake for successful-but-empty output
when debugging, and it survives `clean`-less regenerates. The manifest
records the error, but the on-disk evidence points the other way.

**Possible fixes:** unresolved — the engine could discard a file whose
registrations all came from an errored item, or the debug skill could
document residue files as an error signature.

**Version anchor:** `@skmtc/core@0.9.0`

**Status:** open

---

### 4. Consumer config can alias one synthesized identity from several sites [friction]

Milestone D step 3: the real Sequence schema hints `structure` on BOTH
`ListPrice` and `PriceResponse` with the same `name: PricingStructure`.

**What happened:** Both hint sites collected membership claims for the
same members under the same parent → duplicate supertype clauses
(`: PricingStructure, PricingStructure`) would have rendered. The
fixture-only e2e couldn't catch it — only the real schema did. Fixed
with per-`(parent, tag)` claim dedup.

**What was expected:** One hint site per synthesized identity.

**Why it matters:** Whenever an enrichment lets the CONSUMER name a
synthesized artifact, several config sites aliasing one name is the
common case, not the edge (the same response shape appears on N
models). Synthesis-by-consumer-name needs idempotency at every
accumulation point, and fixtures built from the spec's worked example
won't expose it — only production schemas do. Validate-on-real-schema
belongs in the gate for any enrichment milestone.

**Possible fixes:** recorded in spec 26 + reference; gate guidance
(real-schema validation step) could be added to the milestone protocol
notes.

**Version anchor:** `@skmtc/gen-kotlin@0.0.5`

**Status:** resolved 2026-06-11 (claim dedup)

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #2 — gen-level dual-copy (module state) | Completes the dual-copy hazard class: state splitting is harder to diagnose than instanceof breakage and hits the documented module-state pattern; every pre-release validation with mixed local/jsr wrappers is exposed | SKMTC code (doctor/bundle duplicate-package check) + CLI skill task-card rule |
| 2 | #1 — destinationPath couples imports + synthesis | The next multi-artifact generator will re-derive this the hard way; the one-file rule is cheap to state | Generator skill design-rule note |
| 3 | #3 — import-only residue files | Misleading on-disk evidence for errored items; cheap to document as an error signature | skmtc-debug skill note or engine change |

