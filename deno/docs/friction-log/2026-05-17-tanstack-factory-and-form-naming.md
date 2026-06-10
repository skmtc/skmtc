# 2026-05-17 — TanstackQueryFactory extraction + form-name refactor

Two extended pieces of work in one session: (1) extracted
`TanstackQueryFactory` from `gen-tanstack-query-fieldplan` so
`gen-shadcn-table`'s virtualised body can compose with it via
`insertOperation`, then walked back from coupling-on-emission to
on-demand emission after the user pushed back on emitting dead
factories; (2) replaced `toFormName`'s operationId-parsing with a
path-derived rule plus `entityName` / `formName` enrichment
overrides. Both pieces had multiple regression cycles and surfaced
real SKMTC observations.

## Knowledge acquired

Cross-gen Projection composition with two Projections per operation
in one generator (hook + factory), plus enrichment-driven name
derivation as an alternative to operationId-parsing.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | **`Inserted.toIdentifier()` is a method, not an `.identifier` property.** Wrote `factory.identifier.name` after `this.insertOperation(...)` and got TS2551 ("'identifier' does not exist on type 'Inserted<…>'. Did you mean 'toIdentifier'?"). Same family of footgun as `OasRef.toRefName()` (already documented). The fix is one character but the surprise costs a cycle. | Generator skill's "Anti-patterns" §8 has the `OasRef.toRefName()` entry; needs a sibling entry for `Inserted.toIdentifier()`, or a generalised "method-vs-property" subsection covering both. |
| K2 | **When `insertOperation`'s peer exportPath equals the calling Projection's destinationPath, the Driver skips import registration.** The skill says "If `exportPath !== destinationPath`, the driver also registers an import" (§3) — the implied complement is "if they're equal, no import." Useful when you want two Projections to be siblings in one file and reference each other by bare name (`useFoos` calls `useFoosFactory()` inline, no import statement). | Skill §3 covers this implicitly. Worth one explicit sentence: "if both Projections compute the same exportPath, the Driver skips the import step — they coexist as siblings in one file and reference each other by bare identifier name." |
| K3 | **`insertNormalizedModel` keys the cache by `fallbackName` for inline (non-ref) schemas.** Two different callers calling `insertNormalizedModel(ZodProjection, { schema: <same inline OAS shape>, fallbackName: "A" / "B" })` produce TWO Zod schema Definitions with identical content under different names. To dedupe, both callers must pass the same `fallbackName`. (Refs dedupe via the ref name regardless of fallback — see `2026-05-16-table-generator-audit.md` K3 for the ref case.) | Generator skill §3.5 covers ref dedup well; the inline-schema case isn't called out. Worth a row in the "Which helper for which job?" table or a one-liner: "for **inline** schemas, `fallbackName` IS the cache key — different fallbacks produce duplicate Definitions for identical content." |
| K4 | **`FunctionParameter` with `skipEmpty: true` emits an empty parameter list `()` when the operation has no path/query params**, and the returned-closure shape passes through. Downstream callers that want to invoke the inner closure must conditionally emit `factory()()` vs `factory()({ ...args })` based on parameter emptiness — passing `({})` against an empty `()` fails TS2554 ("Expected 0 arguments, got 1"). | This is core engine behaviour but invisible from the FunctionParameter API surface. Worth a `@skmtc/core` reference doc entry for FunctionParameter, or a brief note in the generator skill's anti-patterns about "don't assume the destructured form is always non-empty at the call site". |
| K5 | **`deno install -A -g -f` does NOT bump the package version when an existing shim exists with a `deno.lock` pinning the old version.** The shim's lock at `~/.deno/bin/.skmtc/deno.lock` keeps the old resolution even with `-f`. Two ways to actually update: delete the lock file before reinstalling, or specify an exact version in the install command (`jsr:@skmtc/cli@0.2.6` rather than `jsr:@skmtc/cli`). The unversioned form resolves `*` against the existing lock entries first. | CLI skill §10 "Card: Using SKMTC in CI" mentions the install command. Worth a note: "Don't trust `-f` alone to update a stale shim — pin a version explicitly, or delete `~/.deno/bin/<shim>/deno.lock` first. The lock's `*` resolution persists across `-f` reinstalls." |
| K6 | **`skmtc bundle <project>` raises `bundle.js was expected at <path> but wasn't written` even when the underlying `deno bundle` succeeded and wrote the file.** The file's mtime updates; the bundle is usable; `skmtc generate` works against it. The CLI's post-bundle check is mis-reporting (probably checks the path before the write completes, or checks a transient temp path). Not visible in normal use because the error is alarming but the workflow still functions. | This is a CLI bug, not a doc issue. Worth filing against `@skmtc/cli@0.2.6`. The workaround for now is to ignore the error and proceed to `generate` directly — the bundle IS there. |
| K7 | **`isListResponse` (in `gen-tanstack-query-fieldplan/listFns.ts`) over-matches on any response whose `data` object contains an array property at any level.** Routes single-resource GETs through `PaginatedQueryEndpoint` if their response includes things like `roles: string[]`. Pre-existing in the generator; visible now because the factory pattern materialises observable artefacts for these false-positives. | Generator-internal bug. The fix is to gate on whether the array IS the payload (`data: T[]` or `data: { items: T[] }`), not "any array nested anywhere in data". Worth filing against `@skmtc/gen-tanstack-query-fieldplan`. |
| K8 | **Chanfana's operationIds for some endpoints carry a trailing `_v<n>_<path-segments>` disambiguation suffix** that the generator's verb-suffix regex doesn't anticipate. E.g., `get_V2UserMe_v2_platform_me` — after stripping `^get_V2`, the remainder `UserMe_v2_platform_me` fails the `(.+?)(List\|Get\|Create\|Update\|Delete)$` match and falls through to the raw fallback, producing `useUserMe_v2_platform_me`. Fix: pre-strip the path-disambiguation suffix (`/_v\d+_[\w_]+$/i`) before the verb-suffix match. | OAS-source-specific, not in the SKMTC core. Useful retrofit pattern for any chanfana-based naming logic — worth a note next to `toFieldplanHookName` in the generator's own README/comments. |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Cross-Definition coupling via side-effect `insertOperation` creates cascade-failure modes | friction | open |
| 2 | `Inserted.toIdentifier()` method-vs-property surprise | friction | open |
| 3 | `deno install -f` doesn't bump version when shim lock pins old | friction | open |
| 4 | `bundle.js was expected … but wasn't written` is a false alarm | friction | open |
| 5 | Heuristic-heavy path-naming algorithm vs simple rule + override | friction | open |
| 6 | `insertNormalizedModel` inline-schema dedup keyed on fallbackName, not content | polish | open |
| 7 | FunctionParameter zero-param emit shape requires conditional call-site | polish | open |
| 8 | Decouple Definitions in one generator; share at source level, not output level | win | open |
| 9 | Path-derive + enrichment-override is the right shape for entity naming | win | open |

