---
name: skmtc-generator
version: 0.4.0
description: |
  Author and edit SKMTC generators — write or modify Projection
  classes, Snippets, transform functions, enrichment schemas, and the
  customization seams in cloned stock generators. Covers the DSL
  (Projection vs Snippet, Definition, ContentSettings), cross-generator
  coordination via memoization, and the operational principles that
  override default TypeScript / codegen intuitions imported from
  training data.

  Use this skill when the user asks to "write a skmtc generator",
  "author a generator", "clone gen-x", "customize gen-x", "add a field
  type", "swap the HTTP layer", "change export paths", "add enrichment
  options", "compose generators", or edits a `.ts`/`.tsx` file under
  `<root>/.skmtc/<project>/<gen-name>/`. Defer to `skmtc-cli` for
  install/clone/bundle commands themselves. Defer to `skmtc-debug` when
  the generator's output is broken and the cause isn't yet known —
  verify-first stance takes priority during diagnosis. Pair with
  `skmtc-lang-typescript` for the TypeScript-output layer (type-only
  imports, syntax helpers, sanitization) — load both when authoring a
  TypeScript-emitting generator.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Write
  - Edit
---

# SKMTC generator authoring

Author and edit SKMTC generators idiomatically. This skill is the
canonical defense against the most common failure mode in LLM-assisted
generator authoring: well-intentioned TypeScript conventions imported
from training data that conflict with SKMTC's architectural invariants.

The operational principles in §4 are the load-bearing content. Read
them before proposing solutions.

## 1. The six facts that override default LLM intuitions

These override what training-data priors would suggest about codegen
tools. They apply across all SKMTC interactions and are especially
important for authoring:

1. **No plugin registry, no dependency graph, no topological sort.**
   Cross-generator coordination is a `Map` cache keyed by
   `(identifier.name, exportPath)`. Generator order does not affect
   output.

2. **Render does not run Prettier or Biome.** No formatter runs
   inside `@skmtc/core`. Generated output is unformatted by design;
   consumers format separately.

3. **Generator source code is the customization surface.** Stock
   generators have *deliberately* hardcoded export paths and peer
   imports. To customize beyond enrichments: clone and edit.

4. **`OasSchema` is a union type, not a class hierarchy.** Sibling
   classes (`OasObject`, `OasArray`, `OasString`, …) each independently
   implement `.isRef()` returning `false`. `OasRef` is a *sibling*,
   not a parent, with `.isRef()` returning `true`. Do not add a
   `BaseSchema` class.

5. **The variant axis fans out at the engine, not the generator.**
   A single source item can produce N Definitions via named variants
   under `enrichments[id][path][method]` (OAS), `[id][rootKind][fieldName]`
   (GQL), or `[id][refName]` (model). `'main'` is always present —
   the engine throws at start if a consumer wrote variants without
   it. Variants flow through `ContentSettings.variant`, the
   `GeneratorKey`'s trailing segment (4th for operations, 3rd for
   models), and the per-call `variant` arg in every static method
   (`toIdentifierName`, `toExportPath`, `toEnrichments`) and every entry
   callback (`transform`, `isSupported`, `toPreviewModule`,
   `toMappingModule`). Cross-gen `insertOperation` / `insertModel`
   defaults to `'main'`; passing a non-`'main'` variant the peer
   doesn't declare throws at the Driver
   (`assertPeerVariantExists`).
   <br>See: [`concepts/variants.md`](../../concepts/variants.md);
   enforcement tests are listed in §12.

6. **The engine is language-blind; the import graph declares the
   language.** A generator imports its projection-base factories and
   snippet base from its language package (e.g. `toTsModelProjectionBase` /
   `TsSnippet` from `@skmtc/lang-typescript`) — language enters the DSL
   class hierarchy at the lang package's snippet base, and Drivers read
   it off the projection class's inherited static. Entries
   (`toOasOperationEntry` / `toGqlOperationEntry` / `toModelEntry`) are
   pure pipeline config and carry **no `lang` field**; `register` passes
   plain data. The lang package owns the concrete `File` / `Import` /
   `Definition` subclasses, the register ergonomics, **the identifier
   factories (`createVariable` / `createType`), the TS syntax helpers
   (`List`, …), and `sanitizePropertyName`** (all moved out of core —
   F5/F6, landed; core's `Identifier` is neutral data, `EntityType` is
   gone). For TypeScript-output specifics, load the
   `skmtc-lang-typescript` skill. Other language layers (Kotlin, C#, …)
   are pre-alpha and have no skills yet — read their lang package
   source directly.

## 2. The DSL: Projection vs Snippet

Both descend from `SnippetBase` (`core/dsl/SnippetBase.ts`). The
differentiator: **does it have a name at file scope?**

| | Projection | Snippet |
|---|---|---|
| Base class | A class built by the lang package's projection-base veneers (`toTsModelProjectionBase`, `toTsOasOperationProjectionBase`, `toTsGqlOperationProjectionBase` from `@skmtc/lang-typescript`) | `TsSnippet` (the lang snippet base) when it registers; `SnippetBase` directly for pure value fragments |
| Static methods required | `id`, `toIdentifierName`, `toIdentifierType`, `toExportPath`, `toEnrichmentSchema` (`toEnrichments` is derived by the factory) | None |
| Instance has | `settings: ContentSettings` (identifier + exportPath + enrichments + variant) | `context`, optional `generatorKey` / `stackTrail` (attribution), `register()` (from `TsSnippet`) |
| Wrapped in `Definition` | Yes (by Driver) | No |
| Cached by | `(identifier.name, exportPath)` | Not cached |
| File-level export | Yes (`export const X = ...`) | No (embedded via `${...}`) |
| Reachable by other generators | Yes (via `insertOperation(MyProjection, op)`) | No |
| Examples in stock | `ShadcnForm`, `TanstackQuery`, `ZodProjection`, `TsProjection` | `FormFields`, `StringInput`, `SelectInput`, `CustomValue`, `Identifier` |

`Definition` extends `SnippetBase` — it's the wrapper that makes a
Projection's value exportable. Drivers create `Definition`s
automatically.

### When to write which

- **Other generators may reach for it by name** → Projection
- **Needs file-scope export** → Projection
- **Fragment embedded in someone else's output (JSX child, function
  body, expression)** → Snippet
- **Unsure** → Probably Snippet. Promote to Projection only when
  cross-file identity is needed.

### The constructor / `toString()` contract

For both Projections and Snippets:

- **The constructor runs at most once per cache key** — when the
  Driver gets a cache miss for `(identifier.name, exportPath)`.
  Subsequent calls hit the cache. Side effects (`this.register(...)`,
  `this.insertOperation(...)`) belong here.
- **`toString()` may run multiple times** — at minimum during Render,
  potentially again during preview generation or integrity checks.
  It must be a **pure function of `this`**: no mutation, no
  side effects, deterministic output for the fields set in the
  constructor.

Two things this implies in practice:

1. Cache anything expensive on `this` from the constructor; don't
   recompute in `toString()`.
2. Don't call `register` from `toString()` — by then Render has
   finalised the file's imports.

### `Stringable` and `ContentSettings` (the type vocabulary)

- **`Stringable`** — anything with a `.toString()`. The composition
  contract: a field typed `Stringable` accepts strings, Snippets,
  Definitions, `Identifier`s, and inserted handles interchangeably.
- **`ContentSettings<E>`** — the `(identifier, exportPath,
  enrichments, variant)` bundle the Driver computes from a
  Projection's static methods; available as `this.settings`.

## 3. Cross-generator coordination

**Mechanism: memoization keyed by `(identifier.name, exportPath)`.**
Both are pure functions of `(operation, enrichments)` computed by the
Projection class's static methods. Same inputs → same key → cached
value reused. Generator execution order does not affect output.

The flow when `MyProjection.constructor` calls
`this.insertOperation(OtherProjection, operation)`:

1. The projection base's `insertOperation` (built by
   `toOasOperationProjectionBase`) auto-fills `destinationPath` from
   `this.settings.exportPath`.
2. Delegates to `context.insertOperation`, which constructs
   `new OasOperationDriver(...)`.
3. Driver computes `settings` via `OtherProjection.toIdentifierName(...)`
   / `OtherProjection.toIdentifierType(...)` and
   `OtherProjection.toExportPath(...)`.
4. `context.findDefinition({ name, exportPath })` cache lookup:
   - **Hit + `affirmDefinition` passes**: returns cached `Definition`.
   - **Hit + `generatorKey` mismatch**: throws `"Registered definition
     mismatch"`.
   - **Miss**: `new OtherProjection(...)` runs (possibly with its own
     recursive `insertOperation` calls); the result is wrapped in
     `Definition` and registered.
5. If `exportPath !== destinationPath`, the driver also registers an
   import in the calling file pointing at `OtherProjection`'s output.

**You compose by calling, not by importing.** Other generators are
referenced by their Projection class — `this.insertOperation(Other,
op).toName()` returns the identifier name you can use in your
template. You never read another generator's `toString()`.

### Which helper for which job?

`register` is the underlying primitive; for cross-generator
composition prefer the high-level helpers. Defaulting to `register`
directly bypasses dedup and auto-import-registration.

