# 2026-06-11 — Kotlin milestones: sealed-interface `oneOf` shipped + Spring spec

Phase D closeout (the Gradle compile validation), full execution of
Milestone B (sealed-interface `oneOf`: `lang-kotlin@0.2.0` with the
`KtSupertyped` protocol + `gen-kotlin@0.0.2`, released and
registry-E2E'd), and the Milestone A (Spring server generator) spec
with its pre-spec scratch validation.

## Knowledge acquired

Generator authoring against lang-kotlin/gen-kotlin, CLI consumption of
factory entries, and two target-language toolchains (kotlinx
serialization runtime, Spring Boot MVC).

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | A Deno workspace MEMBER's own `deno.json` import pin shadows a ROOT `deno.json` mapping for the member's files. `gen-kotlin/deno.json`'s `jsr:@skmtc/lang-kotlin@0.1.0` silently won over the root's `../skmtc/deno/lang-kotlin/mod.ts` temp mapping — the e2e ran against the published 0.1.0 while I believed it ran local 0.2.0. The F5/F6-era gotcha ("member NAME resolution beats jsr pins") is the *inverse* direction; this one isn't recorded anywhere. | skmtc-generator skill (cross-workspace dev section) or `skmtc-generators` root CLAUDE.md; pairs with the existing cross-workspace scratch gotcha |
| K2 | Core's parse COLLAPSES single-member unions: `oneOf: [X]` arrives at generators as `X` itself — inline members as the member schema, ref members (in a full-document parse) dereferenced into a structural copy. Verified on core 0.9.0 with a probe (`toSchemaV3` + full `toArtifacts`). No generator ever sees `members.length === 1`. | Core OAS parse semantics aren't documented anywhere a generator author would look; belongs in skmtc-generator skill §4 (or a parse-semantics reference) |
| K3 | The CLI's `worker.ts` does `import g from '<import-map key>'` — the key must resolve to a module whose DEFAULT export is the entry object. For factory-entry packages (no default export by design, e.g. gen-kotlin), the consumption shape is a local wrapper: key → `./gen-x-app/mod.ts` default-exporting `toXEntry({ … })`, with the factory imported via a FULL `jsr:` specifier (bypasses the map, no self-reference). Pointing the key at the package `mod.ts` fails at bundle with `No matching export … for import "default"`. | skmtc-cli skill's local-generator card covers default-export-required but NOT the factory-entry wrapper recipe; gen-kotlin.md now shows the wrapper — the CLI skill should too |
| K4 | kotlinx.serialization facts settled by scratch: `@Serializable` IS legal on a sealed interface; closed polymorphism is automatic (no `SerializersModule`); `@JsonClassDiscriminator` requires `@OptIn(ExperimentalSerializationApi::class)`; a serialized property may NOT share the discriminator name — omitting it from subtypes round-trips cleanly (decode injects from the envelope, encode re-emits). | Captured in spec 22 + gen-kotlin.md this session; none |
| K5 | Spring Boot facts settled by scratch: handler annotations declared on an INTERFACE bind through an implementing `@RestController`; with `spring-boot-starter-json` (Jackson) excluded and `kotlinx-serialization-json` on the classpath, `KotlinSerializationJsonHttpMessageConverter` auto-registers and serves `@Serializable` DTOs with `@SerialName` wire fidelity; **`kotlin-reflect` is required** — without it every request 500s with `NoClassDefFoundError: kotlin/reflect/jvm/ReflectJvmMapping`, body empty, error only in the server log. | Goes into gen-kotlin-spring's consumer docs at Milestone A step 5 (already in spec 23) |
| K6 | Release-process precedent set by Dmitri this session: a FINISHED, dependent-free package delta gets cascade-published to the local JSR mid-milestone rather than carried via temp cross-repo path mappings. Re-releasing a 0.x patch later is cheaper than the silent-shadowing risk temp mappings carry (see K1 — the risk materialized within hours). | `skmtc/deno/CLAUDE.md` "Releasing" could note this; currently only the never-publish-by-hand rule exists |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Member pin silently shadows the root temp mapping — e2e ran the wrong artifact | friction | open |
| 2 | Spec decision written against unverified parse semantics — implemented, then deleted | friction | open |
| 3 | Factory-entry wrapper wiring failed twice before landing | friction | open |
| 4 | `kotlin-reflect` absence fails as an empty-body 500 | polish | open |
| 5 | Scratch the TARGET-LANGUAGE runtime before spec sign-off | win | open |

---

### 1. Member pin silently shadows the root temp mapping — e2e ran the wrong artifact [friction]

Milestone B step 3: gen-kotlin developed against unpublished
lang-kotlin 0.2.0 via a root-deno.json temp mapping (the Phase D
step-4 pattern).

**What happened:** The byte-pinned e2e for the new sealed output
failed on exactly one feature — the ` : Animal` supertype clause —
while the gen-side features (wire tag, discriminator omission) passed.
Cause: `gen-kotlin/deno.json` still pinned
`jsr:@skmtc/lang-kotlin@0.1.0` (added at Phase D step 6), and a
member's own pin wins over the root mapping for the member's files. The
whole step-2 "existing e2e green" gate had silently run against the
published 0.1.0 too.

**What was expected:** That the root `deno.json` temp mapping
(`"@skmtc/lang-kotlin": "../skmtc/deno/lang-kotlin/mod.ts"`) governed
resolution workspace-wide, as it did during Phase D step 4 — but in
Phase D the member had NO lang-kotlin pin yet; the shadowing only
exists once the member pin lands.

**Why it matters:** This is a *silent wrong-artifact* failure mode for
any cross-workspace develop-against-unpublished flow: tests pass or
fail for reasons belonging to a different version than the one you
believe is under test. It was only caught because the new feature's
absence was visible in pinned bytes. A gate that happened to exercise
only old behavior would have shipped green against the wrong lang.
The session's resolution (Dmitri's call): don't carry temp mappings at
all — publish the finished delta to the local JSR and pin it (K6).

