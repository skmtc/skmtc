# 2026-05-27 — Coercive zod variants + `@hono/zod-validator` route boundary

Two-arc session against `skmtc-hub`: (1) bumped `@skmtc/core` 0.6.6 → 0.6.7 and
`@skmtc/worker` 0.3.5 → 0.3.6, then made local `gen-zod` variants-aware so a
named refName can emit a `main` plus a `coercive` variant
(`z.coerce.number().int()`, a string-safe boolean preprocess shim);
(2) replaced the imperative `parseBody(...)` body parsing inside
`gen-hono-api`-generated routes with `@hono/zod-validator`-driven
`validate('param'|'query'|'json', …)` middleware, with per-route param/query
schemas composed by handing `operation.toParametersObject([...])` to gen-zod's
`ZodObject` Snippet with `coerce: true`. Verified live via Chrome DevTools.
Mid-session pivot: deleted the bespoke `ErrorCatalog.ts` Snippet emitter after
the user pointed out it generated static infra that doesn't vary with the
OpenAPI schema.

## Knowledge acquired

Operating across the variant machinery, cross-generator Snippet composition,
the `@hono/zod-validator` integration boundary, and the consumer's wrangler /
turborepo dev surface.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `deno.lock` has a `workspace` section that pins per-member dependency resolution as a snapshot. Bumping every workspace member's `deno.json#imports."@skmtc/core"` to a new version does **not** update those workspace entries — they continue to record the old version until the lock is invalidated. `skmtc bundle` (esbuild-based) strips types and proceeds; `skmtc doctor`'s `project-core-pin/<project>` check inspects declared pins, not lock resolution; only `deno check` against a generator's `mod.ts` reveals the stale resolution. Took 3+ cycles to diagnose because the symptoms were "core 0.6.6's `InsertModelOptions` doesn't have `variant`" while every visible config said 0.6.7. | `skmtc doctor` could grow a `lock-resolution-matches-pins/<project>` check that diffs `deno.lock`'s workspace entries against each member's `deno.json`. Worth a friction entry (#1). |
| K2 | `core@0.6.7` made `ModelDriver`'s constructor `variant: string` **required** (compare `core@0.6.6/dsl/model/ModelDriver.ts` line 12 — no `variant` field — to `core@0.6.7/dsl/model/ModelDriver.ts` line 25 — `variant: string` is required). `toModelGeneratorKey({ generatorId, refName })` similarly requires `variant`. Any cloned generator whose `*Ref.ts` calls `new ModelDriver({…})` without threading variant breaks at runtime: `assertPeerVariantExists` throws `Cannot insert variant 'undefined' for '<refName>' — peer has no enrichments configured. Only 'main' is permitted.` Latent in gen-typescript's `TsRef.ts` and gen-zod's `ZodRef.ts` (both cloned in this project). Fix: pass `variant: 'main'` explicitly for refs that don't propagate variant. | This is a hard migration step from 0.6.6 → 0.6.7 that isn't called out anywhere. Worth a migration note in either skmtc-cli §"core version migration" or a CHANGELOG entry in core itself. |
| K3 | `OasRef<T>.resolve()` is mirrored by an identity `resolve()` on every sibling of the discriminated union — `OasResponse.resolve(): OasResponse { return this }`, `OasObject.resolve(): OasObject { return this }`, etc. Calling `.resolve()` on a `Foo \| OasRef<…>` union always returns the concrete `Foo` and TS narrows correctly. The `isRef() ? .resolve() : self` ternary that appears in older code is dead weight; the framework itself uses bare `this.requestBody?.resolve()` inside `OasOperation.toRequestBody`. | Worth adding to `reference/api/oas-ref.md` next to the `isRef()` example — currently the example uses the ternary form, which propagates the antipattern into new code. |
| K4 | `OasOperation.toRequestBody<V>(map, mediaType)` accepts a callback that internalises `requestBody?.resolve()` + `content[mediaType]?.schema` lookup. `OasOperation.toSuccessResponse()` is the **bare accessor only** — returns `OasResponse \| OasRef<'response'> \| undefined`, no `(map, mediaType)` overload. Asymmetric. Consumers wanting the success-response schema for a media type must hand-roll `toSuccessResponse()?.resolve()?.content?.[mediaType]?.schema` — duplicating exactly the work the request-side callback abstracts. | SKMTC code change candidate: add `toSuccessResponse<V>(map, mediaType?)` mirroring `toRequestBody`. Knock-on cleanup in gen-hono-api `ApiRoute.ts` lines ~131-145. |
| K5 | `InsertNormalizedModelOptions.variant` applies only to the **`$ref` branch**. For inline (synthesised) schemas, the option is ignored (per the option's docstring). The doc guidance "bake the variant into fallbackName if you need variant-distinct inline schemas" changes the emitted *name* but does NOT change *behaviour* — there is no path through `insertNormalizedModel` to get a coercive (or otherwise enrichment-driven) variant of an inline schema. Correct pattern for inline schemas with enrichment-dependent behaviour: construct the Snippet **directly** — `new ZodObject({ objectSchema, coerce: true, …})` — and interpolate it via template literal. The skill describes Snippets as composition primitives but the inline-coercive case isn't explicit. | Generator skill §"Decision tree: which `insert*` helper for which job" — add a row: "Inline schema + behaviour-varying enrichment (e.g. coerce) → direct Snippet construction, NOT `insertNormalizedModel`." Worth a friction entry too (see #2). |
| K6 | `OasOperation.toParametersObject(filter?: OasParameterLocation[])` synthesises an `OasObject` whose properties are the named parameters at that location (with the correct `required` array). Handing that directly to gen-zod's `ZodObject` Snippet (with `coerce: true`) and gen-typescript's `TsObject` Snippet (with no coerce — TS types match the schema either way) is the canonical way to derive **both** the runtime validator and the post-validation TS type literal from one schema description. The pattern composes cleanly because `gen-zod` / `gen-typescript` export `ZodObject` / `TsObject` from their `mod.ts` (verified at `gen-zod/mod.ts:5` and `gen-typescript/mod.ts:8`). | Worth a how-to: "Build per-operation inline schemas by composing peer-generator Snippets." Sits alongside the existing operation-reference protocol doc. Captures the pattern as a `[win]` (#7). |
| K7 | The `coercive` boolean expression has a real footgun: `z.coerce.boolean()` treats any non-empty string as `true`, including the literal string `"false"`. Safe form for HTTP query strings: `z.preprocess(v => v === 'true' ? true : v === 'false' ? false : v, z.boolean())`. gen-zod's `ZodBoolean.ts` carries this shim — every consumer that emits boolean coercion needs the same nuance, otherwise `?active=false` flips to true. | The shim should be documented at the top of `authoring/recipes/coercive-zod-variants.md` (doesn't exist yet) — it's the kind of thing every consumer reinvents. |
| K8 | Hono throws `HTTPException` from `hono/http-exception` (NOT a native `SyntaxError`) when `c.req.json()` encounters malformed JSON. Properties: `.status = 400`, `.message = 'Malformed JSON in request body'`. A custom `onError` mapper that wants to convert framework-level errors to a project-specific envelope must check `err instanceof HTTPException && err.status >= 400 && err.status < 500`, not `err instanceof SyntaxError`. I tried `SyntaxError` first; the check didn't fire and 500s leaked. | Not SKMTC knowledge per se, but worth a one-liner in any Hono-integration recipe the gen-hono-api docs grow. |
| K9 | `@hono/zod-validator`'s result-hook callback fires **only** for zod validation failures — body-parse failures (malformed JSON, content-type mismatches) propagate around the hook and bubble to `app.onError`. Implication: a single `validate(target, schema, hook)` wrapper can't catch both shapes of failure with one hook. The `HTTPException`-handling has to live in the global error mapper. | Same as K8 — Hono-integration recipe. |
| K10 | Generating files whose content **does not vary with the OpenAPI schema** is an SKMTC anti-pattern. The boundary test: "would two different OpenAPI inputs produce different output for this file?" If the answer is no, the file is project infrastructure, not codegen output — it should be hand-written and imported by the generator as a peer dependency (alongside `../db`, `../env`, `../middleware/auth`). The bespoke `gen-hono-api/ErrorCatalog.ts` emitter for `routes/errors.generated.ts` failed this test (the error envelope, `validate`, `parseBody`, `isFormFile` are byte-identical across every project). Deleted it in this session in favour of hand-written `apps/service/src/routes/errors.ts`. | This is implicit in the skill's "customization seams" framing but worth making it an **operational principle** in skmtc-generator §"Operational principles": "Generators must not emit schema-independent infrastructure — those files belong hand-written, imported by the generator as peers." Worth a friction entry (#3). |
| K11 | The SKMTC docs at `<skmtc-root>/skmtc/deno/docs/` (with `concepts/`, `reference/api/`, `using/`, `authoring/`) are the canonical reference and explicitly cross-referenced from the skill files (e.g. `reference/api/oas-ref.md` is named in `skmtc-generator` §12). My default was to `curl` JSR source files because they're directly addressable — that bypasses the prose, rationale, and recommended patterns. The docs path was sitting right there in the skill text. | Discoverability self-correction. Worth a friction entry to lock it in (#5). |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `deno.lock` workspace section silently retains stale per-member dep resolution after `deno.json` pin bumps | friction | open |
| 2 | Hand-rolled `toParamObjectExpr.ts` instead of composing peer Snippets directly | friction | resolved 2026-05-27 (this session, after user feedback — `ApiRoute.ts` uses `new ZodObject({coerce: true})` + `new TsObject(...)` directly) |
| 3 | Generator emitted static infrastructure (`errors.generated.ts`) that doesn't vary with the OpenAPI schema | friction | resolved 2026-05-27 (this session, after user feedback — deleted `ErrorCatalog.ts`, replaced with hand-written `apps/service/src/routes/errors.ts`) |
| 4 | `OasOperation.toSuccessResponse()` lacks the callback form symmetric to `toRequestBody` | friction | open |
| 5 | Defaulted to `curl`-grepping JSR `.ts` source rather than reading `<skmtc-root>/skmtc/deno/docs/` | friction | open |
| 6 | `core@0.6.6 → 0.6.7` requires `variant` on `ModelDriver` constructor; cloned generators break silently | friction | open |
| 7 | Cross-generator Snippet composition via direct construction (`new ZodObject({coerce: true})`) is the canonical inline-coercive pattern | win | open |

---

### 1. `deno.lock` workspace section silently retains stale per-member dep resolution [friction]

Bumped `@skmtc/core` from 0.6.6 to 0.6.7 in five `deno.json` files (project
root + each of the four local generators). `skmtc bundle` succeeded; `skmtc
doctor` reported `project-core-pin/<project>` as ok with both pinned at 0.6.7;
generation worked. But `deno check` against `gen-zod/mod.ts` resolved
`@skmtc/core`'s `InsertModelOptions` against 0.6.6's type definition — which
lacks `variant` — so my variants work appeared to be using API that didn't
exist.

**What happened:** the lock file's workspace section had cached the
per-member resolution from before the bump:

```json
"workspace": {
  "members": {
    "gen-zod": { "dependencies": ["jsr:@skmtc/core@0.6.6"] },
    "gen-typescript": { "dependencies": ["jsr:@skmtc/core@0.6.6"] },
    ...
  }
}
```

Even after I deleted `deno.lock` and re-ran `deno check`, the same 0.6.6
resolution came back — because the live `deno.json` had ALSO silently
reverted to 0.6.6, courtesy of an earlier `git stash` that included my pin
bumps. I had assumed `git stash pop` had restored those edits when it failed
on a `deno.lock` merge conflict; in fact the entire stash stayed put and the
working tree was at HEAD.

The compounding factor: three tools that should have caught this didn't.
`skmtc bundle` uses esbuild — type-blind by design. `skmtc doctor`'s
`project-core-pin/<project>` check reads `deno.json`'s declared pin, which
was correct from doctor's point of view. `deno bundle` itself doesn't run a
strict typecheck. Only `deno check` reveals the resolved version, and only
on per-package `mod.ts` files.

**What was expected:** that bumping `deno.json#imports` would invalidate
the lock's workspace resolution on next bundle / cache, or that `skmtc
doctor` would surface the mismatch between declared and resolved versions.

**Why it matters:** version-skew bugs are the worst kind of bug to diagnose
because every observable surface tells you the version is correct. The
user had to ask "why core 0.6.6 and not 0.6.7?" — at which point I was
finally forced to look at the lock and trace the resolution. Without that
push, I'd have spent another round chasing phantom type errors.

**Possible fixes:** unresolved — candidates: (a) `skmtc doctor` grows a
check that resolves each workspace member's imports via deno and diffs
against declared pins; (b) `skmtc bundle` does a one-shot `deno cache
--reload` when it detects deno.json mtime newer than deno.lock mtime;
(c) document in skmtc-cli that bumping a core pin requires deleting
`deno.lock` (or running `deno cache --reload`) — a procedural workaround
rather than a tool fix.

**Version anchor:** `@skmtc/cli@0.3.12`, `@skmtc/core@0.6.7`, `deno 2.7.14`

**Status:** open

---

### 2. Hand-rolled `toParamObjectExpr.ts` instead of composing peer Snippets directly [friction]

When adding per-route query / path validation in `gen-hono-api` `ApiRoute.ts`,
I needed an inline `z.object({ … })` expression with coercive primitives
(`z.coerce.number().int()`, the boolean preprocess shim) — exactly the
machinery I'd just built into `gen-zod`'s `ZodObject` / `ZodInteger` /
`ZodBoolean` Snippets via the `coerce` arg. Instead of composing those, I
wrote a fresh `toParamObjectExpr.ts` (~100 lines) that walked the OAS
parameter list and emitted zod strings directly. Same coercion rules, second
copy.

**What happened:** my reasoning chain was: "inline schemas can't get a
coercive variant via `insertNormalizedModel` (the inline branch ignores
variant) → I need my own emitter." Half right, wrong conclusion. The
correct path was direct Snippet construction:

```ts
const objectSchema = operation.toParametersObject(['query'])
this.queryZod = new ZodObject({
  context, destinationPath, objectSchema,
  modifiers: { required: true }, generatorKey,
  coerce: true               // ← thread the flag the Snippet already accepts
})
// ... and interpolate in toString(): `validate('query', ${this.queryZod})`
```

The user surfaced this as "Why `toParamObjectExpr` and not use coercive zod
variant?" — a single question that unwound the whole detour. Deleted
`toParamObjectExpr.ts`; refactored `ApiRoute.ts` to construct `ZodObject`
(runtime validator) and `TsObject` (post-validation TS type literal) from
the same `operation.toParametersObject([...])`-synthesised `OasObject`.

**What was expected:** that `insertNormalizedModel` was the only path for
"use gen-zod's machinery on an arbitrary schema," and that bypassing it
meant rolling my own emitter.

**Why it matters:** this is a sharp edge in how the framework expresses its
extension surface. `insertNormalizedModel` is for **named, deduped
Definitions** keyed by `(name, exportPath)` — that's the right tool when
the schema has identity. Snippet construction is for **anonymous, embedded
fragments** interpolated into another generator's output. Both are
first-class composition primitives, but the docs centre `insertNormalizedModel`
because it's what most stock generators reach for. The Snippet-direct
pattern is the answer for cross-generator inline composition with custom
enrichment behaviour, and that path is currently underdocumented.

**Possible fixes:** unresolved — candidates: (a) add a row to the generator
skill's "Decision tree: which `insert*` helper for which job" table
covering "inline + behaviour-varying enrichment → direct Snippet
construction"; (b) write a how-to recipe in `authoring/recipes/` titled
"Cross-generator inline schema composition" using exactly the
`OasOperation.toParametersObject(['path'|'query'])` → `ZodObject({coerce: true})`
pattern; (c) consider adding a per-call `enrichments` override on
`InsertNormalizedModelOptions` so the named-Definition path can also drive
behaviour from the call site (would be useful for *named* coercive inline
schemas, separate from the embedded case).

**Version anchor:** `@skmtc/core@0.6.7`, `@skmtc/gen-hono-api@0.0.60`,
`@skmtc/gen-zod@0.0.59`

**Status:** resolved 2026-05-27 (this session, commit 235d9d1 —
`ApiRoute.ts` uses `new ZodObject({coerce: true})` + `new TsObject(...)`
directly; `toParamObjectExpr.ts` deleted)

---

### 3. Generator emitted static infrastructure (`errors.generated.ts`) that doesn't vary with the OpenAPI schema [friction]

`gen-hono-api/src/ErrorCatalog.ts` is a ~200-line Snippet emitter that
produces `apps/service/src/routes/errors.generated.ts` — containing the
`HttpError` class, the `errors` catalog of constructor functions
(`badRequest`, `unauthorized`, …), the `toErrorResponse` mapper, the
`parseBody` helper, the `isFormFile` guard. **None of these vary with the
OpenAPI schema.** The file would be byte-identical for every project using
gen-hono-api. I extended this emitter happily — added a `ValidateSnippet`
to it to introduce `@hono/zod-validator` — before the user pushed back.

**What happened:** the user surfaced this as "It makes little sense to
write code generators for one-offs. Just write them in the project.
Generators are expected to have some awareness of components in their
target projects rather than be completely disconnected from their target
environment." The boundary test that resolves the question: *would two
different OpenAPI inputs produce different output for this file?* For
`errors.generated.ts`, the answer is no. The error envelope is
project-wide infrastructure, not codegen.

Refactor: deleted `gen-hono-api/src/ErrorCatalog.ts` (including the
`ErrorCatalog.ensure(context)` call in `mod.ts`); moved every line of the
file's content into hand-written `apps/service/src/routes/errors.ts`;
updated `gen-hono-api/src/ApiRoute.ts` + `HonoApi.ts` so the generated
routes import from `./errors` instead of `./errors.generated`; swept all
hand-written routes / handlers (13 files) for the same path swap; deleted
the now-orphaned `errors.generated.ts`.

**What was expected:** I'd assumed that "the generator outputs the route
files, so the error catalog those routes use should also be in the
generator's emission" — same package, same author, same emission step.

**Why it matters:** this is a deeper articulation of the
"customization seams" framing in the skill. The skill currently emphasises
that hardcoded export paths and peer imports are *deliberate* customisation
points — i.e., the **interface** between generator and project is fixed.
But it doesn't make the *symmetric* point: the project owns its
infrastructure. Generators integrate with hand-written project components,
they don't reinvent them. `gen-hono-api` already gets this right for
`../db`, `../env`, `../middleware/auth` (all hand-written, imported as
peers); `./errors.generated` was the outlier.

The friction also revealed a downstream improvement: with the error
envelope hand-written, I could immediately fix the malformed-JSON-becomes-
500 bug by adding a `HTTPException` branch to `toErrorResponse` — no
bundle, no generator iteration, just edit and reload. Generated infra
tightens that loop.

**Possible fixes:** unresolved — candidates: (a) add an operational
principle to `skmtc-generator` §"Operational principles" along the lines
of "Generators must not emit schema-independent infrastructure — those
files belong hand-written, imported by the generator as peers"; (b) audit
other stock generators (`gen-tanstack-query-*`, `gen-msw`) for similar
static-infra emitters; (c) add to the verification checklist: "would two
different OpenAPI inputs produce different output for this file? If no,
the file belongs hand-written, not generated."

**Version anchor:** `@skmtc/core@0.6.7`, `@skmtc/gen-hono-api@0.0.60`

**Status:** resolved 2026-05-27 (this session, commit 235d9d1 — `ErrorCatalog.ts`
deleted, replaced by hand-written `apps/service/src/routes/errors.ts`)

---

### 4. `OasOperation.toSuccessResponse()` lacks the callback form symmetric to `toRequestBody` [friction]

`OasOperation` exposes:

```ts
toRequestBody<V>(
  map: ({ schema, requestBody }: ToRequestBodyMapArgs) => V,
  mediaType = 'application/json'
): V | undefined
```

— a callback form that internalises `this.requestBody?.resolve()` and
`content[mediaType]?.schema` access. One line at the consumer:

```ts
const jsonSchema = operation.toRequestBody(({ schema }) => schema, 'application/json')
```

The symmetric helper for successful responses does **not** exist:

```ts
toSuccessResponse(): OasResponse | OasRef<'response'> | undefined
```

— bare accessor only. Consumers wanting the response schema for a media
type hand-roll the same logic the request helper packs into one line:

```ts
const successResolved = operation.toSuccessResponse()?.resolve()
const responseSchema = successResolved?.content?.['application/json']?.schema
```

**What happened:** `gen-hono-api/src/ApiRoute.ts` already had this two-line
hand-roll for the success response — pre-existing code, working fine. When
I touched the file during the variants work, `deno check` under 0.6.7's
stricter narrowing flagged it (`Property 'content' does not exist on type
'OasResponse | OasRef<"response">'` because `.resolve()`'s return type
hadn't yet narrowed to the concrete `OasResponse` in earlier core versions).
I "fixed" it with an even more elaborate structural form (resolve + invariant
+ explicit branching). The user pushed back twice — first "this is wrong
and you know it," then offering the obvious alternative `successResponse?.resolve()`.
Both pushbacks were legitimate because `OasRef.resolve()` IS idempotent
across the union (K3 — every sibling implements `.resolve()` returning
self) and the framework's own `toRequestBody` uses exactly that pattern.

But the *underlying* friction is the API asymmetry. `toRequestBody` exists
because the request-side lookup pattern was worth abstracting. The success-
side lookup pattern is identical in shape and equally worth abstracting.
The asymmetry forces every consumer of gen-hono-api-shaped generators to
re-do the work.

**What was expected:** that `OasOperation`'s response accessor mirrored
its request accessor.

**Why it matters:** API asymmetry surfaces as duplicated consumer code.
Once one accessor takes a callback form, the symmetric one should too —
otherwise the consumer pattern fragments: callback form for requests,
manual ref-walk for responses. New generators (including future
`gen-hono-mocks` mentioned in the gen-hono-api source) will hit the same
pattern and likely make the same `isRef() ? resolve() : self` ternary
mistake.

**Possible fixes:** unresolved — candidates: (a) add
`toSuccessResponse<V>(map: ({ schema, response }) => V, mediaType?): V | undefined`
to `OasOperation` mirroring `toRequestBody`; (b) generalize to
`toResponse<V>(statusCode, map, mediaType?)` and have `toSuccessResponse`
become a one-liner over it; (c) leave the API as-is and add an entry to
the generator skill's "Common consumer-side patterns" section showing the
canonical `toSuccessResponse()?.resolve()?.content?.[mediaType]?.schema`
form so it stops getting written defensively.

**Version anchor:** `@skmtc/core@0.6.7` —
`core/oas/operation/Operation.ts:130` (bare accessor) vs
`core/oas/operation/Operation.ts:167` (`toRequestBody` callback form)

**Status:** open

---

### 5. Defaulted to `curl`-grepping JSR `.ts` source rather than reading `<skmtc-root>/skmtc/deno/docs/` [friction]

Every time I needed to verify an API shape during this session, my first
move was `curl -s https://jsr.skmtc.dev/@skmtc/core/0.6.7/<path>.ts | grep
<symbol>`. This produced answers, but with no prose context, no rationale,
no examples — and missed the canonical patterns the docs surface. Twice
the user had to redirect: "why are you looking at source and not docs?"

**What happened:** I knew the docs existed — the `skmtc-generator` and
`skmtc-cli` skills explicitly reference paths like `reference/api/oas-ref.md`,
`concepts/projections-and-snippets.md`, `authoring/recipes/`. But those
paths read like project-internal documentation paths to me at first
glance, not addressable files. JSR `.ts` files ARE addressable by URL
without leaving the agent's tool surface, so they became my default.
Resolving the docs path turned out to be a single `find` call:

```
find /Users/dmitrigrabov/workspace -name "projections-and-snippets.md" 2>/dev/null
→ /Users/dmitrigrabov/workspace/skmtc-root/skmtc/deno/docs/concepts/projections-and-snippets.md
```

Once found, the docs had answers like (from `reference/api/oas-ref.md`):

> `resolve(lookupsPerformed?: number): ResolvedRef<T>` — Recursively
> resolves the ref to its final non-ref target.

— exactly the information that made the `isRef() ? resolve() : self`
ternary obviously wrong. The source file `Ref.ts` has the same signature
but no narrative.

**What was expected:** that grepping source was a reasonable default
because the API surface is small and TypeScript-typed.

**Why it matters:** documentation captures *why* and *how*, not just
*what*. The source captures only *what*. For an LLM agent, defaulting to
source means converging on technically-correct but contextually-poor
answers (the kind that propagate antipatterns). For SKMTC specifically,
the docs/ tree is where the operational guidance lives — and where the
skill's own cross-references point. Bypassing it is a recurring loss.

**Possible fixes:** unresolved — candidates: (a) add an explicit
instruction near the top of `skmtc-generator` and `skmtc-cli` skills:
"Before reaching for source-grep, resolve the docs path. Docs are at
`<skmtc-root>/skmtc/deno/docs/`. Find with
`find ~/workspace -path '*skmtc*/deno/docs' -type d`."; (b) bake a
`skmtc agent-context --json` field that names the docs path so it's
surfaced at startup; (c) include a few critical doc-pages by absolute
path in the existing skills (the OasRef one would have saved this
session multiple round-trips).

**Version anchor:** Session-agnostic — observed against
`<skmtc-root>/skmtc/deno/docs/` as of 2026-05-27.

**Status:** open

---

### 6. `core@0.6.6 → 0.6.7` requires `variant` on `ModelDriver` constructor; cloned generators break silently [friction]

`@skmtc/core@0.6.6/dsl/model/ModelDriver.ts` line 12 — `CreateModelArgs`
has no `variant` field. `@skmtc/core@0.6.7/dsl/model/ModelDriver.ts` line
25 — `CreateModelArgs.variant: string` is required (not optional). The
breaking change is silent: `deno bundle` (esbuild) strips types, so cloned
generators that call `new ModelDriver({…})` without threading variant
bundle successfully but throw at the first `transform` call with
`Cannot insert variant 'undefined' for '<refName>' — peer has no enrichments
configured. Only 'main' is permitted.`

**What happened:** in this project (skmtc-hub), `gen-typescript/src/TsRef.ts`
and `gen-zod/src/ZodRef.ts` were both cloned from stock generators and
neither passed `variant`. After bumping core to 0.6.7, the first
`skmtc generate` errored at runtime with the `assertPeerVariantExists`
throw. Diagnosis: trace from the error message back to `ModelDriver`'s
constructor, then to each `*Ref.ts` site that constructs one. Fix is
mechanical — pass `variant: 'main'` (or thread the caller's variant if
the generator is variants-aware): `new ModelDriver({ …, variant: 'main' })`.
But also need to update `toModelGeneratorKey` (which also requires
`variant` in 0.6.7) and `toModelContentSettings` (also accepts `variant`,
needed for the in-cycle ref path).

**What was expected:** that the major-minor stay (0.6.x) implied no
breaking API changes. The doctor's `project-core-pin/<project>` check
even reports the 0.6.7 pin as "compatible" with the 0.6.7 CLI, framing
it as a no-friction bump.

**Why it matters:** breaking changes inside a single minor version
without an explicit migration call-out leave cloned generators
load-bearing landmines. Every project that has cloned `gen-typescript`,
`gen-zod`, `gen-tanstack-query-*`, etc. has the same `*Ref.ts` pattern.
A core release that adds required arguments to constructors that cloned
code invokes is, in effect, a major-bump worth of consumer work.

**Possible fixes:** unresolved — candidates: (a) make `ModelDriver`'s
`variant` default to `'main'` when omitted, so existing cloned code keeps
working; (b) ship a 0.6.6 → 0.6.7 migration note documenting which call
sites in cloned generators need updating, with a sed recipe; (c) version
the API change as a major bump (0.7.x) so the contract is honest;
(d) add an `agent-context` field that lists generator-side hot points
that historically need migration on core bumps.

**Version anchor:** `@skmtc/core@0.6.6` → `@skmtc/core@0.6.7`,
`@skmtc/gen-typescript@0.0.61` (local clone), `@skmtc/gen-zod@0.0.59`
(local clone). Affected files:
`gen-typescript/src/TsRef.ts:36`, `gen-zod/src/ZodRef.ts:40`.

**Status:** open

---

### 7. Cross-generator Snippet composition via direct construction (`new ZodObject({coerce: true})`) is the canonical inline-coercive pattern [win]

When generator A needs to emit an inline schema using generator B's
emission machinery — with a specific behavioural toggle like `coerce: true`
— the canonical pattern is **direct Snippet construction**, not any of
`insertModel`, `insertNormalizedModel`, or `insertOperation`. The Snippet
is interpolated into A's output via template literal, anonymous, no
Definition emitted, full control over the construction args.

Concretely, in `gen-hono-api/src/ApiRoute.ts` after the refactor:

```ts
import { ZodObject } from '@skmtc/gen-zod'
import { TsObject } from '@skmtc/gen-typescript'
import { toGeneratorOnlyKey } from '@skmtc/core'

const objectSchema = operation.toParametersObject(['query'])
const generatorKey = toGeneratorOnlyKey({ generatorId: denoJson.name })

this.queryZod = new ZodObject({
  context, destinationPath, objectSchema,
  modifiers: { required: true }, generatorKey,
  coerce: true     // ← peer Snippet's coercion knob, threaded directly
})
this.queryTs = new TsObject({
  context, destinationPath, value: objectSchema,
  modifiers: { required: true }, generatorKey
})
```

— and the same Snippets interpolate in `toString()`:

```ts
middlewares.push(`  validate('query', ${this.queryZod})`)
// ...
lines.push(`  query: ${this.queryTs}`)
```

**Why this is a `[win]`:** another agent doing this task without seeing the
pattern would almost certainly do it wrong. The wrong choices include:
(a) hand-rolling a per-type emitter inside gen-hono-api (what I did first),
duplicating gen-zod's coercion rules; (b) reaching for
`insertNormalizedModel` with a `coerce` option that doesn't exist;
(c) declaring per-route synthetic refNames in `components.schemas` to get
the engine to fan-out variants. All three are dead ends. The right choice
follows from three facts that aren't currently centred in any one doc:

1. gen-zod / gen-typescript export their internal Snippets from `mod.ts`
   — they're meant for cross-generator composition, not just internal use.
2. The Snippet's constructor args ARE the extension surface — `coerce`,
   `modifiers`, `rootRef`, etc.
3. `OasOperation.toParametersObject([filter])` synthesises an OasObject
   from parameters at a location — the perfect input shape for `ZodObject`
   and `TsObject`.

Stitching those three together gives the pattern; missing any one leads
to wrong choices.

**Why it matters:** this is the pattern for **all** inline cross-generator
composition with custom behaviour — not just hono+zod. The next time
someone wants a generator A to embed coercive-form output of generator B
inline, they should reach for this. The pattern needs to be the prescribed
answer in `authoring/recipes/`.

**Version anchor:** `@skmtc/core@0.6.7`,
`@skmtc/gen-zod@0.0.59` (with the variants-aware patch),
`@skmtc/gen-typescript@0.0.61`,
`@skmtc/gen-hono-api@0.0.60` (with the @hono/zod-validator integration).

**Status:** open

---

## Priority for docs/skills

The session produced two anti-pattern findings (#2, #3) the user surfaced
in real time, one positive pattern (#7) that's the resolution of both, and
a long-tail of friction worth fixing at the framework level (#1, #4, #6).
Highest leverage for follow-up:

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #2 + #7 (paired) — "use `insertNormalizedModel` or roll your own?" decision is currently underdocumented; direct Snippet construction is the correct pattern for inline + behavioural-variant composition | LLM agents writing cross-generator code WILL hit this exact decision; the wrong answer cascades into duplicated emission logic and divergent coercion rules across packages | (a) Add row to generator skill §"Decision tree: which `insert*` helper for which job" covering "Inline + behaviour-varying enrichment → direct Snippet construction"; (b) Write `authoring/recipes/cross-generator-inline-composition.md` using the `OasOperation.toParametersObject(['path'\|'query'])` + `ZodObject({coerce: true})` + `TsObject(...)` pattern from #7 as the canonical example |
| 2 | #3 + K10 — generator emitted static infrastructure that doesn't vary with the schema, was happily extended (not removed) until user surfaced the smell | Generators that emit schema-independent boilerplate are an anti-pattern that propagates via cloning; the corrective principle is implicit in the skill but not explicit | Add to `skmtc-generator` §"Operational principles" table: row "Emit boilerplate that doesn't vary with the schema" → "Hand-write as project infrastructure; generator imports as peer (alongside `../db`, `../env`)". Boundary test: "would two different OpenAPI inputs produce different output for this file?" Audit stock generators (`gen-msw`, `gen-tanstack-query-*`) for the same smell |
| 3 | #1 — `deno.lock` workspace section caches stale per-member resolution after `deno.json` bumps; doctor doesn't catch it | Version-skew bugs where every observable surface says the version is correct are the worst class of bug; this exact failure mode is reproducible on every `core` bump in a workspace with cloned generators | Add `doctor` check `lock-resolution-matches-pins/<project>` that resolves each workspace member's `@skmtc/*` imports via deno and diffs against the declared pin. Doc-side: a one-paragraph procedural note in skmtc-cli §"how to bump core" pointing at `deno.lock` deletion or `deno cache --reload` as the manual workaround until the check lands |