| Situation | Use |
|---|---|
| Bring in another generator's output for a named ref in `components.schemas` | `context.insertModel(PeerProjection, ref)` |
| Bring in another generator's output for a schema that may be inline or a ref | `this.insertNormalizedModel(PeerProjection, { schema, fallbackName })` (auto-fills `destinationPath`) |
| Trigger another *operation* generator (e.g., a query hook, a select component) | `this.insertOperation(PeerProjection, op)` or `context.insertOperation({ projection, operation, destinationPath })` from a Snippet |
| Look up a Definition without triggering construction | `context.findDefinition({ name, exportPath })` |
| Add a sibling Definition in a file you already own (a type alias, a constant) | `defineAndRegister(context, { identifier, value, destinationPath })` — the **function** imported from `@skmtc/lang-typescript`; works from transforms and Projection constructors alike (`this.defineAndRegister` does not type-check on factory-built projections — lang-base members are type-erased) |
| Register a library import (npm package, hand-written helper) from a **Projection** | `this.register({ imports: { 'pkg': ['Symbol'] } })` — own-file only; always lands in `this.settings.exportPath` (the args take no `destinationPath`) |
| Write imports/definitions into a file the Projection does **not** own (shared demo, scratch file) | `this.registerInto(destinationPath, { imports })` — the explicit cross-file path. There is deliberately no `destinationPath ?? exportPath` fallback: own-file and cross-file are separate, loud paths |
| Register a library import from a **Snippet** | `this.register({ imports: { 'pkg': ['Symbol'] }, destinationPath })` — the parent passes `destinationPath` through the constructor; registers are **keyless** (`generatorKey` is optional attribution input only) |
| Register an import for a peer-generator output | **Don't** — `insertOperation`/`insertNormalizedModel` already did this for you |

The helpers wrap **Driver** classes (`ModelDriver`,
`OasOperationDriver`, `GqlOperationDriver`) that bake in idempotency
and auto-import-registration. Calling `register` directly for
peer-generator output skips both — duplicate Definition registration,
missing import, or a "Registered definition mismatch" if you got the
cache key wrong.

### Variant threading on `insertOperation`

`context.insertOperation({ projection, operation, variant? })`
defaults to `'main'` — the variant every peer honours. Pass a
non-`'main'` variant only when the peer declares it AND you want the
peer's per-variant Definition; an undeclared variant throws at the
Driver (`assertPeerVariantExists`) with the available variants listed.
Two variants of the same Projection calling
`this.insertOperation(VariantsUnawarePeer, op)` (no variant arg) share
the peer's `'main'` Definition — the standard pattern when composing
with variants-unaware peers like `gen-typescript` / `gen-zod`. Full
treatment: §10 "Authoring a variants-aware generator"; test:
`core/context/GenerateContext.cross-variant.test.ts`.

### `insertOperation` / `insertModel` enforce the peer's `isSupported`

Cross-generator `insertOperation` (and the model-side `insertModel`)
deliberately **bypasses the peer's `skip` / `include`** config
(dependency edges are filter-blind) but **does** enforce the peer's
static `isSupported`: an unsupported operation/model throws at the
Driver (`assertPeerSupported`), the calling generator's item is
recorded as `error`, and the run continues — loud, isolated failure
beats a silently-broken Definition. The static the Driver probes is the
one on the peer's **projection base** (`base.ts` config field); a peer
without one is treated as supporting everything. The operation static
gets `{ operation, context }`; the model static gets `{ refName,
context }`. Tests: `OasOperationDriver.test.ts` /
`ModelDriver.test.ts` → "Peer support validation".

## 3.5. The operation-reference protocol

The pattern above (`this.insertOperation(KnownPeer, op)`) covers
*statically-known* peers — your generator imports the peer's
Projection class and hands it a specific operation. The
**operation-reference protocol** handles the harder case: your
generator's output for one operation depends on the existence of
*some other operation* whose identity the consumer specifies as a
string in their enrichment.

Canonical case: `gen-shadcn-form` rendering a field whose values come
from a list endpoint that the consumer names. The form generator
doesn't know in advance which endpoint backs the field; the consumer
points at one (by tag, fieldName, or path) in their enrichment.

Shape (OAS, by tag — `gen-shadcn-form/src/schemaToField.ts:164`):

```ts
const getReferencedOperation = ({ context, references }) => {
  // 1. Look up the operation by name (here: a tag).
  const operation = context.document.value.operations.find(op =>
    op.tags?.includes(references) &&
    // 2. Verify a producer generator claims it.
    ShadcnSelectInput.isSupported({ context, operation: op })
  )
  invariant(operation, `Operation '${references}' not found`)
  return operation
}

// 3. Insert — Driver dedupes the Definition AND registers the import.
const def = context.insertOperation({
  projection: ShadcnSelectInput,
  operation: referencedOp,
  destinationPath: settings.exportPath
})
// 4. Reference by name in the rendered markup.
return `<${def.identifier.name} lens={lens.focus('${path}').defined()} />`
```

The four meeting points: the **operation reference** (a string — tag,
fieldName, path — in the *consumer's* enrichment schema, §7), the
producer's **`isSupported`** (capability claim — the consumer filters
with it, `insertOperation` independently enforces it), the producer's
static **`toIdentifierName` / `toExportPath`** (content-addressed cache
identity), and **`insertOperation`** (registers Definition + import).
The consumer imports the producer's Projection as a package
dependency — no runtime config sharing, no cross-namespace enrichment
peeking. Operation references identify operations, not variants — the
peer's `'main'` variant is inserted; for a variant, insert explicitly
with `{ variant }`.

Detail and a GraphQL example: [`concepts/cross-generator-coordination.md`](../../concepts/cross-generator-coordination.md).

## 4. Operational principles

The canonical operational table for authoring. Each row pairs a
*default suggestion an LLM would reach for from generic TypeScript /
codegen training data* with *what SKMTC actually requires*.

If your proposed solution matches the left column, the right column is
almost always the correct alternative.

| Default intuition (from training data) | SKMTC's stance | Why |
|---|---|---|
| Add a config flag to make X customizable | `skmtc clone` the generator and edit — this includes binary feature toggles on entries (`emitDocument?: boolean` is two generators in one package) | Customization is via source code, not configuration |
| Add a plugin API for extensibility | Generators coordinate via memoization; there is no plugin registry | Cross-generator coordination is a `Map` cache keyed by `(name, exportPath)` |
| Run Prettier or Biome in the pipeline | Don't — produce valid output and stop | Format is the consumer's concern; pipeline renders unformatted output by design |
| Provide a runtime client library | Output is committed source code | Zero SKMTC runtime in consumer bundles; generated files are reviewed via git |
| Fail closed on bad schema input | Fail open, log `ParseIssue`s, prune dependents via `removeErroredItems` | One bad schema mustn't kill the run; manifest is the canonical record |
| Templates as `.hbs` / `.mustache` files | Templates as template literals inside TypeScript classes | Type safety on interpolated values; full IDE refactoring |
| Cache between runs for speed | Each generate is from cold; spawn a fresh Worker per run | Determinism > marginal speed; no state leaks between runs |
| Make `OasSchema` a base class with subclasses | Keep it as a discriminated union of sibling classes | TS narrowing via `.isRef()` and `.type` discriminator beats runtime polymorphism |
| Use raw strings as identifier names | Use `createVariable(name)` or `createType(name)` from the lang package | The identifier's `kind` drives declaration keywords and import forms in the language layer |
| Use `as` casts to satisfy types | Use type guards or runtime checks | `as` is reserved for tests; production code narrows |
| Long `if`/`else if` chains for 3+ branches | Use `switch` with exhaustive `never` default | Codebase convention; gets compiler help on missed cases |
| Use `process.env.X` | Use `Deno.env.get('X')` | Deno codebase; engine runs in Deno workers |
| Concatenate strings to build output | Template-literal interpolation with `${...}` | Composes with any `Stringable`; preserves Snippet recursion |
| Add defensive `if (!already-registered)` around `register` calls | Just call `register` | Already idempotent via Set / Map semantics |
| Mutate `this` inside `toString()` | Set state in the constructor; `toString()` must be pure | May be called multiple times (previews, integrity checks) |
| Read another generator's rendered source | Coordinate by *identifier name*, not source text | Use `insertOperation(Other, op).toName()` |
| Return content from `transform({ context, operation })` | Use `register({ definitions, ... })` or `insertOperation` | `transform` returns `void` — the engine ignores any return; output flows through registration only |
| Write `import` statements inside template literals | Register imports via `this.register({ imports })` (own file) or `this.registerInto(path, { imports })` (cross-file) | Bypasses dedup; lands inside file body not header |
| Give a Projection custom constructor args | Projections receive a fixed `{ context, operation/refName, settings }` from the Driver — re-resolve dependencies inside the constructor | The Driver never passes custom args; the memoization cache makes re-resolution free, so self-contained Projections cost nothing |
| Reference a peer via its statics: `Peer.toIdentifierName(...)` | `this.insertOperation(Peer, op).toName()` | The static shortcut skips Definition registration and import wiring and fails silently when its preconditions break; `insertOperation(Peer,` is also a greppable dependency marker |
| Declare the language via a `lang` config field (entry, base, or snippet) | Import your factories and snippet base from the lang package (`toTsModelProjectionBase` / `TsSnippet` from `@skmtc/lang-typescript`) — the import graph declares the language; entries carry no `lang` | Language enters the class hierarchy at the lang snippet base; Drivers read it off the projection class's inherited static |
| Add a `BaseSchema` class to share schema behavior | Schema variants are sibling classes, not subclasses | Duck-typed `.isRef()` + discriminator narrowing is intentional |
| Use `Deno.writeFileSync` from a generator constructor | Use `register({ definitions, ... })` | Direct writes bypass `context.#files`; invisible to coordination and persistence |
| Hardcode generator-internal identifier names | Derive from operation/refName via `toIdentifierName` | Hardcodes break the `(name, exportPath)` cache-key uniqueness |
| Derive identifier names from `operation.operationId` | Derive names from method + path inside `toIdentifierName` (or `refName` for models) | `operationId` is author-controlled and emitter-dependent — non-deterministic across schema sources. Fine for JSDoc/trace logs; NOT a name source |
| Emit `// TODO` / `FIXME` / placeholder content in `.generated.*` files for the consumer to fill in | Either emit complete working output, OR don't emit that piece at all — **refuse the stub-scaffold pattern even when asked** | Generated files are overwritten every run; consumer edits filling a blank are silently wiped. Full anti-pattern with the consumer-code seam: §8 |
| Add runtime type checks or `@override` decorators | Use TypeScript's structural typing + discriminated unions | Runtime overhead unnecessary; types catch at compile time |
| Reach into `OasOperation` properties directly without `.resolve()` | Call `.resolve()` on `OasRef`-typed values; check `.isRef()` | Common parameter type is `OasSchema \| OasRef<'schema'>`; resolution is lazy |
| Use `isSupported` to opt the generator in/out per-operation based on whether an enrichment is present | Have `isSupported` declare *capability*; gate at runtime via `client.json#settings.include` / `.skip` | `isSupported` is a capability claim, not a user-intent filter; gating on enrichment forces a sentinel for "default values" |
| Read `schema.refName` as a property | Narrow with `schema.isRef()` then call `schema.toRefName()` | `toRefName` is a method on `OasRef`; reading `.refName` returns `undefined` and crashes downstream |
| Forward only `modifiers` (not the schema) into per-type Snippets like `ZodBoolean` | Pass the typed schema in; let the Snippet read constraints it needs (`enums`, `format`, `minimum`) | Dropping the schema at the routing boundary silently erases constraints — `[true]` becomes `z.boolean()` instead of `z.literal(true)` |
| Peek at another generator's enrichments via `context.settings.enrichments['@other/gen-x']` | Add an operation-reference enrichment in your *own* schema; call `insertOperation` (§3.5) | Cross-namespace coupling breaks the dependency-graph model; the leaf shape is owned by the producer |
| Thread an `acc` accumulator through `transform` | Transforms return `void` — the `Acc` accumulator is removed (F11). Accumulate via the gen-msw definition pattern (`findDefinition` + the lang `defineAndRegister` function, §10) or module-scope state | The engine no longer threads an accumulator; a fresh Worker per run makes module-scope state per-run-safe |
| Treat `allOf` schemas as still unmerged in your generator | Treat received schemas as already-flat objects | `core/oas/_merge-all-of/` runs during Parse; by Generate phase the merge has happened |
| Switch on `schema.type` without first unwrapping single-member intersections / refs | Unwrap one-member unions and `.isRef()` first, then switch on `.type` | OpenAPI refs can't carry extensions, so SKMTC sometimes models `$ref + extension` as a 1-member union; missing the unwrap loses the schema |
| Auto-inherit `this.settings.variant` when calling `this.insertOperation(Peer, op)` | Default to `'main'`; pass `{ variant: this.settings.variant }` only when you deliberately want the peer to be variant-bound | Peers are variants-unaware by default; auto-inherit forces every peer to honour every caller's variant — the Driver throws on mismatch (`assertPeerVariantExists`). See `core/dsl/operation/oas/OasOperationDriver.test.ts` → "Variant validation" |
| Variants-aware `toIdentifierName` ignores `variant` | Fold `variant` into the returned name (typically via `withVariant`) | `(name, exportPath)` is the cache key. Two variants producing the same name hit the cached Definition on variant 2; the Driver's `generatorKey` integrity check fires `"Registered definition mismatch"`. See `core/context/GenerateContext.end-to-end.test.ts` + `OasOperationDriver.test.ts` → "forgets to vary toIdentifier collides on second variant" |

