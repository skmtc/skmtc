# 2026-06-11 — Spring server generator execution (Milestone A steps 1–6 + Sequence stress test)

Executed the full Milestone A tracker: `lang-kotlin@0.3.0` (interface
kind + function-signature grammar), `gen-kotlin-spring@0.0.1` (scaffold,
tag-grouping accumulator, byte-pinned e2e), `gen-kotlin@0.0.3`,
releases via both cascades, two persistent workspace demos
(`kotlin-demos`, `kotlin-spring-demo`) with bootRun smoke, and a
production-scale stress test against the 2MB Sequence API schema
(113 paths / 171 operations / 328 schemas → 355 files, all compiling).

## Knowledge acquired

Operating across the lang-kotlin/gen-kotlin-spring boundary, the test
harness, the release cascades, and the CLI consumption path.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | Two versions of one lang package in a single module graph are a structural hazard: any `instanceof` against a lang class fails across copies. Concretely, `KtFile.toString()`'s `importEntry instanceof KtImport` check silently skipped same-package suppression when gen-kotlin (lang 0.2.0 via jsr) composed with gen-kotlin-spring (lang 0.3.0). | skmtc-generator skill (composition section) + lang-template: "peer generators sharing a lang package must pin the SAME version"; deeper: core/lang design question (entry #1) |
| K2 | Module-scope generator state (`basePackage`) races across test FILES: `deno test` loads all test modules in one process, so module-scope `toKotlinEntry(...)` calls overwrite each other before tests run. Entries must be constructed inside each fixture run. | Test-harness note for the generator skill / future `skmtc-lang-<X>` template — the per-run-safe claim ("fresh Worker per run") does NOT extend to test processes |
| K3 | An accumulator-style operation generator needs NO operation projection-base veneer — `KtSnippet` + the `defineAndRegister` function + `findDefinition` covered the whole Spring generator. lang-kotlin still ships only the model veneer; note 19's "operation veneers ship with the Spring milestone" prediction turned out wrong. | skmtc-lang-kotlin skill status note (done this session); worth a line in the lang-template: veneers are demand-driven, accumulators don't demand one |
| K4 | The fleet release script treats ANY workspace member whose version is unpublished as a direct release — adding a new package to the workspace means the next `deno task release` publishes it, ready or not. Sequencing dance used here: develop with NO jsr pin on the sibling (workspace path mapping → single lang copy), restore the explicit `jsr:` pin immediately before the step-6 cascade so dependency ordering holds. | Releasing section of `skmtc/deno/CLAUDE.md` or the cli skill: "a new workspace member is implicitly queued for the next cascade" |
| K5 | The `@ts-expect-error` needed for `toGeneratorConfigMap` in test harnesses attaches to different AST nodes depending on expression shape: on the property line for an object literal, but on the conditional expression's first token for a ternary-bodied arrow. Four check-fail cycles to place two directives. | Entry #4; candidate for a typed core test helper that erases the generic instead |
| K6 | `OasParameter.toSchema()` throws (rather than returning undefined) when neither `schema` nor matching `content` exists; `OasResponse.toSchema()` returns undefined. The asymmetry matters when writing parameter/response handling in one method builder. | API reference rows for the two `toSchema` signatures |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Dual lang-package copies silently disable `instanceof`-guarded rendering behavior | friction | open |
| 2 | `--json` stdout is polluted by WARN log lines at parse-issue volume | friction | open |
| 3 | Core parse drops an ordinary-looking GET with `Cannot use 'in' operator to search for 'allOf' in undefined` | friction | open |
| 4 | `toGeneratorConfigMap` typing forces shape-dependent `@ts-expect-error` placement in every test harness | friction | open |

---

### 1. Dual lang-package copies silently disable `instanceof`-guarded rendering behavior [friction]

Milestone A step 3: the byte-pinned e2e ran gen-kotlin-spring (pinning
`jsr:@skmtc/lang-kotlin@0.3.0`) composed with published
`jsr:@skmtc/gen-kotlin@0.0.2` (pinning `jsr:@skmtc/lang-kotlin@0.2.0`).

