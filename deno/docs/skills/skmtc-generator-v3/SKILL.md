---
name: skmtc-generator-v3
description: >
  Author and edit SKMTC generators — the packages that project an OpenAPI
  domain model into application code. Teaches the generation model first
  (three-phase pipeline, code as object trees, coordination by memoization,
  identity before construction), then the package anatomy and authoring
  recipes. Assumes ZERO prior SKMTC knowledge. Use when the user asks to
  "write a skmtc generator", "author a generator", "clone/customize gen-x",
  "add a field type", "change export paths", "add enrichment options", or
  edits generator source. ALWAYS pair with the lang skill for the target
  language (skmtc-lang-typescript-v3, skmtc-lang-kotlin-v3) — this skill
  carries the engine rules; the lang skill carries the concrete classes.
---

# Authoring SKMTC generators

## 1. What SKMTC is

SKMTC derives application code from a domain model. The input is an OpenAPI
v3 document — treated not as "API documentation" but as the domain model of
an application. The output is real application code: validation schemas,
types, API clients, server routes, UI components. The things that turn the
model into code are **generators** — small, opinionated, cloneable packages —
run as a **stack** by a deterministic engine.

Three consequences shape everything you will do here:

1. **Outputs are disposable; generators are the asset.** Every run regenerates
   the output wholesale. If the output isn't what you want, you customize the
   generator — you never hand-edit generated files. A "hardcoded" path or
   naming policy in a stock generator is the customization seam, not a bug.
2. **Division of labor.** You supply judgment: what the code should look like,
   how schema constructs map to language constructs. The engine supplies
   determinism: it sweeps every subject of the schema through every generator,
   settles imports, deduplicates shared definitions, and writes files. Your
   code is called once per subject; the engine does the bulk. This is why
   generators are small.
3. **Generators compose.** A React-Query generator reuses the Zod generator's
   schemas; a Spring generator reuses the kotlinx model generator's data
   classes. The engine coordinates them without a dependency graph — see §5.

## 2. The one law: your code never writes output text

The pipeline has three phases:

- **Parse** — the schema becomes a graph of `Oas*` objects (`OasOperation`,
  `OasObject`, `OasString`, `OasRef`, …).
- **Generate** — the only phase your code runs in. Generators build
  **descriptions of code** — trees of objects — and register them into files.
- **Render** — the engine calls `toString()` once per file. The whole object
  tree collapses into text here, and only here.

During generate, **the output text does not exist yet**. A projection under
construction is a live object tree; the engine can still see inside it —
walk it, attribute each node to its generator, settle the imports its nodes
declared, and reuse whole subtrees across generators.

### The trap you are prewired to fall into

Every code-generation tutorial you have absorbed says "codegen = template
strings." Agents new to SKMTC reliably reach for:

```ts
// WRONG — do not do this
return `import { z } from 'zod'
export const ${name} = z.object({ ${fields.join(', ')} })`
```

It compiles. It even renders. And it is the single most common way agents
fail in this codebase, because a string has already given up its structure.
The engine cannot see inside it, so every service the engine provides
silently stops working:

- **Imports break.** Snippets declare imports via `register` at construction;
  the engine merges and settles them into the file's import header. An import
  written inside a template lands in the *body* of the file, after the real
  import header, and bypasses deduplication. (This exact mistake has its own
  lint rule: `skmtc/no-template-imports`.)
- **Reuse breaks.** The definition cache stores object definitions keyed by
  identity. Text is invisible to it — so shared models get duplicated instead
  of referenced, and other generators cannot find yours.
- **Composition breaks.** A peer generator references your output through its
  identifier and export path. Inline text can't be referenced, imported, or
  re-exported.
- **Attribution breaks.** Every snippet node carries provenance (which
  generator built it, from which schema location). A string leaf where a
  snippet belongs silently drops out of the provenance map.

The failure is deferred: string output looks right on the happy path and
collapses on the first cross-file reference, shared model, or second
generator in the stack. That is why "it works" after a string-based edit is
not evidence — run the full stack and check the imports.

### The litmus test

Apply this at the keystroke, every time:

> **Am I typing the target language's punctuation (`{`, `=>`, `:`, `import`,
> `data class`, `fun`) into a string that will be STORED on an object?**
> If yes, stop — you are rendering by hand in a phase where rendered text
> does not exist. Build the object; let render do the rendering.

Strings are not banned — they are leaves. The precise rule:

- **Strings are legitimate for:** identifier names, export paths, module
  specifiers (`'zod'`, `'kotlinx.serialization'`), literal values, a cached
  *name* of a peer's definition, and final syntax assembled **inside a
  `toString()` body** from already-structured fields.
- **Objects are mandatory for:** anything stored on an instance and rendered
  later — the projection's `value`, every recursive child, parameter lists,
  accumulating lists, anything that must register an import or be found by
  another generator.