TypeScript-output-specific principles (type-only imports / TS1484,
syntax helpers, `sanitizePropertyName`) moved to the
`skmtc-lang-typescript` skill — load it alongside this one when the
generator emits TypeScript.

Full discussion of each principle: [`../../explanation/design-philosophy.md`](../../explanation/design-philosophy.md).
Code-level instances and failure modes: §8 (Anti-patterns) below.

## 5. Decision trees

### Should I clone or install a generator?

```
Need to change identifier naming, export paths, peer deps, or output shape?
├── No  → install
└── Yes → clone, then edit src/base.ts or src/<Main>.ts
```

No config flags exist for paths or output shape. Clone is the answer.

> **Peer generators almost always = install.** If your generator
> composes with a peer via `insertOperation(PeerProjection, …)` or
> `insertNormalizedModel(PeerProjection, …)`, you reference the peer
> by its Projection's name — you do not edit its source. Install it
> (`skmtc install lab @skmtc/gen-typescript`) so it's a workspace
> dependency, then `import { TsProjection } from "@skmtc/gen-typescript"`
> in your generator. Cloning a peer just to "understand" its
> implementation is wasted work — its public API is `ItsProjection`,
> documented in its `reference/stock-generators/<pkg>.md` entry. The
> only generator you should ever clone is the ONE whose customization
> seams you'll actually edit; everything else you compose with should
> be installed.

### Should this be a Projection or a Snippet?

```
Need its own name at file scope (export const X = ...)?
├── Yes → Projection (extends a lang projection base, has static toIdentifierName/toIdentifierType/toExportPath)
└── No  → Snippet   (extends TsSnippet — or SnippetBase if it never registers —
                     anonymous, embedded via ${this.x})
```

If unsure: probably Snippet. Promote later if cross-file identity is
needed.

### Where should generated string content go?

```
Final output text?       → SnippetBase descendant's toString() (template literal with ${...})
Import (own file)?        → this.register({ imports: { module: [names] } })
Import (another file)?    → this.registerInto(destinationPath, { imports }) — or, from a
                            Snippet, this.register({ imports, destinationPath })
Identifier name?          → createVariable(name) or createType(name) (from @skmtc/lang-typescript)
File path?                → join('@', ...) from @std/path
TS fragment not in OAS?   → new CustomValue({ context, value: '...' })
```

### Why is my generator's output empty?

```
1. transform being called?              → Check the manifest
2. isSupported rejecting?               → Check the gate predicate
3. skip/include filters excluding?      → Check .settings/client.json
4. transform returning instead of registering?
                                        → Return value is discarded; must use register
5. Schema shape wrong for the gate?     → e.g., gen-shadcn-form needs request body type === 'object'
6. Engine threw "must include a 'main' variant"?
                                        → Consumer wrote variants without 'main';
                                          either add `main: {}` or remove variants
```

For deeper "why broken" diagnosis, switch to `skmtc-debug`.

## 6. Code scaffolds

Concrete templates to adapt. Each scaffold is a starting point — copy
and modify the marked extension points.

### A. `base.ts` — Projection base factory

```ts
// gen-x/src/base.ts
import {
  capitalize,
  camelCase,
  toMethodVerb,
  withVariant  // only needed for variants-aware generators
} from '@skmtc/core'
// ⬇ The factory comes from the LANG package — this import is what
//   declares the generator's target language (no `lang` config field
//   exists anywhere).
import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const MyGenBase = toTsOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  // ⬇ Customize: how is the generated identifier NAME derived? Returns a
  //   plain `string` — this is the cache-key half (runs on the cache-check
  //   path, so it must stay pure and side-effect-free).
  //   `variant` is always present (engine guarantees `'main'` minimum).
  //   Variants-unaware: destructure but ignore. Variants-aware: wrap
  //   the base name in `withVariant(base, variant)` so each variant
  //   produces a distinct (name, exportPath) cache key.
  toIdentifierName({ operation, variant }): string {
    const verb = capitalize(toMethodVerb(operation.method))
    const base = `${verb}${camelCase(operation.path, { upperFirst: true })}`
    // Variants-unaware:    return base
    // Variants-aware:
    return withVariant(base, variant)
  },

  // ⬇ Customize: the non-name parts of the identifier (entity `kind`,
  //   `typeName`, `exported`). Runs only on cache-miss. The `kind` drives
  //   declaration keywords and import forms in the language layer —
  //   `'variable'` for `export const`, `'type'` for `export type`.
  toIdentifierType: () => ({ kind: 'variable' }),

  // ⬇ Customize: where does the generated file land?
  toExportPath({ operation, enrichments, variant }): string {
    const name = this.toIdentifierName({ operation, enrichments, variant })
    return join('@', 'my-gen', `${name}.generated.ts`)
  }
})
```

`toIdentifierName`, `toIdentifierType`, and `toExportPath` **must be pure
functions** of their inputs. No `this`-side state, no async. The
cross-generator cache depends on this property.

`withVariant(base, 'main')` returns `base` unchanged; for any other
variant it appends a PascalCased suffix (`withVariant('Form', 'line-items')`
→ `'FormLineItems'`). Variant names are validated against
`variantNameRegex` (kebab-strict, `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`).

### B. `<MainProjection>.ts` — operation Projection class

```ts
// gen-x/src/MyGen.ts
import { TsProjection } from '@skmtc/gen-typescript'
import { MyGenBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'
import type { OasOperationProjectionConstructorArgs } from '@skmtc/core'
import invariant from 'tiny-invariant'

export class MyGen extends MyGenBase {
  tsRequestBodyName: string

  constructor({
    context,
    operation,
    settings
  }: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    // ⬇ toRequestBody returns undefined when the operation has no body —
    //   narrow before handing it on (isSupported gates on it, so throw).
    const requestBody = operation.toRequestBody(({ schema }) => schema)
    invariant(requestBody, 'Request body is required')

    // ⬇ Compose with peer generators by name (not by source).
    // The Driver handles ref resolution, dedup, and import registration.
    const tsRequestBody = this.insertNormalizedModel(TsProjection, {
      schema: requestBody,
      fallbackName: `${settings.identifier.name}Body`
    })
    this.tsRequestBodyName = tsRequestBody.identifier.name

    // ⬇ Register runtime imports needed by toString().
    this.register({
      imports: {
        'some-runtime-library': ['someHelper']
      }
    })
  }

  override toString(): string {
    // ⬇ Pure function of `this`. No mutation. Compose via ${...}.
    // ⬇ Return ONLY the value. Do NOT prefix with `export const ...`.
    //   The Driver wraps your value as
    //   `export const ${identifier.name} = ${this.toString()};`
    //   during File serialisation. Writing `export const` yourself
    //   produces `export const Foo = export const Foo = ...` — a
    //   TypeScript syntax error.
    return `someHelper<${this.tsRequestBodyName}>(...)`
  }
}
```

### C. `mod.ts` — entry point with capability gate