**Possible fixes:** unresolved — candidates: record the
shadowing rule next to the existing cross-workspace gotcha (F5/F6
tracker step 3 records the inverse); a tripwire (`grep` for path
mappings whose key is also pinned in any member); or adopt K6's
publish-early precedent as the standing rule and deprecate temp
mappings entirely.

**Version anchor:** `@skmtc/core@0.9.0`, `@skmtc/lang-kotlin@0.1.0→0.2.0`, `@skmtc/gen-kotlin@0.0.1→0.0.2`

**Status:** open

### 2. Spec decision written against unverified parse semantics — implemented, then deleted [friction]

Spec 22, decision 4: "single-member union → alias to the member" —
a `KtUnion` value-layer change.

**What happened:** The decision was signed off, implemented (a
single-member branch in `KtUnion` + arg threading through `toKtValue`),
and then the e2e showed `SingleWrapper: oneOf [User]` arriving at the
generator as User's OBJECT shape — core's parse collapses single-member
unions before any generator runs (K2). The implemented branch was
unreachable dead code; it was removed and the spec amended with a
FINDING note.

**What was expected:** That a `oneOf: [X]` document schema reaches the
generator as `{ type: 'union', members: [X] }` — the natural reading of
the OAS-objects layer, and nothing contradicted it in docs or the
skills.

**Why it matters:** Spec decisions about the value layer are decisions
about *post-parse* schema shapes, and parse-time normalization
(allOf-merge is documented; union collapse is NOT) can make a whole
decision moot. The fix cost was small here, but the pattern scales
badly: a 2-minute parse probe (`toSchemaV3` on the shapes the spec
touches) before sign-off would have caught it. The skill's
"allOf is already merged" row is the only parse-normalization fact
currently written down — union collapse is at least as surprising.

**Possible fixes:** unresolved — candidates: document core's
parse-time normalizations in one place (allOf merge, union collapse,
single-member behavior, ref dereferencing during collapse); add a
"probe parse semantics for every schema shape the spec touches" item
to the spec-writing protocol; or both.

**Version anchor:** `@skmtc/core@0.9.0`, `@skmtc/gen-kotlin@0.0.2`

**Status:** open

### 3. Factory-entry wrapper wiring failed twice before landing [friction]

Phase D step 7 + Milestone B step 4: consuming gen-kotlin (a
no-default-export factory entry) from the CLI, first from the
registry, then from local source.

