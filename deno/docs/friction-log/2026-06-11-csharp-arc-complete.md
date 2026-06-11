# 2026-06-11 — C# arc complete (CS-A → CS-D in one session)

The full C# language arc on the single-document spec (note `31`):
kickoff D1–D16 + Stainless/Speakeasy comparison addendum, nine
scratch-proofs, then four milestones built, gated, and released —
`lang-csharp` 0.1.0→0.3.0, `gen-csharp` 0.0.1→0.1.0,
`gen-csharp-aspnet` 0.0.1→0.1.2, plus `core@0.9.1` (a parse bugfix
released mid-arc with both cascades). Gates included a live ASP.NET
HTTP round-trip and a 530-file production-schema build.

## Knowledge acquired

Building and releasing a third-language arc end to end, including a
core release and live web-app gates.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | A core release does NOT propagate to the fleet by itself: the fleet release script only cascades WORKSPACE dependencies, so external `@skmtc/*` pins (core, lang-*) need a manual fleet-wide repin + per-package version bump before `deno task release`. Additionally the CLI binary must be REINSTALLED (bundle writes worker/core pins "at the CLI's own versions" — an old CLI re-pins old versions), and hand-written project `deno.json` pins are NOT overwritten by `skmtc bundle` (only missing pins are added). Three separate manual steps, each discovered by a failing gate. | `deno/CLAUDE.md` → Releasing + the `skmtc-cli` skill need a "releasing core" runbook |
| K2 | Three C# type-system constraints were caught by compile/byte gates, NOT by the kickoff or scratch-proofs: (a) `[JsonDerivedType(typeof(X))]` compile-requires `X : Parent`, so the membership inversion CANNOT dissolve (kickoff kernel #3 was wrong); (b) a record derives from ONE base record — multi-parent membership is unrepresentable; (c) CS1737 — optional (defaulted) parameters must trail required ones, so Kotlin's named-args seam ordering does not port. | The adding-a-language playbook (`concepts/languages.md` + Track 2 DoD) should require TYPE-SYSTEM constraint probes in the scratch-proof list, not just serialization round-trips |
| K3 | `HttpResponse.WriteAsJsonAsync(value, cancellationToken)` OVERRIDES a previously assigned `Response.ContentType` — emitting `application/problem+json` requires the `contentType:` parameter overload. | gen-csharp-aspnet clone-seam note (the handler is a customization surface) |
| K4 | core's `camelCase` preserves a leading capital (`'X-Tenant'` → `'XTenant'`), so C# parameter names need a manual first-character lowering after it. | helpers API reference note; any future lang with camelCase parameter conventions hits this |
| K5 | `GenerateContextType` exposes NO logger — a generator wanting a diagnostics channel (the once-per-format unknown-scalar warning) must fall back to `console.warn`. The class `GenerateContext` HAS a public `logger`; the interface hides it. | API gap worth a decision: widen the interface or document the `console.warn` convention |
| K6 | STJ's out-of-order-discriminator rejection is `NotSupportedException`, not `JsonException` — a catch-block written from the JsonException pattern silently misses it. | Recorded in note 31; gen-csharp reference already documents the flag |
| K7 | Accumulator-style OPERATION entries (no projection, no ContentSettings) read enrichments by raw-walking `context.settings.enrichments[id][path][method].main` with `isRecord` guards, while still declaring `toEnrichmentSchema` on the entry for the contract — the declared schema and the raw walk coexist by design (the gen-kotlin-spring precedent, now replayed). The generator skill's enrichment sections only cover the projection/ContentSettings route. | `skmtc-generator` skill gap: the accumulator enrichment-read pattern |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Core release ripple is a three-step manual protocol discovered by failing gates | friction | open |
| 2 | Cross-language kickoff claims need type-system scratch-proofs, not prose | friction | open |
| 3 | A stale server on the gate port produced false verification twice — one wasted release | friction | open |
| 4 | Hand-patch the generated output to prove a fix before baking it into the generator | win | open |