```ts
// gen-x/src/mod.ts
import {
  toOasOperationEntry,
  type IsSupportedOasOperationConfigArgs
} from '@skmtc/core'
import type { EnrichmentSchema } from './enrichments.ts'
import { toEnrichmentSchema } from './enrichments.ts'
import { MyGen } from './MyGen.ts'
import denoJson from '../deno.json' with { type: 'json' }

// NOTE: the entry is pure pipeline config — no `lang` field. The
// target language is declared by base.ts importing its projection-base
// factory from @skmtc/lang-typescript (scaffold A).
export const MyGenEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,

  // ⬇ Capability gate: which operations should this generator process?
  //   Declare capability only — do NOT gate on enrichment presence
  //   (filter intent via client.json `include`/`skip`).
  //   The engine calls this per variant; `variant` is informational
  //   here, not a gate (gating on variant is an anti-pattern).
  //   The args are `IsSupportedOasOperationConfigArgs<E>` — that type
  //   ALSO carries `context` and `enrichments`, not only the two
  //   fields destructured here. Pull them in when the predicate needs
  //   them; the partial destructure is not the complete arg surface.
  isSupported({ operation, variant }: IsSupportedOasOperationConfigArgs<EnrichmentSchema>) {
    return ['post', 'put', 'patch'].includes(operation.method) &&
      operation.requestBody?.resolve()?.toSchema()?.resolve().type === 'object'
  },

  // ⬇ The hook the engine calls per (operation, variant) pair.
  //   Thread `variant` into `insertOperation` so the Driver builds
  //   per-variant ContentSettings. Signature is
  //   `({ context, operation, variant }) => void` — there is no
  //   return value. Produce output via insertOperation / register,
  //   never by returning.
  transform({ context, operation, variant }) {
    context.insertOperation({ projection: MyGen, operation, variant })
  },

  // ⬇ Optional: makes the artifact visible in the Editor's preview UI.
  //   Thread `variant` into each static-method call.
  toPreviewModule: ({ context, operation, variant }) => ({
    name: MyGen.toIdentifierName({
      operation,
      enrichments: MyGen.toEnrichments({ operation, context, variant }),
      variant
    }),
    exportPath: MyGen.toExportPath({
      operation,
      enrichments: MyGen.toEnrichments({ operation, context, variant }),
      variant
    }),
    group: 'forms'
  }),

  toEnrichmentSchema
})

export default MyGenEntry
```

`transform` returns `void`. All output must go through `register` /
`insertOperation` / `insertNormalizedModel`.

### Scaffold C variant: GraphQL entry (`toGqlOperationEntry`)

Two shape differences from the OAS version above:

```ts fragment
import { toGqlOperationEntry, synthesizeArgsObject } from '@skmtc/core'

export const MyGqlEntry = toGqlOperationEntry<EnrichmentSchema>({
  id: denoJson.name,

  // ⬇ Mutations only, gated on the existence of a synthesizable args object.
  isSupported({ operation }) {
    return operation.rootKind === 'mutation' &&
      synthesizeArgsObject(operation) !== undefined
  },

  // ⬇ GQL transform has the same `({ context, operation, variant }) => void`
  //   signature as the other two flavours — nothing to return.
  transform({ context, operation, variant }) {
    if (operation.rootKind !== 'mutation') return
    context.insertOperation({ projection: MyGen, operation, variant })
  },

  toEnrichmentSchema
})
```

Three GQL-specific things to remember (the others apply equally):

1. **There is no accumulator.** GQL transforms return `void` like the
   other two flavours — the old `acc` threading is removed (F11).
   Cross-operation accumulation uses the gen-msw definition pattern
   (§10) or module-scope state (a fresh Worker per run makes it
   per-run-safe).
2. **Enrichments are *not* pre-resolved for GQL.** OAS pre-resolves
   by path+method; GQL hands you the raw operation. Reach the subject
   leaf at
   `context.settings.enrichments[id][operation.identifier][variant]`
   yourself (`operation.identifier` is `<rootKind>_<fieldName>`). The
   `_generator` / `_stack` run-constant scopes read the same as
   everywhere — `toGeneratorEnrichment` / `toStackEnrichment`.
3. **Mutation args come via `synthesizeArgsObject(operation)`.** GQL
   doesn't have a `requestBody` — `synthesizeArgsObject` turns the
   field's arguments into an object schema you can feed to
   `insertNormalizedModel`.

Background: [`concepts/the-graphql-pipeline.md`](../../concepts/the-graphql-pipeline.md).

### Scaffold C variant: Model entry (`toModelEntry`)

```ts fragment
import { toModelEntry } from '@skmtc/core'

export const MyModelEntry = toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  // ⬇ Optional capability gate (symmetric with operation entries). A
  //   model whose predicate returns false is recorded `notSupported`
  //   and its `transform` is skipped; omit it to support every model.
  //   The predicate gets `refName` (no schema) — resolve it yourself
  //   when needed, mirroring `transform`. Declare *capability* only;
  //   gate user intent via client.json `include`/`skip`, not here.
  isSupported({ context, refName }) {
    const schema = context.resolveSchemaRefOnce(refName, MyGen.id)
    return !schema.isRef() && schema.type === 'object'
  },

  // ⬇ Thread `variant` into `insertModel` so the Driver builds
  //   per-variant ContentSettings.
  transform({ context, refName, variant }) {
    context.insertModel(MyGen, refName, { variant })
  },

  toPreviewModule: ({ context, refName, variant }) => ({
    name: MyGen.toIdentifierName({
      refName,
      enrichments: MyGen.toEnrichments({ refName, context, variant }),
      variant
    }),
    exportPath: MyGen.toExportPath({
      refName,
      enrichments: MyGen.toEnrichments({ refName, context, variant }),
      variant
    }),
    group: 'models'
  })
})

export default MyModelEntry
```

Three model-specific things to remember:

1. **`isSupported` is optional and symmetric with operations.** When
   declared, the engine evaluates it per (refName, variant) before
   `include`/`skip`; a `false` result records `notSupported` and skips
   `transform`. When omitted it defaults to `() => true` (every refName
   runs). Declare *capability* only — gate user intent via client.json
   `include`/`skip`, never on enrichment presence. The predicate
   receives `refName` (no schema); resolve via
   `context.resolveSchemaRefOnce(refName, baseId)` when you need it. The
   static is also probed by `insertModel` (peer-capability — §3.5).
2. **`transform` receives `refName`, not a schema.** Resolve via
   `context.resolveSchemaRefOnce(refName, baseId)` when you need the
   schema. The Driver also passes the schema down to your
   Projection's constructor via `schemaToValueFn`.
3. **Composition uses `context.insertModel`, not `insertOperation`.**
   The two `insert*` methods are protocol-specific. `insertModel`
   takes a refName; `insertOperation` takes an OAS or GQL operation.
   Both accept an optional `{ variant }`; both default to `'main'`.

### Entry-factory routing cheat sheet

The three factories share a config skeleton but differ in three
operational details — committing this table to memory saves time:

| | `toOasOperationEntry` | `toGqlOperationEntry` | `toModelEntry` |
|---|---|---|---|
| `transform` arg | `operation: OasOperation` | `operation: GqlOperation` | `refName: RefName` |
| `transform` return | `void` — the `acc` accumulator is removed (F11) | same | same |
| `isSupported` field | optional, default `() => true` | optional, default `() => true` | optional, default `() => true` (predicate gets `refName`, no schema) |
| Enrichment routing | `enrichments.<id>.<path>.<method>.<variant>` | `enrichments.<id>.<rootKind>.<fieldName>.<variant>` | `enrichments.<id>.<refName>.<variant>` |
| Compose with | `this.insertOperation(P, op, { variant? })` | `this.insertOperation(P, op, { variant? })` | `this.insertModel(P, refName, { variant? })` |
| Companion base factory (from `@skmtc/lang-typescript`) | `toTsOasOperationProjectionBase` | `toTsGqlOperationProjectionBase` | `toTsModelProjectionBase` |
| `GeneratorKey` shape | `id\|path\|method\|variant` | `id\|rootKind\|fieldName\|variant` | `id\|refName\|variant` |

Full reference: [`reference/api/entry-factories.md`](../../reference/api/entry-factories.md).

### D. `enrichments.ts` — Valibot schema for user overrides

`toEnrichmentSchema` returns the **composite umbrella**
`v.object({ subject, generator, stack })` — the three enrichment scopes.
Each member is the generator-owned leaf at a different key-depth in
`client.json#settings.enrichments`; declare only the scopes you read and
leave the rest `v.undefined()`. The umbrella is what
`this.settings.enrichments` carries, and the single `EnrichmentType`
generic threaded through the projection chain *means* this umbrella.

```ts
// gen-x/src/enrichments.ts
import * as v from 'valibot'

// ⬇ Customize: the per-ITEM leaf — resolved per (operation/refName, variant)
//   at `[id][subject][variant]`. This is the original per-subject enrichment.
const subjectEnrichmentSchema = v.optional(
  v.object({
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    fields: v.optional(
      v.array(
        v.object({
          id: v.string(),
          label: v.optional(v.string())
        })
      )
    )
  })
)

// ⬇ The composite umbrella. `subject` is per-item; `generator` is a
//   run-constant for this one generator (`[id]._generator`); `stack` is a
//   run-constant shared across every generator (`._stack`). Declare only
//   the scopes you read — `v.undefined()` for the rest.
export const myGenEnrichmentSchema = v.object({
  subject: subjectEnrichmentSchema,
  generator: v.undefined(),
  stack: v.undefined()
})

export type EnrichmentSchema = v.InferOutput<typeof myGenEnrichmentSchema>
export const toEnrichmentSchema = () => myGenEnrichmentSchema
```

