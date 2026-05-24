# 2026-05-24 — TypeSpec examples → OpenAPI → service mock bridge

Built out TypeSpec `@opExample` coverage for skmtc-api (13 files, 45
example blocks in OpenAPI) and wrote a bridge script that extracts
those into a TS module the apps/service mock router consumes
(`@skmtc/api/examples`). Wired through 47 of 51 mock endpoints,
leaving only 4 CMS-specific surfaces on hand-written entities. The
session continues from `2026-05-24-gen-tanstack-query-integration.md`
but operates entirely above the generator layer.

## Knowledge acquired

Working on contract-first mock-data plumbing — TypeSpec authoring,
`@opExample` shape, and the OpenAPI → consumer pipeline. Operated
against `@typespec/compiler@1.12.0` + `@typespec/openapi3@1.12.0`.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | TypeSpec `const` declarations don't support `.` member access on other consts. `userAccount.handle` fails with `invalid-ref: Cannot resolve 'handle' in node ConstStatement since it has no members. Did you mean to use "::" instead of "."?`. The `::` namespace operator is for namespaces, not const fields — there's no syntax to reference a const's individual field. Workaround: spread the literal duplicate. | TypeSpec language reference; missing example pattern in any SKMTC docs |
| K2 | For ops whose success response is the discriminated form `{ @statusCode statusCode: 201; @body body: T }`, the `@opExample` `returnType` must wrap: `returnType: #{ statusCode: 201, body: Examples.foo }`. Bare `returnType: Examples.foo` fails with `unassignable: Type {...} is not assignable to type ...{ statusCode: 201, body: T } \| ...`. | If a SKMTC example-emitter generator is built, document this wrapper; or document in TypeSpec usage notes. |
| K3 | `@opExample(#{ returnType: X })` with a single example emits OpenAPI as `example:` (a single value). Two `@opExample` decorators on the same op, each with `#{ title: "..." }`, emit as `examples:` (a named map). The two forms aren't interchangeable for OpenAPI consumers — `example` is on the content object directly, `examples` is keyed by title. | Useful for consumers that walk OpenAPI: support both shapes. |
| K4 | TypeSpec literal syntax: `#[a, b]` for tuples, `#{ field: value }` for objects, `utcDateTime.fromISO("2026-05-19T18:00:00Z")` for date literals, `EnumName.value` for enum members, `null` for nullables. The `#` prefix marks value literals as opposed to type expressions. Discovered via trial — got "unassignable" errors with `[a, b]` (looked like array, parsed as something else). | Belongs in any "Authoring TypeSpec examples" how-to doc. |
| K5 | Canonical SKMTC generators live at `<skmtc-root>/skmtc-generators/`. The `<skmtc-root>/.skmtc/<project>/` location holds **clones** (per-project customised copies). I confused the two and almost extracted customisations to a workspace package in the consumer repo — the user redirected: customisations should be upstreamed to the canonical source, or kept in `.skmtc/` made part of a tracked codebase. Already captured in `2026-05-24-gen-tanstack-query-integration.md` #5. | `skmtc-cli` skill §2 "Mental model" — the two locations are present but the distinction between "JSR-published source" / "consumer-local clone" / "upstream-canonical source" isn't drawn. |
| K6 | The current skmtc generator set has no "OpenAPI examples → service handlers" generator. I built `packages/api/scripts/build-examples.ts` as a hand-rolled bridge (reads `dist/openapi.SkmtcApi.json`, walks paths × methods × responses × `examples`/`example`, emits `dist/examples.ts`). For a real consumer this would ideally be a `@skmtc/gen-mock-fixtures` package emitting Hono handlers directly. | Missing generator package — a high-value addition to skmtc-generators. |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `@opExample` returnType for discriminated success responses needs explicit `{ statusCode, body }` wrap | friction | open |
| 2 | TypeSpec const member access isn't supported, forcing literal duplication across examples | friction | open |
| 3 | Default instinct under contract / service mismatch is to loosen the contract; that's the wrong fix | friction | open |
| 4 | Build-time bridge (OpenAPI examples → typed `Record<'METHOD /path', T>`) is the pattern for "examples drive runtime" before a real generator exists | win | open |

---

### 1. `@opExample` returnType for discriminated success responses needs explicit `{ statusCode, body }` wrap [friction]

Authoring `@opExample` for the `createAccessToken` op, whose success
response shape is `{ @statusCode statusCode: 201; @body body:
AccessTokenWithSecret }`.

**What happened:** wrote
```typespec
@opExample(#{
  parameters: #{ body: #{ name: "Release bot", scopes: #["write:releases"] } },
  returnType: Examples.newAccessToken,
})
```
where `newAccessToken: AccessTokenWithSecret`. Compile failed:
```
src/user.tsp:122:12 - error unassignable: Type '{ id: "...", name: "Release bot", ..., secret: "..." }' is not assignable to type 'SkmtcApi.User.{ statusCode: 201, body: AccessTokenWithSecret } | SkmtcApi.ErrorAt<400> | SkmtcApi.ErrorAt<401> | SkmtcApi.ErrorAt<422>'
```