**What happened:** The worked-example e2e failed: `UsersApi.generated.kt`
contained `import com.example.api.User` / `import com.example.api.CreateUserBody`
— same-package imports that `KtFile` should suppress.
`KtFile.toString()` guards its re-keying/suppression path with
`importEntry instanceof KtImport`; the peer import was constructed by
gen-kotlin's Driver path using lang-kotlin **0.2.0**'s `KtImport`
class, while the tag file was lang-kotlin **0.3.0**'s `KtFile`. The
`instanceof` failed across the two copies and the import fell through
to the non-suppressing generic render. No error, no warning — just
byte-different output. Fix: `gen-kotlin@0.0.3` re-pins lang 0.3.0 so
the composition holds a single copy; the rule is recorded in the
gen-kotlin-spring reference and the skill's status note.

**What was expected:** That two additive-compatible versions of the
lang package could coexist — 0.3.0 only ADDS exports, so semver
intuition says a 0.2.0-consumer and a 0.3.0-consumer compose fine.

**Why it matters:** This generalizes beyond `KtFile`. The lang-package
architecture distributes classes across packages that meet inside one
`GenerateContext` — files, imports, definitions, snippets from
*different generators* flow into shared registries. Every
`instanceof` against a lang class (`KtImport`, `KtAnnotation` in
`isKtAnnotated`, `MockRoutesList`-style accumulator guards) is a
latent cross-copy failure whenever two generators pin different
versions of the same lang package — and jsr makes that trivially easy
to do. The failure mode is the worst kind: silent output drift, only
catchable by byte-pinned e2e over a *composed* pair. TypeScript never
hit this because the fleet releases via one cascade that aligns pins —
the protection is operational (cascade discipline), not structural.

**Possible fixes:** unresolved — candidates: (a) duck-typed
discriminants instead of `instanceof` in lang render paths (e.g.
`importEntry.langId === 'kotlin' && importEntry.kind === 'import'`);
(b) a `doctor`/bundle-time check that a project's generator set
resolves exactly one version per `@skmtc/lang-*` package; (c) declare
lang packages effectively-peer-dependencies and document the cascade
as the alignment mechanism (status quo, now written down). (a) and
(b) are complementary; needs reflection on whether core's own classes
(`DefinitionBase`, `SnippetBase`) carry the same risk across core
versions.

**Version anchor:** `@skmtc/core@0.9.0`, `@skmtc/lang-kotlin@0.2.0`+`0.3.0` (the colliding pair), `@skmtc/gen-kotlin@0.0.2`, `@skmtc/gen-kotlin-spring@0.0.1`

**Status:** open

---

### 2. `--json` stdout is polluted by WARN log lines at parse-issue volume [friction]

Sequence stress test: `skmtc generate sequence-demo --json` against a
schema producing 907 parse warnings.

**What happened:** The strict-JSON contract says a single JSON object
on stdout, logs on stderr. In practice every parse-issue WARN line
(`[WARN] 2026-06-11 … {"protocol":"oas","level":"warning",…}`) was
interleaved on **stdout** before the result object — 932KB of mixed
stream. `skmtc generate --json | jq` (or any naive `JSON.parse` of
stdout) breaks; I had to extract the trailing object by searching for
`{\n  "kind"`. The small demo schemas never showed this because they
produce zero parse issues.