The mechanical enforcement already exists: `jsr:@skmtc/lint-plugin` ships
`skmtc/no-template-imports` (imports never in templates) and
`skmtc/no-adhoc-tostring` (no `{ toString: () => '…' }` object literals —
they have no context to register imports and no provenance). Stock
generators wire it in `deno.json`; keep it wired in yours.

## 3. The cast of concepts

- **Subject** — one unit of the schema a generator visits. Two kinds:
  a **model** (a named component schema, identified by its `refName`) and an
  **operation** (one `(path, method)` pair, an `OasOperation`).
- **Generator** — a package that visits subjects of one kind and produces
  code. Its `id` is its package name (e.g. `@skmtc/gen-zod`).
- **Projection** — the named, exported unit a generator produces for a
  subject: a class whose *constructor builds the value tree* and whose
  statics answer identity questions (§5). One subject → one projection
  instance → one definition in a file.
- **Snippet** — an anonymous fragment inside a projection's tree: an object
  with a `toString()`, a `context`, and provenance. Snippets compose;
  projections are the named roots.
- **Definition** — a projection (or any value) wrapped with an **Identifier**
  and placed in a file. The cache stores definitions.
- **Identifier** — the name plus its declaration kind (TypeScript: `variable`
  / `type` / `class` / `interface` / `namespace`; Kotlin: `data-class` /
  `enum-class` / `typealias` / …). The kind drives rendering (`const` vs
  `type`; head-form vs assignment-form) and, in TS, whether consumers import
  it type-only.
- **Export path** — where the definition lives, written with a leading `@/`
  root marker (e.g. `@/types/user.generated.ts`). The engine post-processes
  it (generated-suffix policy, user ejections) — your declared path is a
  request, not the final byte.
- **ContentSettings** — the identity bundle handed to every projection
  constructor: `{ identifier, exportPath, enrichments, variant }`.
- **File** — during generate, a live object holding maps of definitions,
  imports, and re-exports. Render turns each file into text once.
- **Enrichments** — per-subject / per-generator / per-stack configuration
  read from the project's `client.json`, validated by a schema the generator
  declares (§7).
- **Variant** — a named axis that lets one subject produce N definitions
  (default: the single variant `'main'`) (§8).

## 4. How the engine runs your code

**Generator-major sweep.** The engine takes each generator in the stack and
walks it across all its subjects before moving to the next generator. For
each `(subject, variant)` pair it calls your entry's `transform`:

```ts
transform({ context, refName, variant })    // model generators
transform({ context, operation, variant })  // operation generators
```

Errors are isolated per item: a throw inside a transform or projection
constructor kills one artifact and is recorded; the run continues.

**Identity before construction.** A projection's name and export path are
computed from statics on the class — `toIdentifierName`, `toIdentifierType`,
`toExportPath` — as pure-ish functions of `(subject, enrichments, variant)`,
*before and without* constructing the projection. This is the central
invariant: it is what lets the engine probe the cache cheaply, and what lets
generator B know where generator A's artifact *will* live without A having
run. Anything that would require constructing a projection to learn its name
breaks the model.

**Construction is the work.** On a cache miss the engine instantiates your
projection; the constructor builds the entire value tree (recursively
constructing referenced models as it goes), registers imports, and returns.
`toString()` — always a prototype method reading already-computed fields,
never doing work — runs later, at render.

**Registration at construction, rendering at render.** Never register from
inside `toString()`; never build the tree inside `toString()`.

## 5. Coordination is memoization, not a dependency graph