Fix: wrap the example as the discriminated body:
```typespec
returnType: #{ statusCode: 201, body: Examples.newAccessToken },
```

**What was expected:** that the `@opExample` would auto-discriminate
by shape — pick the response union member whose `body` type matches
the example value. Or treat the example as the body of the success
response by default.

**Why it matters:** every `@post` / `@put` operation in SKMTC's
example contract uses the discriminated form to attach a non-200
status code. So every create/update example needs the wrap, which
isn't obvious until you hit the error. The error message is
correct but doesn't suggest the fix; the union type in the failure
doesn't visually align with the simple body the author wrote.

**Possible fixes:** unresolved. Could be addressed at the TypeSpec
level (auto-pick union member matching the body shape), at the
docs level (explicit "wrap the body for status-coded responses"
note in the @opExample reference), or by a SKMTC convention helper
(`@opExampleBody` that handles the wrap automatically when the success
type is discriminated). The user-facing pain is in OpenAPI generators
that have any consumer mixing 200 and 201/202 success codes — which
is most real APIs.

**Version anchor:** `@typespec/compiler@1.12.0`, `@typespec/openapi3@1.12.0`

**Status:** open

---

### 2. TypeSpec const member access isn't supported, forcing literal duplication across examples [friction]

Porting `userAccount.handle`-style field references from the TS
fixtures (`packages/api/src/mock/entities.ts`) into TypeSpec
examples. The TS form treats consts as records; the natural TypeSpec
port reaches the same way.

**What happened:** wrote
```typespec
const authenticatedUser: User.AuthenticatedUser = #{
  handle: userAccount.handle,
  displayName: userAccount.displayName,
  ...
  email: "ada@acme.example",
  plan: "team",
};
```

Compile failed:
```
src/examples/user.tsp:17:25 - error invalid-ref: Cannot resolve 'joinedAt' in node ConstStatement since it has no members. Did you mean to use "::" instead of "."?
```

`::` is for namespace member access (e.g. `SkmtcApi::Visibility::public`),
not const-record field access. There appears to be no syntax for
"refer to one field of another const". Fix: inline all the field
literals.

**What was expected:** that const-to-const composition would work
the same way TypeScript would. TS fixtures use `{ ...orgAccount,
email: "..." }` for the same authenticated-user pattern; reaching
into a const seems like the basic case.