**What was expected:** Logs/warnings on stderr per the documented
agent-native mode contract (`--json`: "Single JSON object on stdout.
Logs/warnings on stderr.").

**Why it matters:** The strict-JSON mode exists precisely for agents
and CI; its one invariant is machine-parseable stdout. The contract is
documented and the small-schema happy path complies, so consumers
write `| jq` pipelines that then break on the first real-world schema
— a contract violation that only manifests at production scale is
worse than one that always manifests.

**Possible fixes:** route the parse-issue logger to stderr when
`--json`/non-TTY mode is active (likely a logger-sink wiring miss in
the CLI or worker host, not a contract design problem). A regression
test: generate a fixture WITH parse issues under `--json` and
`JSON.parse` the whole stdout.

**Version anchor:** `@skmtc/cli@0.5.1`, `@skmtc/core@0.9.0`

**Status:** open

---

### 3. Core parse drops an ordinary-looking GET with `Cannot use 'in' operator to search for 'allOf' in undefined` [friction]

Sequence stress test: 170 of 171 operations generated; one error-level
parseIssue.

**What happened:** `GET /usage-events` was dropped at parse with
`INVALID_OPERATION` / `Cannot use 'in' operator to search for 'allOf'
in undefined` (location `parse:paths:/usage-events:get:get`). The
source operation looks well-formed: standard keys
(`tags/summary/description/operationId/parameters/responses`), no
null nodes anywhere in its subtree (walked programmatically), and its
POST sibling on the same path parsed fine. The fail-open contract
worked as designed — loud manifest error, run continued — but the
diagnosis dead-ends: the message names the internal check (`'allOf' in
x`), not which node `x` was derived from, and the location trail stops
at the operation level (`…:get:get`).

**What was expected:** Either a successful parse (the operation looks
ordinary) or an error message naming the offending sub-node (a
parameter index, a response code, a content path).

**Why it matters:** Two distinct problems. (1) A core parse bug: some
code path does `'allOf' in x` on an `undefined` that ordinary schema
shapes can produce — 1-in-171 frequency on a real production schema
means real consumers will hit it. (2) An error-reporting gap: the
stack-trail granularity stops above the node that failed, so the
schema author can't act on the issue without bisecting the operation
by hand. The verify-first debugging stance depends on locations that
point at the cause.

**Possible fixes:** unresolved — needs a minimal repro (bisect
`/usage-events:get` down to the failing node; suspects include the
`$ref`-with-sibling-`example` response schema and header-parameter
handling), then a guard + a deeper stackTrail push in the failing
parser. Schema preserved at
`kotlin-spring-demo/2024-07-30.product.json` for the repro.

**Version anchor:** `@skmtc/core@0.9.0` (parse), schema: Sequence API 2024-07-30

**Status:** open

---

### 4. `toGeneratorConfigMap` typing forces shape-dependent `@ts-expect-error` placement in every test harness [friction]

Writing gen-kotlin-spring's unit + e2e harnesses around `toArtifacts`.

**What happened:** `toArtifacts`'s `toGeneratorConfigMap` is typed
`<EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>`
— the caller must supply a function generic over ALL possible
enrichment types, but factory-emitted entries are monomorphic
(`toEnrichmentSchema?: () => GenericSchema<undefined>`), so no real
entry ever satisfies it. Every harness needs an `@ts-expect-error`
(gen-kotlin's existing tests carry one with the comment
"factory-emitted transform is monomorphic over Acc" — itself stale,
`Acc` is gone). Worse, WHERE the directive must sit depends on the
expression shape: object-literal return → on the offending *property*
line; ternary-bodied arrow → on the *conditional expression's first
token*; block-bodied arrow with a `return` → reported on the property
key of the whole `toGeneratorConfigMap` field. It took four
check-fail-move cycles to land two directives, with TS2578
"unused directive" errors pointing at lines that then errored once
the directive moved away.

**What was expected:** That a config map of real entries assigns
cleanly to the parameter that exists to receive real entries — or at
minimum that one documented suppression location works regardless of
expression shape.

**Why it matters:** Every future generator test harness (each new
lang/gen package writes at least one) pays this tax, and the
suppression comment cargo-cults forward stale wording ("monomorphic
over Acc"). A type-level mismatch between what the engine accepts at
runtime and what the signature admits pushes `@ts-expect-error` into
the prescribed pattern — corrosive in a codebase whose stance is
"type safety is foundational; never bodge".

**Possible fixes:** unresolved — candidates: (a) loosen
`GeneratorsMapContainer`'s enrichment generic (e.g.
`GeneratorConfig<never>`-covariant or an existential wrapper) so
monomorphic entries assign; (b) export a test helper
(`toTestGeneratorConfigMap(entries)`) that owns the single suppression
internally; (c) at minimum, document the directive placement rule in
the harness scaffold the skills hand out.

**Version anchor:** `@skmtc/core@0.9.0`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — Dual lang-package copies disable `instanceof` guards | Silent output corruption baked into the multi-package lang architecture; every future lang package and generator pair inherits it, and only composed byte-pinned e2e catches it | SKMTC code (duck-typed discriminants in lang render paths and/or a doctor single-lang-version check); skill rule already landed this session |
| 2 | #3 — Core parse drops an ordinary GET (`'allOf' in undefined`) | Real production schema, 1-in-171 hit rate; plus the error location stops above the failing node so consumers can't self-serve | SKMTC code (core parse guard + deeper stackTrail); repro schema preserved in-workspace |
| 3 | #2 — `--json` stdout polluted by WARN lines | Breaks the one invariant of agent/CI mode exactly when schemas are real; trivial pipelines (`\| jq`) fail | SKMTC code (CLI logger sink routing) + regression test with a parse-issue fixture |