When a projection needs a definition that may already exist (its own
recursive refs, or another generator's output), the engine's Driver runs
this sequence:

1. Compute the target's identity from its projection's statics
   (name + exportPath). No construction yet.
2. **Cache probe**: `context.findDefinition({ name, exportPath })` — the
   cache *is* the file map; the key is `(identifier name, export path)`.
3. **Hit** → return the cached definition. The peer's constructor never runs.
   If the consumer's file differs from the peer's export path, the Driver
   registers the cross-file import for you automatically.
4. **Miss** → `new Projection(...)`: the peer's constructor runs, recursively
   building *its* tree, registering *its* definition into *its own* file.
   Construction is the recursion.
5. **Integrity**: if the cached definition was produced under a different
   generator key, the engine throws `Registered definition mismatch` — two
   generators collided on one name/path.

Consequences you must respect:

- **Never hardcode a peer's output name or path as a string.** Ask the
  machinery: `this.insertModel(PeerProjection, refName)` or
  `this.insertNormalizedModel(PeerProjection, { schema, fallbackName })`
  returns the peer's definition — read `.identifier.name` off the result.
  The peer package is an ordinary exact-pinned dependency in your
  `deno.json`, imported by its `@skmtc/gen-*` package name (never by
  relative path into a sibling package).
- **Never import a peer's naming helpers to compute its names yourself** —
  identity belongs to the peer's statics, resolved through the engine. If
  you need a peer's identity without materializing it, use
  `context.toModelContentSettings({ refName, projection: Peer, variant })`.
- **You never hand-write peer imports.** The Driver stitches them.
- Because the cache key includes the export path, two generators can both
  claim the name `User` in different files without conflict — and a zod
  `user` const and a TS `User` type coexist by name too.
- Insertion is filter-blind by design: `insertModel` materializes a peer's
  definition even if the user's filters skip that subject for direct
  generation — dependency edges always win.

Two composition shapes exist, both legitimate:

- **Projection shape** — one definition per subject; the entry calls
  `context.insertModel(Projection, refName)` or
  `context.insertOperation({ projection, operation, variant })`.
- **Accumulator shape** — many subjects append into one shared definition
  (an Express `app`, a Spring controller per tag, an MSW handler list). The
  entry does `context.findDefinition(...) ?? defineAndRegister(...)` to
  get-or-create the container, then calls a mutator on the container's value.
  Containers are the one sanctioned exception to "producers have no methods
  beyond constructor and toString".

## 6. Anatomy of a generator package

The universal three-file convention (every stock generator follows it):

```
gen-example/
  deno.json          # name @scope/gen-*, exact-version pins, lint plugin
  mod.ts             # re-exports + `export { entry as default }`
  src/
    mod.ts           # the entry config (default-exported via root mod.ts)
    base.ts          # identity statics via the lang veneer  ← ONE per package
    enrichments.ts   # the enrichment schema (or the empty schema)
    ExampleProjection.ts  # the projection: constructor builds the tree
    ...snippets, router...
```

**`deno.json`**: `@skmtc/*` dependencies are pinned to exact versions — no
carets, no ranges. Wire the lint plugin:
`"lint": { "plugins": ["jsr:@skmtc/lint-plugin@<version>"] }`.

**The entry** (`src/mod.ts`) is built by a core factory — `toModelEntry` or
`toOasOperationEntry` (webhook and GraphQL variants exist) — and is the
package's **default export**. Minimal model entry:

```ts
import { toModelEntry } from '@skmtc/core'
import denoJson from '../deno.json' with { type: 'json' }

export default toModelEntry<EnrichmentSchema>({
  id: denoJson.name,             // the package name IS the generator id
  toEnrichmentSchema,
  transform({ context, refName }) {
    context.insertModel(ExampleProjection, refName)
  }
})
```

Optional entry fields: `isSupported` (capability predicate — e.g. an
operation generator that only handles methods with request bodies),
`toPreviewModule`, `toEnrichmentDefaults`.

**The base** (`src/base.ts`) declares the target language and the identity
statics, via the lang package's projection-base factory (see the lang skill
for the exact factory names):

```ts
export const ExampleBase = toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toIdentifierName({ refName }) { ... },      // PURE — runs on the cache path
  toIdentifierType: () => ({ type: '...' }),  // may read context; miss-only
  toExportPath({ refName, enrichments, variant }) { ... },
  toEnrichmentSchema
})
```

`toExportPath` may call `this.toIdentifierName(...)` — the config object is
bound to itself. A generator package has exactly **one** base; variant
flavors are separate projection classes overriding statics, not second bases.

**The projection** extends the base; its constructor resolves the subject's
schema (`context.resolveSchemaRefOnce(refName, Base.id)` for models), routes
it through a schema-to-value function, and stores the resulting tree on
`this.value`. `toString()` is one interpolation: `` return `${this.value}` ``.

**The schema-to-value router** is the heart of a model generator: one
exhaustive dispatch over the schema union (`object`, `string`, `array`,
`ref`, `union`, `number`, `integer`, `boolean`, `void`, `unknown`, `custom`),
**every branch returning a snippet object, never a string**. "Add support
for a field type" = add or modify a router branch. The router is also what
makes your generator consumable by others: exposed as the static
`schemaToValueFn` (plus `createIdentifier`), it lets peers hand you inline
schemas via `insertNormalizedModel`.

## 7. Enrichments — the configuration seam

A generator declares what per-subject configuration it accepts as a valibot
schema shaped as the three-scope umbrella:

- `subject` — per item, routed by `[generatorId][refName][variant]` (models)
  or `[generatorId][path][method][variant]` (operations) in `client.json`.
- `generator` — one value for the whole generator (`[id]._generator`) — e.g.
  a required `basePackage` for Kotlin.
- `stack` — shared across all generators (`._stack`).

