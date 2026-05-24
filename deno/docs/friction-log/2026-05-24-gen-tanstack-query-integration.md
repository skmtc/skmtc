# 2026-05-24 — Integrating cloned `gen-tanstack-query-fetch-zod` into apps/main

Wired the cloned tanstack-query generator into `apps/main` (added it as
a second `packages` entry, customised its `toExportPath` + import map,
regenerated, and made the consumer compile under strict tsconfig).
Continuation of `2026-05-21-multi-package-output-routing.md` (#4) on
the orchestrator-pulls-JSR-peers issue.

## Knowledge acquired

Working on the cloned `gen-tanstack-query-fetch-zod` against
`@skmtc/core@0.6.2` / `@skmtc/cli@0.3.7`, integrating into a
TanStack-Start-based `apps/main` with `verbatimModuleSyntax: true` +
`strict`.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `toPathTemplate(path, queryArg?)` — the optional second arg prefixes path-template interpolation with `${queryArg}.`. So `toPathTemplate('/v1/foo/{id}', 'args')` → `` `/v1/foo/${args.id}` ``. This is the lever for emitting hooks that take a full `args` object instead of destructuring. Discovered via grep through `bundle.js`; no skill or doc mentions it. | Missing API reference; also missing from the `args.*` emission pattern (W1) |
| K2 | `insertNormalizedModel(projection, { schema, fallbackName }, opts)` dispatches two ways: **ref schemas** → `insertModel(projection, refName, ...)` which uses the peer projection's `toExportPath` (so a ref goes wherever the peer says); **inline schemas** → `defineAndRegister(...)` at the **caller's** `destinationPath` (the inline schema becomes a definition inside the calling file). This isn't symmetric and surprised me. | `skmtc-generator` skill §insertNormalizedModel — explicit two-path note + when each fires |
| K3 | TanStack Query v5's `MutationOptions.onSuccess` takes **4 args** — `(data, variables, onMutateResult, context)` — not 3. The cloned `gen-tanstack-query-fetch-zod@0.0.60` emits the 3-arg shape, which fails type-check under v5 (TS2554). | Not a SKMTC issue; the cloned generator template is stale vs upstream. Note on the generator's CLAUDE.md, or upstream bump. |
| K4 | `Identifier.toImport({ alias })` is the canonical way to register a renamed import. Usage: `register({ imports: { module: [id.toImport({ alias: 'foo' })] } })`. The named-tuple shape `{ name, alias, type }` (already used by the engine internally) is also accepted. Not surfaced in any skill I'd read. | Missing — `skmtc-generator` skill §import-registration could show this alongside the `{ name, type: 'type' }` example |
| K5 | Confirmed-and-fixed instance of 2026-05-21 #4. Root cause when an orchestrator generator silently pulls JSR peers instead of local clones: the orchestrator's own `deno.json#imports` overrides the parent project's `deno.json#imports`. Each cloned generator package has its **own** `deno.json` whose `imports` map is closer to the source and wins resolution. Visible symptom: duplicate files in the output tree (the JSR peer's `toExportPath` and the cloned peer's `toExportPath` both fire, producing parallel files with subtly different import paths). Fix path: rewrite the orchestrator's inner `deno.json#imports` from `jsr:@skmtc/gen-X@…` to a relative path (`../gen-X/mod.ts`) matching the parent project's clones. | Belongs in the clone how-to as a checklist step; reinforces #4 from 05-21 with a concrete repro + fix |
| K6 | `skmtc generate` reports `errors: 0` / `parseIssues: 0` on **generation success** — the bundle ran, the worker emitted files, no template threw. It does **not** typecheck the produced files in the consumer. The `--typecheck` flag (already in §4 of the skmtc-cli skill) is what closes that gap. I integrated without it and spent ~3 cycles fixing issues the flag would have surfaced up front. | Promote `--typecheck` in the §10 "Setting up SKMTC" task card as the default verification step when integrating into a strict consumer |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Stock `gen-tanstack-query-fetch-zod` shadows imported schemas with destructured path params | blocker | open |
| 2 | Stock `MutationFn` references `body` from undefined scope | blocker | open |
| 3 | Stock `onSuccess?.(...successArgs)` is stale vs TanStack Query v5 | friction | open |
| 4 | `args.*` emission pattern avoids the whole class of name-collision bugs | win | open |
| 5 | No canonical pattern for version-controlling cloned generators in a consumer repo | friction | open |

---

### 1. Stock `gen-tanstack-query-fetch-zod` shadows imported schemas with destructured path params [blocker]

Working on the cloned `gen-tanstack-query-fetch-zod@0.0.60`, generating
74 hooks into `apps/main/src/services/`, then running
`pnpm check-types` against the result.

**What happened:** the stock generator emits hooks like:

```ts
import { generator } from '@skmtc/models'   // a Zod schema

export const useGetApiV1GeneratorsAccountGenerator = ({account, generator, version}: Args) => {
  useQuery({
    queryFn: () => apiFetch(`/v1/generators/${account}/${generator}`, generator, { method: 'GET' })
  })
}
```

The path `/v1/generators/{account}/{generator}` has a path param
**also called `generator`**. The destructure `{account, generator,
version}` binds `generator` as a string in the function scope,
shadowing the imported Zod schema of the same name. The `apiFetch`
call then receives the *string* path-param value as its schema
argument:

- `error TS2345: Argument of type 'string' is not assignable to parameter of type 'ZodType<…>'`
- `error TS6133: 'generator' is declared but its value is never read` — the import is unused

Affects every operation whose path-param identifier matches an
imported model identifier — in this project: `generator`, `stack`,
`api`, `run`, etc.

**What was expected:** the stock generator produces consumer-compilable
hooks out of the box (or at least, doesn't *silently* corrupt the
runtime call signature).

**Why it matters:** the bug is **silent at generation time** — the
template stringifies fine, identifier names are valid, no parse
issues. It surfaces only when the consumer typechecks the output
(K6). And the **runtime consequence** is worse than the compile error:
`apiFetch(path, '/some/string', opts)` would attempt to parse a string
through the Zod-validation branch and throw at every call. Type
shadowing inside template-string generators is a footgun that has no
SKMTC-level guardrail.

**Possible fixes:** unresolved — the template-level workaround
(`args.*` pattern, see #4) avoids the shadowing entirely. An
engine-level option would be `register({ imports })` exposing an
auto-alias strategy when an identifier collides with declared params
of the calling scope, but that requires the template to declare its
scope to the engine, which it currently doesn't.

**Version anchor:** `@skmtc/core@0.6.2`, `@skmtc/cli@0.3.7`,
`@skmtc/gen-tanstack-query-fetch-zod@0.0.60`

**Status:** open

---

### 2. Stock `MutationFn` references `body` from undefined scope [blocker]

Same context as #1 — the cloned `gen-tanstack-query-fetch-zod` template,
inspected after generation.

**What happened:** the stock template for `MutationFn.toString()`:

```ts
return `async () => {
  const res = await fetch(\`${toPathTemplate(path)}\`, {
    method: '${method.toUpperCase()}',
    ${this.parameter.hasProperty('body') ? 'body: JSON.stringify(body),' : ''}
  })
  ...
}`
```

The emitted `mutationFn` takes **no arguments** (`async () =>`), but
the body of the function references a bare `body` identifier via
`JSON.stringify(body)`. That `body` is never in scope — tanstack-query
invokes `mutationFn` as `(variables) => Promise<TData>`, so the
template should destructure `({ body, …pathParams })` from
`variables`. As shipped, every mutation against an operation with a
request body emits `ReferenceError: body is not defined` at runtime,
plus `TS2304: Cannot find name 'body'` at compile time.

Discovered by inspecting the generated output for `usePatchApiV1User`
after the integration smoke test.

**What was expected:** mutation hooks that work when called.

**Why it matters:** the template was apparently never end-to-end
integration tested. The stock generator is published to JSR at
`@skmtc/gen-tanstack-query-fetch-zod@0.0.60`; anyone cloning it
inherits the bug.

**Possible fixes:** unresolved — fixed in this session by switching to
`(args: ArgsType) => apiFetch(\`${path-with-args.*}\`, schema, { body:
JSON.stringify(args.body) })`. The upstream stock generator should
take the same fix (this is the `args.*` pattern from #4 in narrower
form).

**Version anchor:** `@skmtc/gen-tanstack-query-fetch-zod@0.0.60`

**Status:** open

---

### 3. Stock `onSuccess?.(...successArgs)` is stale vs TanStack Query v5 [friction]

Same context — stock `MutationEndpoint.toString()`.

**What happened:** stock template:

```ts
onSuccess: (...successArgs) => {
  void queryClient.invalidateQueries({ queryKey: [...]})
  onSuccess?.(...successArgs)
}
```

Two type errors under strict mode:

- `TS7019: Rest parameter 'successArgs' implicitly has an 'any[]' type` — the rest parameter is untyped.
- `TS2554: Expected 4 arguments, but got 3` — when `onSuccess?.(...successArgs)` is called and `successArgs` is `unknown[]`, the call site mismatches the declared `onSuccess` signature.

TanStack Query v5's `MutationOptions.onSuccess` is now
`(data: TData, variables: TVariables, onMutateResult: TOnMutateResult, context: MutationFunctionContext) => unknown`
— **four** positional args, not three. Stock template was authored
against a 3-arg signature (v4 / early-v5).

**What was expected:** the stock template tracks current peer-library
signatures, or at least has typed rest spreads.

**Why it matters:** this is the third stock-template bug in this
session (alongside #1 and #2). The pattern is the same: a JSR-published
generator that doesn't run against a strict-mode consumer in CI. Each
bug surfaces only at consumer-typecheck time; `skmtc generate` is
happy.

**Possible fixes:** unresolved — fixed in this session by emitting the
explicit signature `(data, variables, onMutateResult, context)` and
forwarding all four args. Upstream should adopt the same.

**Version anchor:** `@skmtc/gen-tanstack-query-fetch-zod@0.0.60`,
`@tanstack/react-query@5.100.14`

**Status:** open

---

### 4. `args.*` emission pattern avoids the whole class of name-collision bugs [win]

A template-design pattern for hook-emitting generators
(tanstack-query, swr, etc.) that bypasses identifier shadowing
between path-param destructuring and imported peer-generator
identifiers.

**What happened:** rather than:

```ts
// Stock pattern — destructure path params at hook scope
(({account, generator}: Args) => { ... `${account}/${generator}` ... })
```

emit:

```ts
// args.* pattern — pass args wholesale, reference via property access
((args: Args) => { ... `${args.account}/${args.generator}` ... })
```

The `toPathTemplate(path, 'args')` second arg (K1) does the path
interpolation rewrite; the only required change in the Endpoint is to
take `(args: ArgsType)` instead of `(${this.parameter})` and rewrite
`queryKey` entries from bare names to `args.X`. For operations with
no params, emit `()`.

The pattern eliminates **every** shadow collision between path-param
names and imported identifiers, not just the cases that happen to
collide today. New collisions don't appear silently as the contract
evolves.

**Why it matters:** identifier shadowing inside template-string
generators has no compile-time guardrail. The current `Stock cloned`
generator design (destructure path params at hook scope) is a latent
bug factory — every new path-param name added to the OpenAPI/GraphQL
contract is a roll of the dice. Switching to `args.*` is a
template-level invariant: the path-param namespace and the module-
import namespace can never overlap.

The pattern is general — any generator that emits a function whose
body interpolates parameter values **and** also imports peer-generator
output by identifier can use it. Currently every stock hook generator
I've inspected uses the destructure pattern; none use `args.*`.

**Version anchor:** `@skmtc/core@0.6.2`,
`@skmtc/gen-tanstack-query-fetch-zod@0.0.60` (customised)

**Status:** open

---

### 5. No canonical pattern for version-controlling cloned generators in a consumer repo [friction]

The customised generator(s) in `~/workspace/skmtc-root/.skmtc/skmtc-hub/`
are the single biggest piece of work this session — the `args.*`
pattern, MutationFn destructure fix, onSuccess 4-arg signature,
URLSearchParams emission, per-endpoint queryKey discriminator. They
live on disk only, outside any git repo (skmtc-root is not itself a
repo; only its sibling project directories are).

**What happened:** asked to "version-control the generator
customisations", my first instinct was to extract them into the
consumer repo at `skmtc-hub/packages/gen-tanstack-query-fetch-zod/`
as a workspace package, then point `.skmtc/skmtc-hub/deno.json` at
the new tracked location.

The user corrected: "[the generator] should be part of actual
codebase and live in `/Users/dmitrigrabov/workspace/skmtc-root/.skmtc/skmtc-hub`
instead. This was key mistake."

**What was expected:** that there'd be a documented pattern for
"clone a generator, customise it, version-control the customisation".
The `skmtc clone` card in §10 of the skmtc-cli skill covers cloning
and editing; nothing covers what to do next to keep the edits
durable. I treated it as a TypeScript-project problem ("extract to
a workspace package") because that's the default training-data
pattern, but the right answer keeps the cloned source at the path
skmtc expects.

The user's intent was clearer in retrospect: make the `.skmtc/`
directory itself part of the version-controlled codebase (likely by
either initializing git AT skmtc-root, or moving `.skmtc/` INTO the
consumer repo and adjusting skmtc resolution accordingly). Neither
of those is obvious from the skill docs.

**Why it matters:** every consumer that clones a generator hits this
same fork in the road as soon as they want a teammate to be able to
reproduce the build. The choice between "track inside `.skmtc/`",
"extract to consumer's package layout", and "publish a fork to JSR"
has real trade-offs (CI reproducibility, edit-loop ergonomics, blast
radius of upstream bumps) and there's no codified guidance.

The "extract to workspace package" trap is particularly seductive
because it looks structurally clean — but it splits the source from
where the skmtc bundler expects it, requires re-pointing the inner
`deno.json#imports`, and (most importantly) doesn't actually solve
the version-control problem any better than keeping it in place
would.

**Possible fixes:** unresolved — needs reflection. The skill could
add a §version-control-cloned-generators section comparing three
patterns: (a) make `.skmtc/` a tracked subdir of the consumer repo,
(b) make skmtc-root itself a git repo, (c) publish a fork to JSR.
Each has a different right answer depending on team size, edit
frequency, and whether the customisations are reusable.

**Version anchor:** `@skmtc/cli@0.3.7`, `@skmtc/core@0.6.2`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #4 — `args.*` emission pattern | Closes the whole class of #1-style bugs across any hook-emitting generator; another agent cloning a stock generator will recreate the shadowing trap without this codified | `skmtc-generator` skill — new §template-patterns or §emitting-hooks section with the pattern + `toPathTemplate(path, 'args')` link |
| 2 | K6 — `--typecheck` should be the default when integrating into a strict consumer | This entire session's debugging would have been front-loaded by one flag; the misleading `errors: 0` success report is the discoverability gap | `skmtc-cli` skill §10 "Setting up SKMTC" card — show `skmtc generate <project> --typecheck --json` as the integration step, not just `skmtc generate <project>` |
| 3 | #1-#3 collectively — stock `gen-tanstack-query-fetch-zod` ships with three live bugs | Affects every consumer that clones the JSR-published version; the bugs each have a 3-line fix at the template level | Upstream PR to `@skmtc/gen-tanstack-query-fetch-zod` with the three template fixes from this session, or fork-doc on the cloned generator's CLAUDE.md noting "stock is broken in these specific ways, here's what to apply" |