**Why it matters:** the workaround is duplicate literal data across
files. The TS fixture had `...userAccount` plus the extra fields;
the TSP port has the full Account literal inlined into AuthenticatedUser.
The same problem will recur for every example that derives from
another (notifications referencing a deployment's htmlUrl, releases
referencing a stack's htmlUrl, etc.). The fork between TS-fixture
ergonomics and TSP-example ergonomics is real.

**Possible fixes:** unresolved. Likely TypeSpec-level (compiler
support for member access on const records, or a spread operator for
const literals). For SKMTC's purposes, an `@opExample` could
preprocess a parameterised template, but that's heavyweight.

**Version anchor:** `@typespec/compiler@1.12.0`

**Status:** open

---

### 3. Default instinct under contract / service mismatch is to loosen the contract; that's the wrong fix [friction]

The `Page<T>` model in `models/common.tsp` declared `pagination:
Pagination` (required). At runtime, two service handlers in
`apps/service/src/routes/generators.ts` returned bare `{ items }` —
no pagination. The generated Zod hook rejected the response, the
versions query errored, and the UI broke.

**What happened:** my first fix changed `Page<T>` to make pagination
optional (`pagination?: Pagination`), regenerated everything, the
UI worked. The user pushed back: *"why is pagination optional? does
that make sense?"*. The right fix is service-side — wrap the response
with `pagination: { hasMore: false, totalCount: items.length }` to
honour the contract. I reverted the TSP change and fixed the
service.

**What was expected:** the default "make the schema match what the
implementation returns" instinct treats the schema as a description.
In a contract-first API, the schema is the **specification**, and
the implementation is the description.

**Why it matters:** this is the contract-first inversion. Every time
a generated client mismatches a real server response, the question
is "which is the bug?" — and in a contract-first project the answer
is almost always the server, because the contract is the source of
truth. The CLAUDE.md for skmtc-hub explicitly says so ("the contract
is authored in TypeSpec, and the types, Zod schemas, API clients
and servers are generated from it"). But "loosen the contract to
match reality" is the path of least resistance under time pressure,
especially when the contract change is one character (`?`) and the
server change is N handlers.

The behaviour pattern is: when you find yourself reaching for a `?`
or `Optional<>` to make generated code stop erroring, stop. Ask
which side is wrong. In a contract-first project, prefer fixing
the side that's *not* the contract.

**Possible fixes:** unresolved — this is a behaviour-level pattern,
not a tooling problem. Could be a guardrail in the `skmtc-cli`
skill ("when generated code errors against live data, suspect the
implementation first") or in CLAUDE.md templates for contract-first
projects.

**Version anchor:** `@typespec/compiler@1.12.0`, `@skmtc/cli@0.3.7`

**Status:** open

---

### 4. Build-time bridge (OpenAPI examples → typed `Record<'METHOD /path', T>`) is the pattern for "examples drive runtime" before a real generator exists [win]

Pattern: take the OpenAPI document SKMTC already produces and extract
the per-operation examples into a single JSON-as-TS module the
consumer service imports directly. Bridges the "TypeSpec is the source
of truth" → "service handlers serve realistic data" gap without
waiting on a new generator.

**What it looks like:**

`packages/api/scripts/build-examples.ts` (~70 lines):
```ts
// Reads dist/openapi.SkmtcApi.json
// Walks paths × methods × responses
// For each op with a 2xx response that has `example` or `examples`:
//   emit { [`${METHOD} ${path}`]: exampleValue }
// to dist/examples.ts as `export const examples: Record<string, unknown> = {...}`
```

`apps/service/src/routes/mock.ts`:
```ts
import { examples } from '@skmtc/api/examples'

function mockExample(key: string): unknown {
  const value = examples[key]
  if (value === undefined) {
    throw new Error(`Mock route '${key}' has no TypeSpec example to serve.`)
  }
  return value
}

mock.get('/v1/accounts/:handle', (c) => c.json(mockExample('GET /v1/accounts/{handle}')))
```

Three properties that make this load-bearing:

1. **Throw on missing key**, not silent 404 — wiring bugs surface
   at handler-call time with the OpenAPI key in the error, so it's
   immediately clear which `@opExample` is missing.
2. **The path is the OpenAPI path template** (`{handle}`), not the
   Hono route shape (`:handle`) — keeps the lookup independent of
   the host framework's syntax.
3. **`Record<string, unknown>`**, not a typed map — the consumer
   already validates with Zod at the boundary; over-typing here
   would either need full OpenAPI → TS code generation (which is
   what the future skmtc generator would do) or trip on
   `discriminated union by route` type-system limits.

**Why this is a win worth codifying:** every team adopting SKMTC
needs realistic data to drive their UI during development. The
default options today are (a) hand-write a TS fixtures module (what
this session was migrating *away* from — see
`2026-05-24-gen-tanstack-query-integration.md` #5 for the
maintenance pain), (b) hit a real backend (latency + auth setup +
data shape coupling), or (c) wait for the missing generator. The
build-script bridge is a 70-line bypass that takes the same TypeSpec
examples documenting the API and turns them into a service-runnable
mock layer.

The pattern generalises beyond service mocks: any "I have OpenAPI
examples, I want them at runtime" use case (Storybook fixtures,
MSW handlers, contract tests) can use the same extraction shape.

**Why it matters:** SKMTC's contract-first story is "TypeSpec drives
everything." Examples are the last mile — most consumers won't
notice they belong in the contract until they see this pipeline
work. Until the real `@skmtc/gen-mock-fixtures` generator exists,
the build script IS the pattern.

**Possible fixes:** the obvious upgrade is a proper SKMTC generator
that emits Hono (or Express, or Fastify, or...) handler files from
the OpenAPI directly. That would let the consumer skip
`mock.ts` entirely. The bridge script is the half-step.

**Version anchor:** `@typespec/openapi3@1.12.0`, custom build script
(no SKMTC dependency)

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #4 — Build-time OpenAPI-examples bridge | Unblocks every contract-first SKMTC adopter from having realistic mock data without writing fixtures; the 70-line script is the missing on-ramp before a real generator exists | Either ship the bridge script as a reusable package (`@skmtc/cli` task: `skmtc extract-examples <project>` that emits the JSON-as-TS module), or build `@skmtc/gen-mock-fixtures` proper. Either way the pattern needs a home outside one consumer repo. |
| 2 | K6 — No "OpenAPI examples → service handlers" generator exists | The build script is the workaround for a missing generator; a proper one would emit Hono handler modules directly, eliminate the `mockExample()` indirection, and let the consumer just `app.route('/', mockHandlers)` | New generator package in skmtc-generators repo. Inputs: OpenAPI document. Outputs: a Hono router file with one handler per operation that has an example. |
| 3 | #3 — Default instinct loosens the contract | The contract-first inversion is the entire point of TypeSpec-driven SKMTC, and the moment a generated client errors against real data the natural reach is for `?`. Without a guardrail in the skill, every adopter will do this once. | Add a behaviour rule to the `skmtc-cli` skill (or skmtc-hub-style CLAUDE.md template): "when generated code errors against live data, suspect the implementation first; loosening the contract is almost never the fix." |