**What happened:** Two distinct mis-wirings of the same contract.
(a) Pointing the import-map key `@skmtc/gen-kotlin` directly at the
package's `mod.ts` → bundle fails with `No matching export … for
import "default"` (worker.ts imports the default off the KEY).
(b) Having the wrapper import the bare specifier `'@skmtc/gen-kotlin'`
→ resolves through the map back to the wrapper itself. The working
shape: key → wrapper `mod.ts`; wrapper default-exports
`toKotlinEntry({ basePackage })` and imports the factory via a FULL
`jsr:` specifier (or an absolute path during pre-release validation,
with every bare specifier of the package pinned in the project
deno.json).

**What was expected:** That "install the generator and configure it"
had a CLI-surface answer. It doesn't and shouldn't (no config flags) —
but the wrapper recipe wasn't written anywhere when first needed; it
was derived from `to-worker.ts` source.

**Why it matters:** Factory entries are now a real category (gen-kotlin
today, gen-kotlin-spring next, any future required-option generator).
Every consumer hits this wiring on first contact; both failure modes
are cheap individually but the recipe is three non-obvious decisions
deep (key placement, default export, full-specifier import).

**Possible fixes:** unresolved — candidates: a card in the skmtc-cli
skill ("consuming a factory-entry generator"); `skmtc install` learning
to scaffold the wrapper when the package lacks a default export; or
the recipe-error on the bundle failure pointing at the wrapper pattern.

**Version anchor:** `@skmtc/cli@0.5.1`, `@skmtc/gen-kotlin@0.0.1/0.0.2`

**Status:** open

### 4. `kotlin-reflect` absence fails as an empty-body 500 [polish]

Milestone A pre-spec scratch: the Spring Boot consumer story.

**What happened:** First boot of the scratch app: every request
returned `HTTP 500` with `Content-Length: 0`. Nothing wrong at the
HTTP layer; the cause (`NoClassDefFoundError:
kotlin/reflect/jvm/ReflectJvmMapping` — Spring MVC's Kotlin parameter
handling needs `org.jetbrains.kotlin:kotlin-reflect`) only appears in
the server log.

**Why it matters:** This will be the first thing every
gen-kotlin-spring consumer hits if the docs don't list the dependency —
and the failure shape (empty 500, healthy startup) doesn't point at a
missing classpath entry. Already recorded in spec 23's consumer-setup
list; logging here so the step-5 docs don't drop it.

**Possible fixes:** include `kotlin-reflect` in the documented
consumer dependency block (done in spec 23; carry into
gen-kotlin-spring.md at step 5).

**Version anchor:** Spring Boot 3.5.0, Kotlin 2.2.20

**Status:** open

### 5. Scratch the TARGET-LANGUAGE runtime before spec sign-off [win]

Both milestones this session.

**What happened:** Before each spec was put up for sign-off, the
risky mechanism was hand-written in the target language and executed
on the real toolchain: kotlinx sealed-interface polymorphism
round-tripped (proving `@Serializable`-on-interface, automatic closed
polymorphism, and the discriminator-omission policy) and Spring
interface-binding boot-ran with live requests (proving the
interfaceOnly artifact shape AND the kotlinx-converter consumer story,
and surfacing `kotlin-reflect` pre-spec). In both cases the scratch
either validated a policy a compile cannot check or surfaced a fact
(K4's collision rule, K5's reflect dependency) that reshaped the spec
before any SKMTC code moved.

**Why it matters:** The existing codified principle
(validate-architecture-with-scratch-experiments) is about TypeScript
feasibility scratches (`deno check`/`run`). Non-TS generators add a
second, different risk surface: the EMITTED language's runtime
semantics, which no amount of TS-side testing or byte-pinning can
verify. Another agent following only the written principle would
byte-pin plausible-looking Kotlin and discover serialization breakage
at the (manual, late) validation step — or after release. The pattern
worth prescribing: for any `lang-<X>`/`gen-<X>` milestone, the spec's
"scratch evidence" section covers the target-language runtime
behavior the design depends on, executed on the real toolchain,
BEFORE sign-off.

**Possible fixes:** add the target-language-runtime scratch to the
skmtc-generator skill (or the future `skmtc-lang-<X>` template's
process section) as a named step in non-TS milestone protocol.

**Version anchor:** `@skmtc/lang-kotlin@0.2.0`, kotlinx-serialization 1.9.0, Spring Boot 3.5.0

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #2 / K2 — parse-time union collapse undocumented | Parse normalizations silently shape every generator's input; one undocumented rule already invalidated a signed-off spec decision | Document core's parse normalizations (skmtc-generator skill §4 row + a parse-semantics reference); add a parse-probe item to the spec protocol |
| 2 | #1 / K1 — member pin shadows root mapping | Silent wrong-artifact testing in every cross-workspace dev flow; the materialized risk behind the new publish-early precedent (K6) | Record both resolution-precedence gotchas together (skmtc-generators CLAUDE.md or skmtc-generator skill); note the publish-early precedent in skmtc/deno CLAUDE.md "Releasing" |
| 3 | #3 / K3 — factory-entry wrapper recipe | A growing category of generators (required-option factories) whose CLI consumption is undocumented three-decision wiring | skmtc-cli skill: "consuming a factory-entry generator" card |
