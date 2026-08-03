---
name: skmtc-generator-v3
version: 0.2.2
description: >
  Author and edit SKMTC generators — packages that project an OpenAPI
  domain model into application code. Method: clone the nearest stock
  generator, then apply the engine rules imitation can't teach. Assumes
  zero prior SKMTC knowledge. Use when asked to "write a skmtc
  generator", "author/clone/customize gen-x", "add a field type",
  "change export paths", "add enrichment options", or when editing
  generator source. ALWAYS pair with the target language's skill
  (skmtc-lang-typescript-v3, skmtc-lang-kotlin-v3).
---

# Authoring SKMTC generators

## 1. What SKMTC is

SKMTC derives application code from an OpenAPI document treated as a
domain model. A **stack** of **generators** (small, opinionated,
cloneable packages) is run by a deterministic engine that sweeps every
subject of the schema — each **model** (component schema, by `refName`)
and each **operation** (`path` + `method`) — through each generator.
Outputs are regenerated wholesale every run: never hand-edit generated
files; customize the generator. Generators compose: a React-Query
generator reuses the Zod generator's schemas through the engine's cache.

## 2. The method: start from a stock generator

The fastest reliable route to a correct generator is imitation of a
published one — clone the structure, swap the target syntax. Pick the
nearest exemplar:

| Need | Clone |
|---|---|
| model → validator/schema value | load **skmtc-model-v3** and copy its engine-tested skeleton (fill-in slots; gen-zod is its pattern source) |
| model → type declaration | `@skmtc/gen-typescript` |
| operation → client hook, consuming a model generator | `@skmtc/gen-tanstack-query-fetch-zod` |
| many subjects → one shared file (accumulator) | `@skmtc/gen-msw`, `@skmtc/gen-express` |
| Kotlin | structure from `gen-kotlin-*`, but their lang-API call shapes are STALE — take call shapes from skmtc-lang-kotlin-v3 only |

Fetch source from JSR: `https://jsr.io/@skmtc/<name>/meta.json` → pick
version → fetch files (or `deno doc jsr:@skmtc/<name>`). Keep the
package convention exactly as cloned:

```
gen-x/  deno.json (name @scope/gen-*, EXACT-version @skmtc/* pins,
        lint plugin jsr:@skmtc/lint-plugin)
        mod.ts            → re-exports + `export { entry as default }`
        src/mod.ts        → the entry: toModelEntry / toOasOperationEntry
        src/base.ts       → identity statics via the lang base factory
        src/enrichments.ts→ enrichment schema (emptyEnrichmentSchema opt-out)
        src/XProjection.ts→ constructor builds the value tree
        src/<router>.ts   → schema-type → snippet dispatch
```

What you adapt: the identity policy in `base.ts` (names, export paths,
identifier kind) and the router's per-type snippets (your target
syntax). What you keep: everything else — the shape is the point.

## 3. The one law: your code never writes output text

Three phases: parse → **generate** (your code runs here) → render
(`toString()` runs once per file, only here). During generate the output
does not exist; your generator builds **object trees** the engine can
walk, attribute, deduplicate, and settle imports from.

**The trap**: template strings full of target syntax
(`` `export const ${name} = ...` ``) compile, render — and silently break
imports (never settled into the header), reuse (text is invisible to the
cache → duplicates), composition (peers can't reference text), and
provenance. Lint rules `skmtc/no-template-imports` and
`skmtc/no-adhoc-tostring` catch the worst mechanically; keep them wired.

**Litmus, applied at the keystroke**: target-language punctuation inside
a string that will be STORED on an object → stop, build the object.
Strings are legitimate as *leaves*: identifier names, export paths,
module specifiers, literals, a cached peer *name*, and final syntax
assembled **inside a `toString()` body** from already-structured fields.
Prefer composing even render-time syntax inside `toString()` over helper
functions that return strings — helpers drift.

## 4. What imitation can't teach: the engine rules

- **Identity before construction.** `toIdentifierName` / `toIdentifierType`
  / `toExportPath` are statics computed from `(subject, enrichments,
  variant)` WITHOUT constructing the projection. This is the invariant
  everything rests on: cheap cache probes, and peers knowing where your
  artifact *will* live. Never make a name depend on construction.
- **Coordination is memoization.** The cache is the file map, keyed
  `(identifier.name, exportPath)`. On a peer reference the Driver probes
  `findDefinition`; hit → reuse (constructor never runs) + auto-stitched
  import; miss → construct recursively. So: never hardcode a peer's name
  or path — insert and read the result, minding the two return shapes:
  `insertModel(Peer, refName)` returns an **Inserted handle** (name via
  `.toName()`, definition via `.definition`), while
  `insertNormalizedModel(Peer, { schema, fallbackName })` returns the
  **definition itself** (name via `.identifier.name`). Never hand-write
  peer imports; never import a peer's naming helpers (ask
  `context.toModelContentSettings` if you need identity without
  materializing). Key collision under different generators throws
  `Registered definition mismatch`.