A no-configuration generator exports
`toEnrichmentSchema = () => emptyEnrichmentSchema` — the field is required
precisely so parsing stays cast-free. Read enrichments in the projection via
`this.settings.enrichments.subject?.…`; in entry callbacks via the
projection's static `toEnrichments({ refName|operation, context, variant })`.
Unread keys surface as warnings in the run result — enrichments are audited.

Enrichments are the *only* configuration channel: a bundled generator cannot
take constructor options, and module-level state breaks determinism.

## 8. Variants

A variant multiplies one subject into N definitions (e.g. one broad PATCH
endpoint driving several scoped edit forms). Variant names are the keys of
the subject's enrichment block; no enrichments → exactly one pass with
`variant: 'main'`. Rules that bite:

- **Thread the variant through your transform**:
  `context.insertOperation({ projection, operation, variant })`. Dropping it
  makes every variant construct as `'main'` and collide with a
  `Registered definition mismatch` on the second one.
- Variant-aware naming: fold the variant into `toIdentifierName` (core's
  `withVariant(base, variant)` appends a PascalCased suffix, nothing for
  `'main'`). Everything downstream (paths, keys, imports) inherits.
- Cross-generator inserts default to `'main'`; asking a peer for an
  undeclared variant throws.

## 9. Naming

- **Models**: derive from `refName` by case conversion (core exports
  `camelCase`, `capitalize`, `decapitalize`). A value gets a decapitalized
  name (`user`), a type a capitalized one (`User`).
- **Operations**: derive from **method + path** — core's
  `toEndpointName(operation)` gives `POST /users/{id}/profile` →
  `createApiUsersIdProfile` (via `toMethodVerb`: post→Create, put→Update).
  Siblings: `toResponseName`, `toArgsName`, `toEndpointType`.
- **Never derive names from `operationId`.** It is parsed and available, but
  no stock generator or core helper reads it: it is spec-author-controlled,
  emitter-dependent, and non-deterministic across schema sources. Method+path
  is deterministic. Diverging from this breaks the ecosystem's naming
  expectations.
- Sanitization of *emitted* identifiers is the lang layer's job (keywords,
  invalid characters) — see the lang skill; don't hand-roll it.

## 10. Working method — verify against the run, not your intention

Generation is cheap (a full stack runs in well under a second). Use that:
after every meaningful change, run the project's generate and read what
actually happened, in this order:

1. **The manifest / run result** — did your generator produce the expected
   definitions at the expected paths? Any parse issues or per-item errors?
2. **The artifact for one golden subject** — open the rendered file. Check
   the import header first (missing imports = a string swallowed a snippet,
   or a register never ran), then the definition body.
3. **`deno lint`** — the skmtc rules catch template-imports and ad-hoc
   toString objects mechanically.
4. **Cross-generator claims** — if you consume a peer, confirm the peer's
   definition exists once (not duplicated) and your file imports it.

If output is missing or wrong and the cause isn't obvious, stop and
diagnose before editing further (if a `skmtc-debug` skill is available,
switch to it). Do not "fix" by concatenating the missing text into a
template — that converts an engine signal into a hidden defect.

## 11. Pitfall table

| Symptom | Cause | Fix |
|---|---|---|
| Rendered file missing imports; import appears mid-file | Syntax written into a template string; import inside a template | Build snippet objects; declare imports via `register` (lint: `no-template-imports`) |
| Duplicate definitions of a shared model | Peer referenced by string name instead of through `insertModel` / the Driver | Reference via the peer's projection class |
| `Registered definition mismatch` | Variant not threaded, or two generators claiming one (name, path) | Thread `variant`; change one party's name or path policy |
| Peer generator's output has wrong name | Consumer computed the peer's name itself | Read `.identifier.name` off the insert result |
| Attribution/provenance holes | `{ toString: … }` object literal, or a string leaf replacing a snippet | Real snippet classes (lint: `no-adhoc-tostring`) |
| Works for one subject, breaks on recursion | Tree built in `toString()` instead of the constructor; or ref handled as text | Constructor builds; refs go through the ref snippet / Driver |
| Enrichment silently ignored | Key mismatch in the umbrella routing, or schema doesn't declare it | Check the `UNCONSUMED_ENRICHMENT` warnings; align schema + `client.json` |
| Change to output never appears | Editing generated files instead of the generator | Customize the generator; regenerate |

## 12. Division of labor with the lang skills

This skill is language-blind, as is the engine core: core never names a
concrete language class. Everything concrete — the projection-base factory
names, snippet base, `File`/`Import`/`Definition` classes, identifier
factories and entity kinds, the emitted language's import model, syntax
helpers, sanitization — lives in the target language's package and its
skill. Load `skmtc-lang-typescript-v3` or `skmtc-lang-kotlin-v3` (per the
generator's target) **before writing code**, and take your worked examples
from there. When the two skills seem to disagree, the lang skill wins on
language-layer specifics; this skill wins on engine semantics.