`toEnrichmentSchema` is **required** on both the entry factory
(`toModelEntry` / `toOasOperationEntry` / `toGqlOperationEntry`) AND the
projection-base config — required-ness is what lets `static toEnrichments`
parse the raw umbrella cast-free. A generator with no enrichments at any
scope declares `toEnrichmentSchema: () => emptyEnrichmentSchema`
(imported from `@skmtc/core` — every scope is `v.undefined()`), as
`gen-typescript` does.

Read the per-item leaf in the Projection constructor via
`this.settings.enrichments.subject` (e.g. `gen-shadcn-form`:
`this.settings.enrichments.subject ?? {}`). The two run-constant scopes
are not threaded through the per-item `ContentSettings` chain — read them
on demand from any context holder (a `transform`, an `isSupported` gate,
an accumulator snippet) via `toGeneratorEnrichment(context, id, schema)`
and `toStackEnrichment(context, schema)` (both from `@skmtc/core`).

**Reserved keys.** `_stack` and `_generator` are engine-reserved and
`_`-prefixed; customer keys — generator ids at the top level, subject
names inside a slot — must not start with `_`.

To know what enrichment shape a *consumer* would pass: this file is
canonical. Users place per-item values under
`client.json#settings.enrichments[generatorId][...routingKeys]`,
where the routing keys depend on the generator's projection-base
factory (see [enrichments-shape](../../reference/settings/enrichments-shape.md)).

### E. Anonymous Snippet — anonymous embedded fragment

```ts
// gen-x/src/MyFieldSnippet.ts
import type { GenerateContextType, OasRef, OasSchema } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'

type MyFieldSnippetArgs = {
  context: GenerateContextType
  name: string
  label?: string
  destinationPath: string    // ⬅ Snippets have no exportPath; the parent passes it
  schema?: OasSchema | OasRef<'schema'> // ⬅ optional: originating node, for attribution
}

export class MyFieldSnippet extends TsSnippet {
  name: string
  label: string | undefined

  constructor({ context, name, label, destinationPath, schema }: MyFieldSnippetArgs) {
    // ⬇ stackTrail is an optional attribution input — clone at the
    //   call site (the live trail is mutable).
    super({ context, stackTrail: schema?.stackTrail.clone() })
    this.name = name
    this.label = label

    // ⬇ Register imports against the parent's destinationPath —
    //   keyless: no generatorKey is required to register.
    this.register({
      imports: { '@/components/fields/my-field': ['MyField'] },
      destinationPath
    })
  }

  override toString() {
    return `<MyField name="${this.name}"${this.label ? ` label="${this.label}"` : ''} />`
  }
}
```

The parent Projection's `toString()` interpolates this snippet with
`${this.fieldSnippet}` — template-literal interpolation calls
`toString()` automatically. The parent constructs it with
`new MyFieldSnippet({ …, destinationPath: this.settings.exportPath })`.
`generatorKey` is an *optional* attribution (gen-maps) input — thread
`generatorKey: this.generatorKey` into `super(...)` if you want the
snippet attributed to the parent generator; registering never needs it.

## 7. Customization seams in stock generators

These are *deliberately* hardcoded values that mark customization
points. To change them, clone the generator and edit:

| Seam | Location | Customize by |
|---|---|---|
| Export path | `gen-x/src/base.ts` → `toExportPath` | Edit the `join('@', ...)` call — keep the `.generated.*` suffix |
| Identifier naming convention | `gen-x/src/base.ts` → `toIdentifierName` | Edit the name-building expression — keep a role suffix (`Form`, `Hook`, `Table`, …) for collision avoidance (see §8 "Bare-noun identifiers") |
| Peer dependency (e.g., HTTP layer) | `gen-x/src/<Main>.ts` top imports | Swap the import target (e.g., `gen-tanstack-query-supabase-zod` → `gen-tanstack-query-fetch-zod`) |
| Consumer-side component path | `gen-x/src/fields/<X>.ts` `register` call | Change the import key |
| Capability gate | `gen-x/src/mod.ts` → `isSupported` | Change the predicate |
| Enrichment schema | `gen-x/src/enrichments.ts` | Add Valibot fields |
| Field-type routing (form generators) | `gen-x/src/schemaToField.ts` | Add a branch for the new schema shape |

A common LLM mistake is suggesting the user "configure" a hardcoded
value via enrichments. Enrichments are limited to what each generator
declares in its Valibot schema (typically labels, descriptions, per-
field overrides). Anything not in the enrichment schema requires
cloning.