---

### 1. Core release ripple is a three-step manual protocol discovered by failing gates [friction]

CS-C's CC0 required releasing `core@0.9.1` (a parse fix). The
`skmtc/deno` cascade worked as documented — but getting the fix to
actually REACH a CLI-driven generate took three more undocumented
steps, each surfaced by a still-failing gate rather than by docs.

**What happened:** After `core@0.9.1` published (and the skmtc/deno
cascade repinned cli/worker/lang-*), the Sequence generate STILL
failed with the old parse error. Diagnosis chain: (1) the fleet's 20
generators pin core exactly and its release script does not repin
external deps → manual fleet-wide repin + patch-bump + fleet cascade;
(2) the demo project still failed → its hand-written `deno.json`
pinned `worker@0.3.13`/`core@0.9.0`, and `skmtc bundle` only ADDS
missing pins, never overwrites; (3) the CLI binary itself bakes the
worker/core versions it pins at bundle time → reinstall at `cli@0.5.3`.

**What was expected:** that "release via the cascade" was the whole
protocol — the documented flow ends at `deno task release`.

**Why it matters:** the dual-copy hazard makes partial propagation
silently dangerous (two core copies in one composition break
`instanceof` across the worker/generator boundary), so the manual
steps are not optional hygiene — they are correctness requirements
with no checklist. The kotlin arc never released core mid-arc, so
this path was unexercised until today.

**Possible fixes:** unresolved — candidates: a "releasing core"
runbook in `deno/CLAUDE.md`; the fleet release script learning an
`--external-repin` mode; `skmtc bundle` warning when project pins
trail the CLI's; `doctor` checking project worker/core pins against
the registry's latest.

**Version anchor:** `@skmtc/core@0.9.1`, `@skmtc/cli@0.5.3`

**Status:** open

### 2. Cross-language kickoff claims need type-system scratch-proofs, not prose [friction]

The kickoff's nine scratch-proofs all targeted SERIALIZATION behavior
(round-trips, wire shapes, header-pair compilation). All nine passed —
and yet three kickoff-grade errors survived into implementation,
caught only by byte-pins and compile gates.

**What happened:** (1) kernel #3 claimed the membership scan
dissolves; `[JsonDerivedType(typeof(Dog))]` compile-requires
`Dog : Animal`, so the member-side structural facts still need the
inversion — corrected at CS-B spec time. (2) The first CS-B fixture
byte-pinned `record Cat : Animal, Spirit`, which Deno tests passed
happily and `dotnet build` would have rejected — C# records have ONE
base record. (3) The first aspnet seam rendered
`(int? limit = null, string xTenant)` — CS1737, optionals must trail.
None of these were scratch-proofed because the scratch list was
derived from the serialization-centric D-questions.

**What was expected:** that nine passing scratch-proofs meant the
design's C#-specific risk was retired.

**Why it matters:** the per-language risk has TWO axes —
serialization semantics AND declaration-level type-system
constraints — and the playbook only systematically probes the first.
Kotlin got away with it because its kickoff author had the
constraints internalized; C#'s divergences (single base record,
parameter ordering, compile-required base clauses) live exactly in
the second axis. The gates caught everything, but two of the three
were caught AFTER tests passed in Deno — the failure would have
shipped to the consumer compile without the runtime/byte gates.

**Possible fixes:** unresolved — candidates: the Track 2 DoD gains a
"type-system constraint probe" item (multi-inheritance rules,
parameter-ordering rules, declaration-position rules per language);
the adding-a-language section in `concepts/languages.md` names the
two axes; kickoffs claiming "X dissolves in this language" require a
compile-level scratch-proof of the claim.

**Version anchor:** `@skmtc/lang-csharp@0.3.0`, `@skmtc/gen-csharp@0.1.0`