- **Two composition shapes.** Projection (one definition per subject —
  entry calls `insertModel`/`insertOperation`) and accumulator (many
  subjects append into one definition — entry does
  `context.findDefinition(...) ?? defineAndRegister(context, {...})`
  then mutates the container value; the sanctioned exception to "no
  methods beyond constructor and toString"). `defineAndRegister` is a
  **lang-package free function** (import it from your lang package) —
  there is no `context.defineAndRegister`; that API was deleted.
- **When in doubt, make it a producer.** The cost asymmetry is one-way:
  a producer that never needed to be one costs a few lines; a string
  that later needed to be a producer severs the chain for everything
  built on it. Assume your value will be built upon.
- **Thread the variant.** `transform({ context, operation, variant })` →
  pass `variant` through to `insertOperation`, and fold it into names
  with `withVariant`. Dropping it collides every variant onto `'main'`.
- **Enrichments are the only config channel** (bundled generators take
  no options; module state breaks determinism). Declare a valibot
  three-scope umbrella (`subject`/`generator`/`stack`); the opt-out is
  `export const toEnrichmentSchema = () => emptyEnrichmentSchema` — a
  FUNCTION returning the schema, required in both the entry config and
  the base-factory config. Read via
  `this.settings.enrichments.subject?...`; unread keys surface as
  warnings.
- **Naming**: models from `refName` casing (core's `camelCase`,
  `capitalize`, `decapitalize`); operations from **method + path** via
  core's `toEndpointName` (post→Create, put→Update). **Never**
  `operationId` — spec-author-controlled; no stock generator reads it.
- **Registration at construction; `toString()` is a prototype method**
  reading precomputed fields (an arrow-function `toString` field breaks
  provenance wrapping). Errors are isolated per subject — a throw kills
  one artifact, not the run.

## 5. Verify against the run

**Never guess a signature.** SKMTC has almost no training-data presence;
your recalled API shapes are unreliable. Exact signatures for core
contracts (`Oas*` classes, `Inserted`, `ContentSettings`,
`TypeSystemArgs`, entry configs) are one command away:
`deno doc jsr:@skmtc/core@<pinned-version> <SymbolName>` — read it
instead of guessing, and instead of casting around a type error.

Generation is sub-second — run it after every meaningful change. Read in
order: (1) manifest — expected definitions at expected paths? parse
issues? per-item errors? (2) one golden artifact — **import header
first** (missing import = a string swallowed a snippet), then the body;
(3) `deno lint`; (4) if you consume a peer: their definition exists once
and your file imports it. Never "fix" missing output by concatenating
the text into a template.

## 6. Pitfalls

| Symptom | Fix |
|---|---|
| Import missing / appears mid-file | Declare via `register`, never in templates |
| Duplicate definitions of a shared model | Reference peers via `insertModel`, not by name |
| `Registered definition mismatch` | Thread `variant`; or two generators claim one (name, path) |
| Peer output name wrong | Read `.identifier.name` off the insert result |
| Works once, breaks on recursion/refs | Build tree in constructor; refs via the ref snippet/Driver |
| Enrichment ignored | Umbrella routing key mismatch — check warnings |
| Output edits vanish | You edited generated files; customize the generator |
| Router misroutes custom values | `schema.type === 'custom'` is a real dispatch case — presence-test with `'readOnly' in schema`-style guards, not type equality |
| `null` slips through an optional guard | `!== undefined` lets `null` pass on Nullable generics — check both |
| `insertResult.identifier` is a type error | You have an `Inserted` handle (from `insertModel`) — use `.toName()`/`.definition`; only `insertNormalizedModel` returns the definition |

## 7. The lang layer

Everything concrete — base-factory names, snippet classes,
File/Import/Definition, identifier factories, emitted-language import
rules, sanitization — lives in the target language's package and skill.
Load `skmtc-lang-typescript-v3` or `skmtc-lang-kotlin-v3` before writing
code. Lang skill wins on language specifics; this skill wins on engine
semantics. Model generators additionally have a SHAPE skill —
`skmtc-model-v3` — carrying the fill-in skeleton and the model edge
cases (refs, recursion, visibility); model-specific guidance lives
there, not here.

Scope note: this skill covers **OpenAPI input**. GraphQL SDL input
exists (`toGqlOperationEntry`, subject routing by
`[rootKind][fieldName]`) — for GraphQL authoring load the
`skmtc-graphql` skill alongside; the engine rules here apply unchanged.