---

### 1. Cross-Definition coupling via side-effect `insertOperation` creates cascade-failure modes [friction]

When I first extracted `TanstackQueryFactory`, I made the existing
`PaginatedQueryEndpoint` (the internal helper that emits `useFoos`)
call `this.insertOperation(TanstackQueryFactory, op)` from its
constructor and reference `useFoosFactory` inline in its rendered
output. The hook delegated to the factory: `useFoos = (args) =>
useQuery({ ...useFoosFactory()(args), select, placeholderData })`.

**What happened:** the factory then emitted for EVERY list endpoint,
even ones with no specialised consumer (which is most of them — 50+
list endpoints, 5 tables). Worse, every regression I introduced into
the factory cascaded through every `useFoos` in the codebase. The
zero-param case (`useFoosFactory()({})` against an empty inner
closure) broke all single-resource GETs that `isListResponse`
false-positives matched (`useUserMe_v2_platform_me` and friends).
The envelope-vs-unwrap decision had to be made for both consumers
simultaneously.

**What was expected:** that two Projections in the same generator
sharing source code (PaginatedQueryFn) was the same kind of
coupling as two consumers of one shared helper — i.e., fine. It
isn't, in code-gen terms: the OUTPUT coupling is the thing that
cascades, not the source.

**Why it matters:** in code-gen, the generator IS the abstraction.
Source-level sharing inside one generator (a helper Snippet, a
shared base, a utility function) costs almost nothing — both
Projections own the same source and evolve together. But coupling
GENERATED Definitions to each other (Definition A references
Definition B by bare name; Definition B's emission becomes a
precondition for A's correctness) creates a contract that crosses
the emission boundary. Bugs in one cascade into the other, and you
can no longer reason about either Definition in isolation. The
correct decoupling: each Projection emits its own self-contained
output (inline all the source-level shared pieces), and the
generated artefacts coexist as siblings in the same file without
referencing each other.

The pivot was: revert `PaginatedQueryEndpoint` to its pre-refactor
inline shape (own `useV2Client`, own `useQuery`, own queryFn body),
let `TanstackQueryFactory` exist as a parallel public Projection,
let consumers explicitly compose with whichever they need.
Generated output has some duplication WITHIN one generator —
acceptable, single owner. Cross-output coupling — not acceptable,
cascading failures.

**Possible fixes:** unresolved — generator skill could codify this
distinction explicitly. The current skill describes cross-gen
composition (§3) and the operation-reference protocol (§3.5) but
doesn't address the "two Projections in one generator, when to
couple them vs not" question. The decision tree in §5 ("Should this
be a Projection or a Snippet") implicitly assumes one Projection
per operation per generator, which is the common case but not the
universal one.

**Version anchor:** `@skmtc/core@0.5.1`, `@skmtc/gen-tanstack-query-fieldplan@0.0.1`, `@fieldplan/gen-shadcn-table@0.0.1`

**Status:** open

---

### 2. `Inserted.toIdentifier()` method-vs-property surprise [friction]

Writing the factory composition in `PaginatedQueryEndpoint`:

```ts
const factory = this.insertOperation(TanstackQueryFactory, operation)
this.factoryName = factory.identifier.name  // ❌ TS2551
```

**What happened:** TypeScript reported `Property 'identifier' does
not exist on type 'Inserted<TanstackQueryFactory, …>'. Did you
mean 'toIdentifier'?` and pointed at `Inserted.ts:127` where
`toIdentifier(): Identifier` is declared as a method.

**What was expected:** that `Inserted` exposes its identifier as a
direct property (like `Identifier`'s `.name` getter).

**Why it matters:** this is the same family as the `OasRef.toRefName()`
gotcha already documented in the generator skill — `Inserted`
follows the same method-suffix convention. Both methods feel like
they should be properties, both have plausible-looking property
names that TypeScript helpfully suggests, and both produce a
runtime undefined that crashes downstream if you don't notice the
type error. The skill's anti-pattern table (§8) has a "Reading
`schema.refName` as a property" entry; a sibling entry for
`Inserted.identifier` would cover the parallel pitfall without
the agent having to generalise across patterns.

**Possible fixes:** unresolved — could add to the generator skill's
anti-pattern table, or generalise into a "method-vs-property
gotchas" subsection covering both `OasRef.toRefName()` and
`Inserted.toIdentifier()`. Alternatively, the `Inserted` type
could expose an `.identifier` getter alongside `.toIdentifier()` —
both names point at the same value and either is correct — though
that conflicts with SKMTC's no-getter-aliasing convention.

**Version anchor:** `@skmtc/core@0.5.1`

**Status:** open

---

### 3. `deno install -f` doesn't bump version when shim lock pins old [friction]

When `skmtc bundle` started failing with a `bundle.js was expected…`
error (entry #4), I tried updating the CLI:

```sh
deno install -A -g --unstable-worker-options -n skmtc -f jsr:@skmtc/cli
```

**What happened:** install output reported "Successfully installed
skmtc" and showed downloads from `jsr.skmtc.dev/@skmtc/cli/0.2.6/`,
but the running binary stayed at 0.2.0. Inspecting
`~/.deno/bin/.skmtc/deno.lock` revealed it had a `jsr:@skmtc/cli@*`
entry resolved to `0.2.0` — and the lock's `*` resolution persists
across `-f` reinstalls.

Two fixes worked: delete the lock and reinstall (`rm
~/.deno/bin/.skmtc/deno.lock && deno install -f -g …`), or pin the
version explicitly (`jsr:@skmtc/cli@0.2.6`).

**What was expected:** that `-f` (force) would refresh the version
resolution alongside the binary replacement.

**Why it matters:** every CLI bump is invisible to the user
otherwise. The downloads log makes it LOOK like the install
succeeded; only by running `skmtc` and observing old behaviour do
you notice the no-op. This is a `deno install` semantic, not
SKMTC-specific, but it bites every time you bump SKMTC.

**Possible fixes:** unresolved — could be a note in the CLI skill's
§10 "Card: Using SKMTC in CI" or the prerequisites section. The
recommended invocation in docs should specify an explicit version
or include the lock-deletion step.

**Version anchor:** `@skmtc/cli@*` (the lock entry); behaviour seen on
deno 2.x

**Status:** open

---

### 4. `bundle.js was expected … but wasn't written` is a false alarm [friction]

After updating to CLI 0.2.6, `skmtc bundle mobile-app` consistently
raised:

```
error: Uncaught (in promise) Error: bundle.js was expected at
file:///…/bundle.js but wasn't written
    at bundleHeadless (…/lib/bundle-headless.ts:70:11)
```

**What happened:** the error suggested the bundle had failed, but
checking `ls -la bundle.js` showed an mtime equal to "right now",
matching the bundle attempt. Running `deno bundle worker.ts`
directly produced a working bundle. `skmtc generate` against the
freshly-written bundle succeeded with zero errors and zero
parseIssues.

**What was expected:** that an error message about a file not being
written means the file was not written.

**Why it matters:** this consumes time on every session — the
visible error suggests something deep is broken, but the next step
(generate) works fine. Likely a race in `bundleHeadless`: it spawns
`deno bundle` as a subprocess and post-checks for the output file
before the write fence has settled, or it checks the wrong path.
The error log file `.skmtc/<project>/.settings/error-logs.txt`
showed the subprocess emitting `Bundled 620 modules in 169ms` and
the bundle size — clear success on the subprocess side.

**Possible fixes:** CLI fix — the post-check in `bundleHeadless`
should either wait for the subprocess's write to complete (poll
file size or use an explicit fence) or use the subprocess's exit
code as the source of truth. In the meantime, document the
workaround in the CLI skill: "if `skmtc bundle` reports the file
isn't written but the file exists with a fresh mtime, proceed to
`generate` — it's a known false alarm in 0.2.6."

**Version anchor:** `@skmtc/cli@0.2.6`

**Status:** open

---

### 5. Heuristic-heavy path-naming algorithm vs simple rule + override [friction]

Replacing `toFormName`'s operationId-based naming with a path-based
algorithm. My first attempt parsed paths into segment-role classes
(domain prefix, parent context, child collection, action verb),
applied multiple heuristics (singularisation, plural detection,
verb-suffix matching), and tried to match every existing form name
without overrides.

**What happened:** the user rejected it as "too much weird logic"
and asked for a simpler rule + enrichment override for edge cases.

**Why it matters:** every heuristic added to the auto-derivation has
to handle a corner of the OAS surface AND interact with every other
heuristic. The behaviour is hard to predict from reading the code;
the rule "what name does this path produce" requires running the
algorithm mentally. The alternative — simple deterministic default
plus explicit per-case overrides — is more verbose in config but
trivial to reason about. The simple version (last plural segment +
one-level parent context if `parent/{id}/child`) covered ~75% of
cases cleanly; the remaining 25% got `entityName` / `formName`
enrichment overrides. Result: 10-line algorithm, ~10 enrichment
overrides in client.json, every form name is either obvious from
the path OR documented in client.json.

The architectural lesson: when an auto-derivation algorithm gains
more than ~2 rules, prefer fewer rules + per-case overrides over
encoding every variation as a heuristic. The variations are noise
the algorithm can't classify generically; collecting them in config
makes the noise visible and easy to audit.

**Possible fixes:** unresolved — could be a generator-authoring
heuristic in the skill itself: "if your auto-derivation has more
than two branches, you probably want an enrichment override
instead of a third branch." Or it could be a more general code-gen
principle, in which case it belongs in the broader docs.

**Version anchor:** `@skmtc/gen-shadcn-form@0.0.1`

**Status:** open

---

### 6. `insertNormalizedModel` inline-schema dedup keyed on fallbackName, not content [polish]

When refactoring `PaginatedQueryEndpoint` and `TanstackQueryFactory`
to share `PaginatedQueryFn`, both Projections constructed their own
`PaginatedQueryFn` instance and each called
`insertNormalizedModel(ZodProjection, { schema: <inline envelope>,
fallbackName: <derived from settings.identifier.name> })`.

**What happened:** the hook's settings.identifier.name was
`useCustomers`, the factory's was `useCustomersFactory`, so the
fallbackNames diverged: `useCustomersResponse` vs
`useCustomersFactoryResponse`. Two Zod schema Definitions were
emitted for the same OAS response shape — identical content,
different names. Same for the Args TypeScript type
(`UseCustomersArgs` vs `UseCustomersFactoryArgs`).

**What was expected:** that `insertNormalizedModel` would dedupe by
the schema content (or by the schema's structural identity), not
by fallbackName.

**Why it matters:** for named refs (where the schema has a
`refName`), dedup works on the ref name — both callers hit the
same cached Definition. For inline schemas (no ref), the cache key
includes fallbackName because there's no other stable identity.
Two callers with the same inline schema but different fallbackNames
end up with duplicate Definitions, which compiles fine but bloats
the generated output and obscures intent.

The fix in my code: have `TanstackQueryFactory` construct its
`PaginatedQueryFn` with a `hookSettings` object — same as its own
settings, but with the identifier replaced by
`TanstackQueryBase.toIdentifier(...)` (the hook's name). Both
PaginatedQueryFn instances then compute the same fallbackName and
hit the same Definition.

**Possible fixes:** unresolved — could be an `insertNormalizedModel`
parameter `fallbackKey` separate from `fallbackName` (the former
determines cache identity, the latter is just the emitted name).
Or generator-authoring guidance: when two Projections need to
share an inline-schema Definition, derive `fallbackName` from a
shared source (the operation, a base helper) rather than from each
Projection's own identifier.

**Version anchor:** `@skmtc/core@0.5.1`

**Status:** open

---

### 7. FunctionParameter zero-param emit shape requires conditional call-site [polish]

`PaginatedQueryFn`'s `FunctionParameter` is constructed with
`skipEmpty: true`. For an operation with zero query/path params, the
parameter emits as empty `()` — including for the returned-closure
shape inside `TanstackQueryFactory`'s output:

```ts
// TanstackQueryFactory emits:
() => {
  const api = useV2Client('platform')
  return () => ({ queryKey: [...], queryFn: ... })  // ← inner arg list empty
}
```

The hook (`PaginatedQueryEndpoint`) consumed it via
`useFoosFactory()(<reconstructed-args-object>)` and passed `({})`
when there were no params — TS2554 ("Expected 0 arguments, got 1").

**What happened:** ~3 single-resource GETs that `isListResponse`
false-positively routed through `PaginatedQueryEndpoint` all
broke. The fix: condition the call site on
`parameter.toPropertyList().values.length === 0` and emit
`factory()()` vs `factory()({ ...args })`.

**Why it matters:** `FunctionParameter` is a sensible abstraction
for the destructured-params pattern, but its zero-param emission
isn't symmetric — the produced "function value" can be invoked
with zero args OR with an args-object, but not interchangeably.
Consumers reconstructing the call site have to know about this
asymmetry.

**Possible fixes:** unresolved — `FunctionParameter` could expose
an `.isEmpty` or `.callShape()` helper that consumers use to build
the call expression. Or generator-authoring guidance: when wrapping
a `FunctionParameter`-produced value in another emission, always
branch on emptiness.

**Version anchor:** `@skmtc/core@0.5.1`

**Status:** open

---

### 8. Decouple Definitions in one generator; share at source level, not output level [win]

The architectural pivot in this session: starting with
`PaginatedQueryEndpoint` triggering `TanstackQueryFactory` via
`insertOperation` from its constructor (so the hook delegated to
the factory in its rendered output), ending with the two as
parallel public Projections that emit independent Definitions.
Source-level reuse via shared helpers (`PaginatedQueryFn`,
`toDomainTag`, `toRelativePath`) is fine — both Projections own
the same source and evolve together. Generated-output coupling
(Definition A referencing Definition B in its rendered code) is
costly and asymmetric: bugs in B cascade into A, and you can no
longer reason about either Definition in isolation.

The codification: in code-gen, "DRY across two Projections in one
generator" applies at the SOURCE level. Each Projection should emit
self-contained generated code (inline whatever shared logic the
helpers provide), and the two artefacts coexist as independent
Definitions. This contrasts with cross-gen composition (§3 of the
skill) where coupling IS the design — gen-shadcn-table reaching
into gen-tanstack-query-fieldplan for a factory IS the intended
pattern, because the boundary is between independently-owned
generators.

The pattern in concrete form:

| | Within-generator (two Projections, same package) | Cross-generator (Projection from package A in package B) |
|---|---|---|
| Source-level reuse | Yes — shared Snippets, helpers, FunctionParameter instances | No — each generator owns its own source |
| Generated-output coupling | NO — Definitions should be independent | YES — that's the point of `insertOperation` |
| Failure mode of coupling | Cascade: bugs in B break every A | Versioned: bumping B requires recompiling A |

This isn't in the generator skill — the skill's §3 covers cross-gen
composition assuming the boundary between two packages, not two
Projections within one package. Worth adding a sibling decision
point next to the Projection-vs-Snippet decision tree (§5).

**Why this passes the codification bar:** another agent
implementing a "factory variant" of an existing Projection would
plausibly couple them in the generated output (that's what I did
first) — it feels natural to have one Projection delegate to the
other since they live in the same file. The right answer (keep
them parallel and let consumers compose) isn't obvious without
having lived through the cascade-failure mode.

**Possible fixes:** unresolved — generator skill could grow a §5b
"Two Projections in one generator" section, or the operational
principles table (§4) could gain a row: "Within-generator coupling
of generated Definitions vs cross-gen composition."

**Version anchor:** `@skmtc/core@0.5.1`,
`@skmtc/gen-tanstack-query-fieldplan@0.0.1`

**Status:** open

---

### 9. Path-derive + enrichment-override is the right shape for entity naming [win]

After bouncing between operationId-parsing (brittle when chanfana's
naming drifts) and heavy path-heuristic-parsing (every edge case
becomes another branch), the working shape:

1. **Auto-derive the entity** from the path with one rule and one
   carve-out: "last plural-collection segment, singularised; with
   one-level parent context if `parent/{id}/child`".
2. **Enrichment overrides** for the cases the rule doesn't cover —
   `entityName` to replace just the entity portion (path-ambiguous
   like billing line-items vs quote line-items), `formName` to
   replace the entire name (action endpoints where
   `<Verb><Entity>Form` doesn't fit).

This contrasts with two failed shapes:

- **operationId-parsing:** brittle. Chanfana's operationId scheme
  has drifted enough across the OAS surface that the same
  conceptual operation gets different operationId formats across
  endpoints. Auto-derivation that depends on operationId is one OAS
  refactor away from breaking.
- **path-heuristics:** scales poorly. Every variation in path shape
  becomes another conditional branch (domain prefix detection,
  action verb detection, plural/singular classification, parent
  context inference). The behaviour is hard to predict from reading
  the code; the rule "what name does this path produce" requires
  running the algorithm mentally.

The path-derive + override shape collects the irregular cases in
client.json where they're visible and auditable, and keeps the
generator source short.

**Why this passes the codification bar:** another agent
implementing a naming refactor would plausibly add more
auto-detection rules to handle edge cases (which is what I did
first). The discipline of "stop at ~2 rules, push the rest to
overrides" isn't obvious without the experience of building the
heuristic-heavy version and watching it become unreadable.

**Possible fixes:** unresolved — could be a generator-authoring
heuristic in the skill: "for any path-driven name derivation, stop
at two rules; everything else goes in an enrichment override." More
broadly, this is a code-gen-applicable version of the rule-of-three
for hand-written code: in code-gen, the threshold for "extract a
rule" is lower (because the rule lives in the generator and applies
to N emissions) but the threshold for "encode this edge case as a
rule" is higher (because every rule interacts with every other).

**Version anchor:** `@skmtc/gen-shadcn-form@0.0.1`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #8 — Decouple Definitions in one generator | Real cascade-failure mode that bit the session hard (factory regressions broke every list-endpoint hook). The "two Projections in one generator" pattern will recur as more generators grow factory/variant pairs. Worth codifying before another agent hits it. | Generator skill update — either §5b new section or §4 operational principles row. |
| 2 | #2 — `Inserted.toIdentifier()` method-vs-property | Same family as `OasRef.toRefName()` which IS in the skill's anti-pattern table. One-line addition prevents repeating the exact cycle. | Generator skill §8 anti-pattern table — add sibling row to "Reading `schema.refName` as a property". |
| 3 | #3 — `deno install -f` doesn't bump version | Every SKMTC CLI bump silently no-ops until the lock is deleted or version is pinned. This burns time on every release. | CLI skill §10 — update the install command in "Card: Using SKMTC in CI" to pin the version explicitly, and add a one-liner about the `-f` semantic in the prerequisites. |