**Status:** open

### 3. A stale server on the gate port produced false verification twice — one wasted release [friction]

The CS-D live gate (`dotnet run` + curl) verified the error channel's
content type.

**What happened:** the first fix (pre-setting `Response.ContentType`)
was "verified", released as 0.1.2's predecessor (0.1.1), regenerated —
and still showed `application/json`. The second fix (the overload) was
hand-verified — and ALSO showed `application/json`. The actual cause:
`pkill -f` had missed the first server instance; every new `dotnet
run` failed to bind (`address already in use`, visible only in the
backgrounded log) and curl was hitting the original stale binary the
whole time. The first fix's release was based on a false NEGATIVE of
the bug (the stale server predated the bug demonstration), so 0.1.1
shipped a fix that had never been exercised — and turned out
insufficient for a second reason (`WriteAsJsonAsync` overrides the
pre-set header, K3).

**What was expected:** that a fresh `dotnet run &` + sleep + curl was
a fresh observation.

**Why it matters:** the live-gate procedure is now load-bearing for
every milestone (the bootRun analog), and backgrounded servers fail
to bind SILENTLY from the harness's perspective — the gate then
measures the previous build. One wasted immutable release (0.1.1) is
the direct cost; the subtler cost is that a passing gate stops being
evidence. "Test it, don't wonder" requires the test to actually hit
the new bytes.

**Possible fixes:** unresolved — candidates: a canonical live-gate
recipe (kill by port via `lsof -ti :PORT` before EVERY launch; assert
the new process binds by checking the log for the listening line
before curling); a tiny `serve-and-curl` script in the demos
workspace; noting the pattern in `skmtc-debug`.

**Version anchor:** `@skmtc/gen-csharp-aspnet@0.1.1` (the wasted release)

**Status:** open

### 4. Hand-patch the generated output to prove a fix before baking it into the generator [win]

The content-type fix that finally worked was developed by editing the
GENERATED `ApiExceptionHandler.generated.cs` in the demo tree by
hand, rebuilding, and curling — only after the target bytes were
proven live did the generator change to produce them, followed by
release → regenerate → one final verification.

**What happened:** fix candidate #1 went straight into the generator
and through a release cycle on an unverified hypothesis (compounded
by entry #3's stale server). Fix candidate #2 was proven against the
real host in under a minute by hand-patching the generated file —
no release, no regenerate, no bundle in the loop.

**Why it matters:** generated output is ordinary source in the
consumer tree; the edit-build-curl loop on it is seconds, while the
generator loop (edit → test → version → cascade release → repin →
bundle → generate → build → run) is minutes and burns immutable
versions. Another agent facing "the generated code misbehaves at
runtime" would likely iterate through the generator loop by default —
the demo trees exist precisely so the inner loop can run on the
output directly. This is the render-side analog of the scratch-proof
discipline and is written down nowhere.

**Possible fixes:** codify as a task card or one-liner in the
`skmtc-generator` skill ("iterate on generated output in place; bake
the proven bytes into the generator last") or in the demos workspace
README.

**Version anchor:** `@skmtc/gen-csharp-aspnet@0.1.2`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — Core release ripple | Three undocumented correctness-critical steps behind every future core release; the dual-copy hazard makes partial propagation silently wrong | `deno/CLAUDE.md` Releasing runbook + `skmtc-cli` skill; consider a `doctor` pin check |
| 2 | #2 — Type-system scratch-proofs | The next language (Go/Rust/PHP) will have its own declaration-level constraints; the playbook currently only probes serialization | `concepts/languages.md` adding-a-language + Track 2 DoD item |
| 3 | #3/#4 — Live-gate discipline pair | The live gate is now the arc's decisive evidence; a stale server makes it measure the wrong build, and the inner loop on generated output is the cheap path nobody wrote down | small live-gate recipe + a line in `skmtc-generator`/`skmtc-debug` |