> **Runtime coupling — path-param naming.** Generators that read URL
> params (e.g. `gen-shadcn-form`'s `useSafeParams(z.object({ <oasParamName>:
> z.string() }))`) hard-code the **OpenAPI** path-param name into the
> generated component. If the consumer's router names the param
> differently (`{id}` vs `:invoiceId`), the form throws at mount. Not a
> `toIdentifierName`/`toExportPath` seam — confirm the names line up
> (`rg ':<param>' src/router*`) before migrating such output.

> **Targeting another package (monorepo output).** Edit `toExportPath`
> to return a **forward path** under the target package's `rootPath` —
> e.g. `join('packages/models/src', \`${name}.generated.ts\`)` — never a
> `../`-relative path (rejected at config load). The consumer declares
> the package in `client.json#settings.packages`; imports then render
> `@/…` intra-package and `moduleName` cross-package. See
> [`concepts/multi-package-output.md`](../../concepts/multi-package-output.md).

## 8. Anti-patterns

Concrete failure modes. Each is a thing an LLM might write or suggest
that breaks SKMTC's invariants in a specific way.

### Writing strings outside `toString()`

```ts
// ❌ WRONG
constructor(args) {
  super(args)
  Deno.writeFileSync('output.ts', 'export const X = ...')
}
```

**Fails because:** file exists on disk but not in `context.#files`.
Invisible to `findDefinition`, the artifacts payload, the manifest,
and cleanup. Other generators can't find it.

### Returning content from `transform()`

```ts
// ❌ WRONG
transform({ context, operation }) {
  return 'export const X = ...'
}
```

**Fails because:** `transform` returns `void` — the engine ignores any
return value. Silent zero-output failure — the manifest shows
`'success'` with no artifact.

### Raw `import` statements in template literals

```ts
// ❌ WRONG
toString() {
  return `import { X } from 'y'\n<X />`
}
```

**Fails because:** import lands in the *body* of the file, not the
header. TypeScript rejects. Also bypasses `Set`-based dedup.

```ts
// ✅ RIGHT — Projection: `register` targets the projection's OWN file
//   (this.settings.exportPath); the args take no destinationPath.
//   To write into a different file, use
//   this.registerInto(destinationPath, { imports }).
constructor(args) {
  super(args)
  this.register({ imports: { 'y': ['X'] } })
}
toString() {
  return `<X />`
}

// ✅ RIGHT — Snippet (extends TsSnippet): the parent passes
//   destinationPath through the constructor (Snippets have no
//   settings); registers are keyless.
constructor({ context, destinationPath }) {
  super({ context })
  this.register({ imports: { 'y': ['X'] }, destinationPath })
}
toString() {
  return `<X />`
}
```

### Hardcoded identifier names

```ts
// ❌ WRONG — collides if used in multiple places
const name = 'UserBody'

// ✅ RIGHT — derived deterministically, unique per operation
const name = `${capitalize(toEndpointName(operation))}Body`
```

**Fails because:** hardcoded names break the `(name, exportPath)`
cache-key uniqueness. Derive the name in `toIdentifierName` (which
returns the string directly); where you build a full `Identifier`
elsewhere, use `createVariable(derivedName)` / `createType(derivedName)`.

### Bare-noun identifiers and missing `.generated` suffixes

```ts
// ❌ WRONG — bare noun, plausible collision with peer generators
toIdentifierName({ operation }) {
  return camelCase(operation.path)
  // → `customers` — what if gen-table or gen-mock also picks this?
}
toExportPath({ operation }) {
  return join('@', 'forms', `${this.toIdentifierName({ operation })}.ts`)
  // → `@/forms/customers.ts` — no marker that this file is generated
}

// ✅ RIGHT — role-suffix the name; mark the file as generated
toIdentifierName({ operation }) {
  const verb = capitalize(toMethodVerb(operation.method))  // 'Create'
  const path = camelCase(operation.path, { upperFirst: true })  // 'Customers'
  return `${verb}${path}Form`
  // → `CreateCustomersForm`
}
toExportPath({ operation, enrichments }) {
  const name = this.toIdentifierName({ operation, enrichments })
  return join('@', 'forms', `${name}.generated.tsx`)
  // → `@/forms/CreateCustomersForm.generated.tsx`
}
```

**Fails because:** the cache key is `(name, exportPath)` — two
generators computing the same `name` for the same `exportPath` throw
`"Registered definition mismatch"`. Two conventions defuse this: a
**role suffix** (`Form`, `Hook`, `Table`, `Mock`, …) makes the name
project-unique, and the **`.generated.*` filename suffix** marks the
file engine-owned, keeps it greppable, and separates it from
consumer-side code.

### `as` casts in production code

```ts
// ❌ WRONG
const obj = schema as OasObject

// ✅ RIGHT
if (schema.type === 'object') {
  // schema is narrowed to OasObject here
}
```

**Fails because:** `as` bypasses type safety and the codebase
explicitly reserves it for tests. Production code narrows via guards
or discriminated-union checks.

### Long `if`/`else if` chains

```ts
// ❌ WRONG
if (schema.type === 'string') return ...
else if (schema.type === 'number') return ...
else if (schema.type === 'object') return ...
// 5 more branches

// ✅ RIGHT
switch (schema.type) {
  case 'string': return ...
  case 'number': return ...
  case 'object': return ...
  // ...
  default: {
    const _exhaustive: never = schema
    throw new Error(`Unhandled: ${JSON.stringify(_exhaustive)}`)
  }
}
```

**Fails because:** missed branches are silent. The `switch` + `never`
default makes the compiler enforce exhaustiveness.

### `process.env` instead of `Deno.env.get`

```ts
// ❌ WRONG
const key = process.env.API_KEY

// ✅ RIGHT
const key = Deno.env.get('API_KEY')
```

**Fails because:** the engine runs in Deno workers; `process` is not
defined.

### Mutation in `toString()`

```ts
// ❌ WRONG
toString() {
  this.cached = `...`
  return this.cached
}

// ✅ RIGHT — pure function of fields set in constructor
toString() {
  return `${this.x}`
}
```

**Fails because:** `toString()` may be called multiple times. Mutation
produces inconsistency across calls.

### Defensive `if (!already-registered)`

```ts
// ❌ WRONG — register is already idempotent (and on a Projection,
//   destinationPath isn't a valid field on BaseRegisterArgs)
if (!this.context.findDefinition({ name, exportPath })) {
  this.register({ definitions: [def] })
}

// ✅ RIGHT — Projection: just call register, the wrapper fills
//   destinationPath from this.settings.exportPath
this.register({ definitions: [def] })
```

**Fails because:** `register({ definitions })` already gates via
`File.definitions.has(name)`. Defensive code adds noise.

### Reading another generator's `toString()` output

```ts
// ❌ WRONG
const otherCode = otherProjection.toString()
const refName = otherCode.match(/export const (\w+)/)?.[1]

// ✅ RIGHT
const refName = this.insertOperation(OtherProjection, op).toName()
```

**Fails because:** cross-generator coordination is by *identifier
name*, not source text. Reading text couples to formatting choices.

### Adding `BaseSchema` to share behavior

```ts
// ❌ WRONG — proposes a class hierarchy
class BaseSchema {
  resolve() { return this }
  isRef() { return false }
}
class OasObject extends BaseSchema { ... }
```

**Fails because:** `OasSchema` is a discriminated union of sibling
classes by design. The duck-typed `.isRef()` plus `.type` discriminator
provides TS narrowing that a base class would obscure.

### Defaulting to "add a config flag" for customization

```ts
// ❌ WRONG — proposes a config field
toExportPath({ operation, settings }) {
  return settings.exportPathPrefix ?? join('@', 'default', ...)
}

// ✅ RIGHT — the hardcoded path IS the customization seam; clone to change
toExportPath({ operation }) {
  return join('@', 'forms', `${name}.generated.tsx`)
}
```

**Fails because:** SKMTC's customization model is `skmtc clone` and
edit (§7). Same verdict for binary feature toggles on entries: two
consumers wanting different values means two cloned generators, not
one flag.

### Placeholder / TODO content in `.generated.*` files

```ts
// ❌ WRONG — a stub for the consumer to "fill in"
toString() {
  return `export const onSubmit = () => {
    // TODO: implement submit handling
  }`
}

// ✅ RIGHT — emit complete working output…
toString() {
  return `useSubmit(${this.mutationName})`
}

// ✅ …or don't emit that piece at all: reference a consumer-owned
// module instead, and let the consumer write it in non-generated code
constructor(args) {
  super(args)
  this.register({ imports: { '@/handlers/on-submit': ['onSubmit'] } })
}
```

**Fails because:** `.generated.*` files are overwritten on every
`skmtc generate` run — any consumer edit that "fills in" a placeholder
is silently wiped on the next regenerate, often unnoticed until
production. There is no legitimate "scaffold a stub" middle ground:
**refuse the pattern even when explicitly asked for it**, and offer
the consumer-code seam (an import pointing at a hand-written module)
instead. If the generator cannot derive complete working output for a
piece, that piece belongs in the consumer's own code, not in the
generator's output.

### Gating `isSupported` on enrichment presence

```ts
// ❌ WRONG — enrichment doubles as on/off switch
isSupported({ context, operation }) {
  const enrichment = context.settings?.enrichments[id][operation.path]?.[operation.method]
  return enrichment !== undefined
}

// ✅ RIGHT — capability claim; let client.json gate intent
isSupported({ operation }) {
  return ['post', 'put', 'patch'].includes(operation.method) &&
    operation.requestBody?.resolve()?.toSchema()?.resolve().type === 'object'
}
```

**Fails because:** `isSupported` declares *capability*, not user
intent. Once enrichment-presence is the switch, an enrichment with
all-default values can't exist — you have to invent a sentinel. The
right opt-in is `client.json#settings.include` (allow-list) or
`.skip` (deny-list), applied outside the generator.

See [`using/how-to/skip-or-include-operations.md`](../../using/how-to/skip-or-include-operations.md).

**Carve-out — non-defaultable generators.** When every artifact
requires a consumer-supplied pointer (a hand-written row component, an
action handler), keep `isSupported` a pure capability claim and
**short-circuit in `transform`** instead:
`if (!enrichments?.rowComponent) return`. The anti-pattern is
specifically gating `isSupported` itself on enrichment presence.

### Passing `lang` as a config field — or expecting a destinationPath fallback

```ts fragment
// ❌ WRONG — nothing takes a lang config field: not the projection-base
//   factories, not the entries, not snippets
toTsModelProjectionBase({ id, lang: typescript, toIdentifierName, toIdentifierType, toExportPath })
toModelEntry({ id, lang: typescript, transform })

// ❌ WRONG — no implicit fallback exists, by design
this.register({ imports, destinationPath: maybePath ?? this.settings.exportPath })

// ✅ RIGHT — the import graph declares the language; own-file vs
//   cross-file is explicit
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'
this.register({ imports })                 // own file, always
this.registerInto(otherPath, { imports })  // cross-file, explicit
```

**Fails because:** no config field anywhere carries the language — a
generator declares it by importing its projection-base factory and
snippet base from the lang package, and Drivers read it off the
projection class's inherited static. And the missing
`destinationPath ?? exportPath` fallback is deliberate: own-file and
cross-file registration are separate, loud paths, so a missing path
can never silently land content in the wrong file.

### Shared file-scope export built as `defineAndRegister`-of-a-Snippet

```ts fragment
// ❌ WRONG — peers can't reach this Definition
import { defineAndRegister } from '@skmtc/lang-typescript'

defineAndRegister(context, {
  identifier: createVariable('formatMoney'),
  value: new FormatMoneySnippet({ context }),
  destinationPath
})

// ✅ RIGHT — if another generator might reference it by name, make it
// a Projection and let peers call insertOperation/insertModel on it
```

**Fails because:** a Definition built this way is unreachable through
`insertOperation(Producer, op)` — there is no Projection class to
pass — so every consumer must hardcode the name string, and the
identifier drifts when the producer changes. Test: *might another
generator reference this by name?* If yes → Projection.
(`defineAndRegister` remains right for *private* siblings in a file
you own, and for the accumulator pattern in §10.)

### Ad-hoc `{ toString: () => '…' }` objects

```ts
// ❌ WRONG — a Snippet trying to escape
const field = { toString: () => `<Field name="${name}" />` }

// ✅ RIGHT — extend SnippetBase (or TsSnippet when it registers)
class Field extends SnippetBase { /* … */ }
```

**Fails because:** the duck-type satisfies `Stringable` while lying
about capabilities — no `context` (so it can never `register` an
import), no `generatorKey`, invisible to attribution/gen-maps. If the
fragment touches `context`, needs imports, or is JSX-shaped, it's a
`SnippetBase` descendant.

### Reading `schema.refName` as a property

```ts
// ❌ WRONG — `.refName` doesn't exist as a property on OasRef
const refName = (schema as OasRef<'schema'>).refName
// Returns undefined at runtime; `refName.split(...)` crashes.

// ✅ RIGHT — narrow with the predicate, then call the method
if (schema.isRef()) {
  const refName = schema.toRefName()    // method, returns RefName
}
```

**Fails because:** `toRefName` is a method on `OasRef`, not a
property — easy to miss because both shapes are syntactically
plausible. `.isRef()` is the type predicate that narrows the union.

If you find yourself calling `toRefName()` to build an import path
manually, switch to `insertNormalizedModel` — it handles named refs
and inline schemas uniformly without coupling to peer path conventions.

### `Inserted` — `.toName()` / `.toIdentifier()`, not `.identifier`

```ts
// ❌ WRONG — `.identifier` is not a property on Inserted (TS2551)
const name = this.insertOperation(Peer, op).identifier.name

// ✅ RIGHT — `.toName()` returns the identifier name directly
const name = this.insertOperation(Peer, op).toName()

// ✅ ALSO RIGHT — `.toIdentifier()` is a method, returns an Identifier
const id = this.insertOperation(Peer, op).toIdentifier()
```

**Fails because:** `context.insertOperation` / `insertModel` /
`insertNormalizedModel` return an `Inserted`, whose surface is
`.toName()`, `.toIdentifier()` (a *method*), `.settings`, and
`.definition` — there is no `.identifier` property. Same
method-vs-property family as `OasRef.toRefName()` above. Prefer
`.toName()` when you only need the identifier string.

### Dropping the schema at the routing boundary

```ts
// ❌ WRONG — modifiers only; Snippet never sees enums/format/min/max
case 'boolean':
  return new ZodBoolean({ context, modifiers, destinationPath })

// ✅ RIGHT — forward the typed schema; let the Snippet read what it needs
case 'boolean':
  return new ZodBoolean({ context, modifiers, schema, destinationPath })

// Then in ZodBoolean.toString():
return this.enums?.length === 1
  ? `z.literal(${this.enums[0]})`
  : applyModifiers('z.boolean()', this.modifiers)
```

**Fails because:** when a central router (`toZodValue`, `toTsValue`)
forwards only `modifiers` to per-type Snippets, constraints on the
parsed schema — enum literals, formats, min/max — silently vanish.
The output compiles but loses precision (`[true]` enum becomes
`z.boolean()` instead of `z.literal(true)`, breaking discriminated-
union narrowing in consumer code).

Audit question for any per-type Snippet: *what schema fields beyond
modifiers does my `toString()` read?* If any, the schema must come
through.

### Variants-aware `toIdentifierName` that ignores `variant`

```ts fragment
// ❌ WRONG — collision on the second variant
toIdentifierName({ operation, variant }) {
  return `${toName(operation)}Form`
}

// ✅ RIGHT — disambiguate by variant
import { withVariant } from '@skmtc/core'
toIdentifierName({ operation, variant }) {
  return withVariant(`${toName(operation)}Form`, variant)
}
```

**Fails because:** the cache key is `(name, exportPath)` — variant 2
hits variant 1's cached Definition and the Driver's `generatorKey`
integrity check fires `"Registered definition mismatch"` (`|main` vs
`|customer` trailing segment). Test: `OasOperationDriver.test.ts` →
"forgets to vary toIdentifier collides on second variant".

### Auto-inheriting `this.settings.variant` to a peer

```ts
// ❌ WRONG — forces the peer to honour every variant the caller has
this.insertOperation(VariantsUnawarePeer, op, {
  variant: this.settings.variant  // throws when peer doesn't declare it
})

// ✅ RIGHT — let the peer's `'main'` default apply
this.insertOperation(VariantsUnawarePeer, op)
```

**Fails because:** the Driver throws on a non-`'main'` variant the
peer doesn't declare. Both of the caller's variants should share the
peer's `'main'` Definition; thread `variant` only when the peer is
variants-aware and you want its per-variant Definition. Tests:
`GenerateContext.cross-variant.test.ts`,
`OasOperationDriver.test.ts` → "Variant validation".

## 9. Verification checklist

After writing or editing a generator, verify:

- [ ] The projection-base factory (and any registering snippet's base, `TsSnippet`) is imported from the target language's `lang-*` package (e.g. `@skmtc/lang-typescript`) — no `lang` config field exists anywhere; entries are pure pipeline config
- [ ] All imports go through `this.register({ imports })` (own file) / `this.registerInto(path, { imports })` (cross-file) / `this.register({ imports, destinationPath })` (Snippet) — no raw `import` statements in template literals
- [ ] Registering snippets extend `TsSnippet` and receive an explicit `destinationPath`; `generatorKey` / `stackTrail` are optional attribution inputs only (registers are keyless)
- [ ] Transform-level and projection-internal sibling definitions use the `defineAndRegister` function imported from `@skmtc/lang-typescript` — not `this.defineAndRegister`, which does not type-check on factory-built projections
- [ ] No `as` casts in non-test code — narrowing uses type guards or discriminant checks
- [ ] Identifier names come from `createVariable` / `createType` (imported from `@skmtc/lang-typescript`) — no raw strings as identifiers
- [ ] Identifier names carry a role suffix (`Form`, `Hook`, `Table`, …); export paths use a `.generated.*` filename suffix
- [ ] No `if`/`else if` chains of length ≥ 3 — `switch` + exhaustive `never` default
- [ ] `toString()` is pure — no mutation of `this`, no side effects, deterministic in `this.*` fields set during construction
- [ ] `transform()` returns nothing meaningful — output is produced via `register` / `insertOperation`
- [ ] `toIdentifierName`, `toIdentifierType`, and `toExportPath` are **pure functions** of `(operation, enrichments)` — no `this`, no async, no environmental reads
- [ ] Cross-generator references use `insertOperation(Other, op).toName()` — never `.toString()`
- [ ] No `Deno.writeFileSync` (or equivalent) in constructors — all output through `register`
- [ ] No `process.env` — `Deno.env.get` only
- [ ] Constructor side effects (`register`, `insertNormalizedModel`) are safe to repeat (the system memoizes; idempotency is required)
- [ ] `OasSchema | OasRef<'schema'>` parameters are narrowed with `.isRef()` before accessing `.type` or `.properties`
- [ ] No `BaseSchema` or similar new base classes added to `OasSchema` variants
- [ ] Enrichment shape declared via Valibot in `enrichments.ts` — not via type-only declaration
- [ ] `toEnrichmentSchema` returns the composite umbrella `v.object({ subject, generator, stack })` (unused scopes `v.undefined()`, or `emptyEnrichmentSchema` for none) and is wired on BOTH the entry factory and the projection-base config (it is required on each)
- [ ] Per-item enrichment is read via `this.settings.enrichments.subject`; run-constant scopes via `toGeneratorEnrichment` / `toStackEnrichment` — never by indexing `this.settings.enrichments` with a reserved `_`-prefixed key
- [ ] `isSupported` is a capability predicate — does *not* gate on enrichment presence (filter via `client.json` `include`/`skip` instead)
- [ ] TypeScript-output checks (type-only imports / TS1484, `sanitizePropertyName` on schema-derived keys) — see the `skmtc-lang-typescript` skill §3/§5
- [ ] `.toRefName()` is only called inside an `.isRef()` branch — and only if `insertNormalizedModel` won't do the same job
- [ ] Per-type Snippet routers (`toZodValue` / `toTsValue` / equivalent) forward the typed schema — not just modifiers — so constraints survive
- [ ] No reads of `context.settings.enrichments['@other/gen-id']` — cross-generator references use the operation-reference protocol (§3.5)
- [ ] `transform` returns `void` (the `acc` accumulator no longer exists); GQL mutation gates use `synthesizeArgsObject(operation)`
- [ ] Schema `switch (schema.type)` is preceded by single-member-intersection unwrap and an `.isRef()` resolve
- [ ] Every variant-carrying static method (`toIdentifierName`, `toExportPath`, `toEnrichments`) destructures `variant` from its args; entry callbacks (`transform`, `isSupported`, `toPreviewModule`, `toMappingModule`) too (`toIdentifierType` takes `(refName/operation, context)` — no `variant`)
- [ ] If this generator is **variants-aware**, `toIdentifierName` incorporates `variant` (typically via `withVariant`); `toExportPath` produces distinct paths per variant (variant suffix in the filename)
- [ ] Cross-gen `insertOperation` calls do NOT auto-inherit `this.settings.variant` — they default to `'main'`; pass `{ variant: this.settings.variant }` only when the peer is known to support that variant
- [ ] `transform` threads `variant` into `context.insertOperation({…, variant})`; `toPreviewModule` / `toMappingModule` thread it into the static-method calls they make

If any box is unchecked, refactor before moving on. The skill loaded
into context cannot enforce these mechanically; the LLM applying them
is the only enforcement. Where an enforcement test exists for an
invariant, the relevant principle or anti-pattern above lists it
— check the test passes before declaring the work done.

## 10. Task cards

### Card: Cloning and customizing a stock generator

```bash
skmtc clone <project> -g @skmtc/gen-<name>     # see skmtc-cli skill for command details
```

After cloning:

1. Inspect the source: `ls .skmtc/<project>/gen-<name>/src/`
2. Identify the seam to edit (§7 above).
3. Edit `src/base.ts` for path/identifier changes; `src/<Main>.ts` for
   output-shape changes; `src/enrichments.ts` for new user options.
4. Run `skmtc dev <project>` for the rebundle-and-regenerate loop.
5. Verify against §9 checklist.

### Card: Adding a new field type to a form generator

**Prerequisite:** Generator must be cloned.

1. Create a Snippet file `src/fields/MyInput.ts` mirroring the
   `StringInput.ts` pattern (scaffold E above).
2. Edit `src/schemaToField.ts` — add a branch returning `MyInput`
   for the relevant schema shape (e.g., `schema.type === 'string' &&
   schema.format === 'date-time'`). Order matters — more specific
   branches above less specific.
3. Implement the consumer-side `MyField` component at the path the
   Snippet registers (e.g., `src/components/fields/my-field.tsx`).
4. `skmtc dev <project>` to iterate.

### Card: Swapping a peer dependency (e.g., HTTP layer)

**Prerequisite:** Both generators (current peer + replacement) must be
installed or cloned.

1. Clone the form (or other consuming) generator if not already.
2. Edit `src/<MainProjection>.ts` line 1 — change the peer import
   target (e.g., `gen-tanstack-query-supabase-zod` →
   `gen-tanstack-query-fetch-zod`).
3. Both packages export a `TanstackQuery` Projection with the same
   shape — no other code change needed.
4. Rebundle and regenerate.

### Card: Authoring a new generator from scratch

```bash
skmtc create <project> <gen-name> operation   # or 'model'
```

The scaffolded structure matches scaffolds A-D above. Then:

1. Implement `isSupported` (capability gate) in `src/mod.ts`. The
   entry carries no `lang` — the language comes from `src/base.ts`
   importing its projection-base factory from `@skmtc/lang-typescript`.
2. Implement `toIdentifierName`, `toIdentifierType`, and `toExportPath` in `src/base.ts`.
3. Implement the Projection class in `src/<MainProjection>.ts`.
4. Decompose into Snippet classes as needed (scaffold E).
5. Declare enrichments in `src/enrichments.ts` if user options are
   needed.
6. Iterate with `skmtc dev <project>`.

### Card: Adding enrichment options to a generator

**Prerequisite:** Generator must be cloned.

1. Edit `gen-x/src/enrichments.ts` — add Valibot fields to the schema
   (scaffold D).
2. Consume the new fields in the Projection constructor via
   `this.settings.enrichments.subject` (the per-item leaf; `.generator`
   and `.stack` are the run-constant scopes — see scaffold D in §6).
3. Document the new keys for users — typically in
   `reference/stock-generators/gen-<name>.md`.
4. Rebundle and regenerate; users add the keys to
   `client.json#settings.enrichments[gen-id]...`.

### Card: Composing with another generator

When your generator needs output from a peer generator:

1. Import the peer's Projection class:
   `import { OtherProjection } from '@skmtc/gen-other'`.
2. In your constructor, call `this.insertOperation(OtherProjection,
   op)` (for operation peers) or
   `this.insertNormalizedModel(OtherProjection, { schema, fallbackName
   })` (for model peers).
3. Use the returned `Inserted`'s `.toName()` to get the identifier
   name.
4. Reference the name in your template literal.

You never read the peer's `toString()`. Coordination is by name only.

### Card: One Projection, several output shapes (orchestrator–delegate)

When a Projection's output varies by schema or enrichment shape (query
vs mutation hook, create vs edit form), don't accumulate boolean flags
and `if`-cascades in `toString()`. Give the orchestrator ONE field
typed as a union of delegate classes; each delegate is a complete
Snippet with its own state; `toString()` delegates:

```ts
export class TanstackQuery extends TanstackQueryBase {
  delegate: QueryHook | MutationHook   // each extends SnippetBase

  constructor(args: OasOperationProjectionConstructorArgs) {
    super(args)

    this.delegate = args.operation.method === 'get'
      ? new QueryHook({ /* its own complete state */ })
      : new MutationHook({ /* its own complete state */ })
  }

  override toString() {
    return `${this.delegate}`
  }
}
```

New output shapes become new delegate classes, not new flags. Worked
example: `gen-tanstack-query-supabase-zod/src/TanstackQuery.ts`.

### Card: Authoring a variants-aware generator

A generator becomes *variants-aware* when its output naturally splits
into N artifacts per operation — section-edit forms for a broad PATCH
endpoint, wizard steps for a multi-step POST flow, mock-scenario
flavours (success/error/slow) for a single route. The variant axis
exists for this; do not invent your own.

When NOT to use it: cross-cutting per-operation overrides like a
global label or theme. Those are enrichment fields, not variants.
Variants partition output; enrichments parameterise it.

Steps to make a generator variants-aware:

1. **`src/base.ts`** — `toIdentifierName` reads `variant` and folds it
   into the name via `withVariant(base, variant)`. `toExportPath`
   threads `variant` into the recursive `this.toIdentifierName({…,
   variant})` call so each variant lands in its own file.

2. **`src/mod.ts`** — `transform({ context, operation, variant })`
   threads `variant` into `context.insertOperation({ projection,
   operation, variant })`. `toPreviewModule` /
   `toMappingModule` thread `variant` into every static-method call
   they make (`toEnrichments`, `toIdentifierName`, `toExportPath`).

3. **`src/enrichments.ts` — no change.** The variant axis is
   core-owned. The generator's enrichment Valibot schema continues
   to describe the *per-variant inner* shape (title, fields, etc.).
   Consumers wrap it themselves in the variant record: `{ main: {…},
   customer: {…} }` at `[id][path][method]` in `client.json`.

4. **Internal sibling Projections / Snippets** — if the generator
   constructs sibling Definitions (a Body type, a Hook, a Props
   type), derive their `fallbackName` from
   `settings.identifier.name`. Because that name is variant-bound
   via `withVariant`, the siblings automatically pick up the variant
   suffix. See `gen-shadcn-form/src/ShadcnForm.ts` for the canonical
   pattern.

5. **Cross-package peers** (`TanstackQuery`, `TsProjection`,
   `ZodProjection`) — call `this.insertOperation(Peer, op)` (no
   variant arg). The Driver defaults to `'main'`; both your
   variants share the peer's Definition. Do NOT thread
   `this.settings.variant` to a variants-unaware peer — see the
   anti-pattern in §8 "Auto-inheriting `this.settings.variant`".

6. **Consumer `client.json` migration** — for an existing project,
   wrap the operation-level enrichment in `{ main: {…} }`. If
   variants are declared without `'main'`, the engine throws at
   start with the missing-`main` message.

Worked example: `gen-shadcn-form` (post-0.5.0). Tests pinning the
invariants: `core/context/GenerateContext.variants.test.ts`,
`core/context/GenerateContext.cross-variant.test.ts`,
`core/context/GenerateContext.normalized-model-variants.test.ts`,
`core/dsl/operation/oas/OasOperationDriver.test.ts` → "Variant validation".

### Card: Emitting a barrel (re-export-only file)

Re-exports flow through the register family (the `ReExportBase` seam —
F3, restored). The concise form is `Record<string, Identifier[]>`
keyed by source module path; each identifier's entity kind picks
`export { x }` vs `export type { x }`, and entries merge across
registering generators.

```ts
// Own file: a re-export in this projection's own export file
this.register({ reExports: { './User.generated.ts': [identifier] } })

// Shared barrel file: each contributor registers into it explicitly
this.registerInto(join('@', 'index.generated.ts'), {
  reExports: { './User.generated.ts': [identifier] }
})
```

A barrel is *not* an accumulator (next card): no aggregate value, no
`defineAndRegister`.
See [`concepts/multi-package-output.md`](../../concepts/multi-package-output.md).

### Card: Accumulator-style generator (one shared aggregate, many contributors)

When the generator's output is a *single* aggregate **value** that
grows as more operations are visited (a routes table, a registry),
the per-operation Projection isn't the artifact — it contributes
*into* one. Canonical example: `gen-msw`, which builds a single
`toRoutesList` map keyed by the routes it sees.

Shape (`gen-msw/src/mod.ts`):

```ts fragment
import { defineAndRegister } from '@skmtc/lang-typescript'

transform: ({ context, operation }) => {
  // 1. Insert the per-operation artifact normally.
  const insertedRoute = context.insertOperation({
    projection: MockRoute,
    operation
  })
  const { exportPath } = insertedRoute.settings
  const route = insertedRoute.toName()
  if (!route) return

  // 2. Look up the shared aggregate at that exportPath.
  const existing = context.findDefinition({
    name: 'toRoutesList',
    exportPath
  })

  if (existing?.value instanceof MockRoutesList) {
    // 3a. Cache hit → mutate the existing value.
    existing.value.add(route)
    return
  }

  // 3b. Cache miss → defineAndRegister a fresh aggregate, then add.
  //     The defineAndRegister FUNCTION is imported from
  //     @skmtc/lang-typescript — a transform is a closure with no
  //     class, so the language comes from the import.
  const routesList = defineAndRegister(context, {
    identifier: createVariable('toRoutesList'),
    value: new MockRoutesList({ context }),
    destinationPath: exportPath
  })
  routesList.value.add(route)
}
```

The aggregate (`MockRoutesList`) is a `SnippetBase` whose
`toString()` renders the full accumulated value. `findDefinition`
is the read-without-register primitive; `defineAndRegister` is the
write-on-first-call primitive. Together they let many contributors
land into one Definition without the Driver path's cache-key
collision rules getting in the way.

Reference: [`reference/stock-generators/gen-msw.md`](../../reference/stock-generators/gen-msw.md).

### Card: Debugging "my generator produces no output"

Run the §5 "Why is my generator's output empty?" tree (six checks).
If unresolved → hand off to `skmtc-debug` with verify-first stance.

## 11. Boundary with other skills

- **skmtc-lang-typescript**: the TypeScript target-language layer —
  what the *emitted* code looks like (type-only imports, syntax
  helpers, sanitization, the `typescript` Lang object's surface). Load
  it alongside this skill for any TypeScript-emitting generator. It is
  the template for future `skmtc-lang-<X>` skills; other language
  layers are pre-alpha and have no skills yet.
- **skmtc-cli**: install / clone / bundle / dev commands. This skill
  picks up once you're editing generator source.
- **skmtc-debug**: when output is broken. Verify-first stance takes
  priority — switch to debug rather than proposing fixes from
  training-data defaults.
- **skmtc-retro**: end-of-session reflection. Captures observations
  about gaps in this skill's coverage (the recursive case).

When unsure: if the question is *what to write*, this skill. If *why
something is broken*, hand off to `skmtc-debug`.

## 12. Cross-references

- Concept docs: [`concepts/projections-and-snippets.md`](../../concepts/projections-and-snippets.md), [`concepts/cross-generator-coordination.md`](../../concepts/cross-generator-coordination.md), [`concepts/the-three-phases.md`](../../concepts/the-three-phases.md), [`concepts/variants.md`](../../concepts/variants.md), [`concepts/languages.md`](../../concepts/languages.md)
- Language seam: the `skmtc-lang-typescript` skill (sibling directory); design + open items in `notes/lang/` (`16` is the target architecture, now landed; `checklist.md` tracks the remaining F5/F6)
- API reference: [`reference/api/`](../../reference/api/) — full DSL surface
- Per-generator clone seams: [`reference/stock-generators/`](../../reference/stock-generators/)
- Tutorials: [`authoring/tutorials/`](../../authoring/tutorials/)
- How-tos: [`authoring/how-to/`](../../authoring/how-to/)
- Recipes: [`authoring/recipes/`](../../authoring/recipes/)
- Design philosophy: [`explanation/design-philosophy.md`](../../explanation/design-philosophy.md), [`explanation/why-clone-to-customize.md`](../../explanation/why-clone-to-customize.md)
- Consolidated LLM reference: [`llms.md`](../../llms.md) — the operational principles in §4 are mirrored from `llms.md`'s canonical version

### Tests that enforce the invariants

The skill's principles and anti-patterns are prose. The tests below
are the executable specs — when you doubt a rule still applies,
read the test or run it.

- Five-facts fact #5 (variant axis):
  `core/context/GenerateContext.variants.test.ts`,
  `core/context/GenerateContext.end-to-end.test.ts`,
  `core/helpers/toVariantList.test.ts`,
  `core/helpers/withVariant.test.ts`
- §3 "Variant threading on `insertOperation`":
  `core/context/GenerateContext.cross-variant.test.ts`
- §4 tripwire "auto-inherit variant":
  `core/dsl/operation/oas/OasOperationDriver.test.ts` → "Variant validation"
- §4 tripwire "variants-aware `toIdentifier` ignores `variant`":
  `core/dsl/operation/oas/OasOperationDriver.test.ts` → "forgets to vary toIdentifier collides on second variant"
- `GeneratorKey` serialize/parse contract:
  `core/dsl/GeneratorKeys.test.ts` → round-trip tests
- Variant-bound `fallbackName` composition (the `ShadcnForm` pattern):
  `core/context/GenerateContext.normalized-model-variants.test.ts`
- Bit-identical rendering across variant changes:
  `core/run/toArtifacts.regression.test.ts`
