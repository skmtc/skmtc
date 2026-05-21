---
name: skmtc-generator
version: 0.2.0
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
  verify-first stance takes priority during diagnosis.
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

## 1. The five facts that override default LLM intuitions

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

5. **The operation-variant axis fans out at the engine, not the
   generator.** A single operation can produce N Definitions via
   named variants under `enrichments[id][path][method]` (OAS) or
   `[id][rootKind][fieldName]` (GQL). `'main'` is always present —
   the engine throws at start if a consumer wrote variants without
   it. Variants flow through `ContentSettings.variant`, the
   `GeneratorKey`'s 4th segment, and the per-call `variant` arg in
   every static method (`toIdentifier`, `toExportPath`,
   `toEnrichments`) and every entry callback (`transform`,
   `isSupported`, `toPreviewModule`, `toMappingModule`). Cross-gen
   `insertOperation` defaults to `'main'`; passing a non-`'main'`
   variant the peer doesn't declare throws at the Driver.
   <br>See: [`concepts/variants.md`](../../concepts/variants.md).
   Enforcement tests: `core/context/GenerateContext.variants.test.ts`,
   `core/context/GenerateContext.end-to-end.test.ts`,
   `core/context/GenerateContext.cross-variant.test.ts`,
   `core/helpers/toVariantList.test.ts`.

## 2. The DSL: Projection vs Snippet

Both descend from `SnippetBase` (`core/dsl/SnippetBase.ts`). The
differentiator: **does it have a name at file scope?**

| | Projection | Snippet |
|---|---|---|
| Base class | `ModelProjectionBase`, `OasOperationProjectionBase`, `GqlOperationProjectionBase` | `SnippetBase` (directly) |
| Static methods required | `id`, `toIdentifier`, `toExportPath`, `toEnrichments`, `toEnrichmentSchema` | None |
| Instance has | `settings: ContentSettings` (identifier + exportPath + enrichments) | Just `context`, `register()` |
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

Two type names from `@skmtc/core` worth recognising when reading or
typing a generator:

- **`Stringable`** — anything with a `.toString()`. The composition
  contract: a Projection field or Snippet child typed `Stringable`
  accepts strings, Snippets, Definitions, `Identifier` instances,
  and inserted handles interchangeably. Used for `fields:
  Stringable`, `items: Stringable`, return types from helpers like
  `schemaToField`.
- **`ContentSettings<E>`** — the bundle of `(identifier, exportPath,
  enrichments)` the Driver computes from a Projection's static
  methods. Available on Projection instances as `this.settings`.
  Constructor argument types
  (`OasOperationProjectionConstructorArgs<E>` etc.) carry a
  `settings: ContentSettings<E>` field.

## 3. Cross-generator coordination

**Mechanism: memoization keyed by `(identifier.name, exportPath)`.**
Both are pure functions of `(operation, enrichments)` computed by the
Projection class's static methods. Same inputs → same key → cached
value reused. Generator execution order does not affect output.

The flow when `MyProjection.constructor` calls
`this.insertOperation(OtherProjection, operation)`:

1. `OasOperationProjectionBase.insertOperation` auto-fills
   `destinationPath` from `this.settings.exportPath`.
2. Delegates to `context.insertOperation`, which constructs
   `new OasOperationDriver(...)`.
3. Driver computes `settings` via `OtherProjection.toIdentifier(...)`
   and `OtherProjection.toExportPath(...)`.
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
| Add a sibling Definition in a file you already own (a type alias, a constant) | `context.defineAndRegister({ identifier, value, destinationPath })` |
| Register a library import (npm package, hand-written helper) from a **Projection** | `this.register({ imports: { 'pkg': ['Symbol'] } })` — the wrapper fills `destinationPath` from `this.settings.exportPath`; passing it explicitly is TS2353 |
| Register a library import from a **Snippet** | `this.register({ imports: { 'pkg': ['Symbol'] }, destinationPath })` — Snippets have no `settings`, so the parent that embeds this Snippet passes `destinationPath` through the constructor |
| Register an import for a peer-generator output | **Don't** — `insertOperation`/`insertNormalizedModel` already did this for you |

The helpers wrap **Driver** classes (`ModelDriver`,
`OasOperationDriver`, `GqlOperationDriver`) that bake in idempotency
and auto-import-registration. Calling `register` directly for
peer-generator output skips both — duplicate Definition registration,
missing import, or a "Registered definition mismatch" if you got the
cache key wrong.

### Variant threading on `insertOperation`

`context.insertOperation({ projection, operation, variant? })`
accepts an optional `variant` arg. Default: `'main'` — the canonical
variant that every peer is guaranteed to honour. Pass an explicit
non-`'main'` variant only when:

- The peer is a variants-aware generator that declares that variant
  in its enrichment shape, AND
- You deliberately want the peer's per-variant Definition (not the
  shared `'main'` one).

If the requested variant isn't declared in the peer's enrichment
block, the Driver throws at the call site with the available
variants listed (see
`OasOperationDriver.assertPeerVariantExists`). Loud beats silent
zero-output.

Two variants of the same Projection both calling
`this.insertOperation(VariantsUnawarePeer, op)` (no variant arg) hit
the same `'main'` cache key and share the peer's Definition — the
peer's import is registered into each variant's file independently.
This is the standard pattern for variants-aware Projections
composing with variants-unaware peers like `gen-typescript` /
`gen-tanstack-query` / `gen-zod`.

See: `core/context/GenerateContext.cross-variant.test.ts`.

### `insertOperation` enforces the peer's `isSupported`

Cross-generator `insertOperation` deliberately **bypasses the peer's
`skip` / `include`** config — dependency edges are filter-blind, so a
peer the consumer skipped at the top level still materialises when
another generator depends on it. Capability is the exception:
`insertOperation` **does** enforce the peer's static `isSupported`. If
the peer has declared the operation unsupported, the Driver throws
(`OasOperationDriver` / `GqlOperationDriver` → `assertPeerSupported`).
The throw unwinds into `GenerateContext`'s per-item `try/catch`, so the
*calling* generator's item is recorded as `error` and the run
continues — loud, isolated failure beats a silently-broken Definition.

For the check to bite, the peer must expose `isSupported` on its
**projection base** (`base.ts`, via the `isSupported` config field of
`toOasOperationProjectionBase`) — that is the static the Driver probes.
A peer with no static `isSupported` is treated as supporting every
operation. See `core/dsl/operation/oas/OasOperationDriver.test.ts` →
"Peer support validation".

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

The four meeting points:

- **Operation reference in the consumer's enrichment** — a string
  (tag, fieldName, path) identifying an operation. Lives in the
  *consumer* generator's enrichment schema (§7), not the producer's.
- **Producer's `isSupported(op)`** — its capability claim. The
  consumer filters candidate operations with it (the example above);
  `insertOperation` independently enforces it (see §3).
- **Producer's static `toIdentifier(op)` / `toExportPath(op)`** —
  content-addressed identity for the cache key.
- **`insertOperation`** — registers the producer's Definition + auto-
  registers the import.

The consumer imports the producer's Projection as a *type-level
package dependency* — exactly like `gen-shadcn-form` imports
`ShadcnSelectInput` from `gen-shadcn-select`. No runtime config
sharing, no cross-namespace enrichment peeking.

Detail and a GraphQL example: [`concepts/cross-generator-coordination.md`](../../concepts/cross-generator-coordination.md).

> **Variants note.** Operation references identify operations, not
> variants. A reference like `references: "customerList"` resolves
> to a peer operation and inserts the peer's `'main'` variant
> (Driver default). Variant-targeted operation references aren't
> supported — if you need a variant of a referenced operation,
> insert it explicitly in the consumer's Projection with
> `{ variant }`.

## 4. Operational principles

The canonical operational table for authoring. Each row pairs a
*default suggestion an LLM would reach for from generic TypeScript /
codegen training data* with *what SKMTC actually requires*.

If your proposed solution matches the left column, the right column is
almost always the correct alternative.

| Default intuition (from training data) | SKMTC's stance | Why |
|---|---|---|
| Add a config flag to make X customizable | `skmtc clone` the generator and edit | Customization is via source code, not configuration |
| Add a plugin API for extensibility | Generators coordinate via memoization; there is no plugin registry | Cross-generator coordination is a `Map` cache keyed by `(name, exportPath)` |
| Run Prettier or Biome in the pipeline | Don't — produce valid TS and stop | Format is the consumer's concern; pipeline renders unformatted output by design |
| Provide a runtime client library | Output is committed source code | Zero SKMTC runtime in consumer bundles; generated files are reviewed via git |
| Fail closed on bad schema input | Fail open, log `ParseIssue`s, prune dependents via `removeErroredItems` | One bad schema mustn't kill the run; manifest is the canonical record |
| Templates as `.hbs` / `.mustache` files | Templates as template literals inside TypeScript classes | Type safety on interpolated values; full IDE refactoring |
| Cache between runs for speed | Each generate is from cold; spawn a fresh Worker per run | Determinism > marginal speed; no state leaks between runs |
| Make `OasSchema` a base class with subclasses | Keep it as a discriminated union of sibling classes | TS narrowing via `.isRef()` and `.type` discriminator beats runtime polymorphism |
| Use raw strings as identifier names | Use `Identifier.createVariable(name)` or `Identifier.createType(name)` | Entity-type tracking is load-bearing under `verbatimModuleSyntax: true` |
| Use `as` casts to satisfy types | Use type guards or runtime checks | `as` is reserved for tests; production code narrows |
| Long `if`/`else if` chains for 3+ branches | Use `switch` with exhaustive `never` default | Codebase convention; gets compiler help on missed cases |
| Use `process.env.X` | Use `Deno.env.get('X')` | Deno codebase; engine runs in Deno workers |
| Concatenate strings to build output | Template-literal interpolation with `${...}` | Composes with any `Stringable`; preserves Snippet recursion |
| Add defensive `if (!already-registered)` around `register` calls | Just call `register` | Already idempotent via Set / Map semantics |
| Mutate `this` inside `toString()` | Set state in the constructor; `toString()` must be pure | May be called multiple times (previews, integrity checks) |
| Read another generator's rendered source | Coordinate by *identifier name*, not source text | Use `insertOperation(Other, op).toName()` |
| Return content from `transform({ context, operation })` | Use `register({ definitions, ... })` or `insertOperation` | Return value is folded into `acc` and discarded |
| Write `import` statements inside template literals | Register imports via `this.register({ imports, destinationPath })` | Bypasses dedup; lands inside file body not header |
| Add a `BaseSchema` class to share schema behavior | Schema variants are sibling classes, not subclasses | Duck-typed `.isRef()` + discriminator narrowing is intentional |
| Use `Deno.writeFileSync` from a generator constructor | Use `register({ definitions, ... })` | Direct writes bypass `context.#files`; invisible to coordination and persistence |
| Hardcode generator-internal identifier names | Derive from operation/refName via `toIdentifier` | Hardcodes break the `(name, exportPath)` cache-key uniqueness |
| Add runtime type checks or `@override` decorators | Use TypeScript's structural typing + discriminated unions | Runtime overhead unnecessary; types catch at compile time |
| Reach into `OasOperation` properties directly without `.resolve()` | Call `.resolve()` on `OasRef`-typed values; check `.isRef()` | Common parameter type is `OasSchema \| OasRef<'schema'>`; resolution is lazy |
| Use `isSupported` to opt the generator in/out per-operation based on whether an enrichment is present | Have `isSupported` declare *capability*; gate at runtime via `client.json#settings.include` / `.skip` | `isSupported` is a capability claim, not a user-intent filter; gating on enrichment forces a sentinel for "default values" |
| Import a type-only symbol as a bare value: `imports: { 'react': ['UseFormProps'] }` | Tag it: `{ name: 'UseFormProps', type: 'type' }`, or use `identifier.toImport()` | Bare value import of a type breaks consumer compile under `verbatimModuleSyntax: true` (TS1484) |
| Read `schema.refName` as a property | Narrow with `schema.isRef()` then call `schema.toRefName()` | `toRefName` is a method on `OasRef`; reading `.refName` returns `undefined` and crashes downstream |
| Forward only `modifiers` (not the schema) into per-type Snippets like `ZodBoolean` | Pass the typed schema in; let the Snippet read constraints it needs (`enums`, `format`, `minimum`) | Dropping the schema at the routing boundary silently erases constraints — `[true]` becomes `z.boolean()` instead of `z.literal(true)` |
| Peek at another generator's enrichments via `context.settings.enrichments['@other/gen-x']` | Add an operation-reference enrichment in your *own* schema; call `insertOperation` (§3.5) | Cross-namespace coupling breaks the dependency-graph model; the leaf shape is owned by the producer |
| GQL `transform({ context, operation })` with no `acc` | GQL is `transform({ context, operation, acc })` and must **return `acc`** | OAS transform returns void; GQL threads the accumulator — dropping it breaks downstream operations |
| Treat `allOf` schemas as still unmerged in your generator | Treat received schemas as already-flat objects | `core/oas/_merge-all-of/` runs during Parse; by Generate phase the merge has happened |
| Switch on `schema.type` without first unwrapping single-member intersections / refs | Unwrap one-member unions and `.isRef()` first, then switch on `.type` | OpenAPI refs can't carry extensions, so SKMTC sometimes models `$ref + extension` as a 1-member union; missing the unwrap loses the schema |
| Auto-inherit `this.settings.variant` when calling `this.insertOperation(Peer, op)` | Default to `'main'`; pass `{ variant: this.settings.variant }` only when you deliberately want the peer to be variant-bound | Peers are variants-unaware by default; auto-inherit forces every peer to honour every caller's variant — the Driver throws on mismatch (`assertPeerVariantExists`). See `core/dsl/operation/oas/OasOperationDriver.test.ts` → "Variant validation" |
| Variants-aware `toIdentifier` ignores `variant` | Fold `variant` into the returned name (typically via `withVariant`) | `(name, exportPath)` is the cache key. Two variants producing the same name hit the cached Definition on variant 2; the Driver's `generatorKey` integrity check fires `"Registered definition mismatch"`. See `core/context/GenerateContext.end-to-end.test.ts` + `OasOperationDriver.test.ts` → "forgets to vary toIdentifier collides on second variant" |

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

### Should this be a Projection or a Snippet?

```
Need its own name at file scope (export const X = ...)?
├── Yes → Projection (extends *ProjectionBase, has static toIdentifier/toExportPath)
└── No  → Snippet   (extends SnippetBase, anonymous, embedded via ${this.x})
```

If unsure: probably Snippet. Promote later if cross-file identity is
needed.

### Where should generated string content go?

```
Final output text?       → SnippetBase descendant's toString() (template literal with ${...})
Import?                   → this.register({ imports: { module: [names] }, destinationPath })
Identifier name?          → Identifier.createVariable(name) or Identifier.createType(name)
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
  Identifier,
  toMethodVerb,
  toOasOperationProjectionBase,
  withVariant  // only needed for variants-aware generators
} from '@skmtc/core'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const MyGenBase = toOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  // ⬇ Customize: how is the generated identifier name derived?
  //   `variant` is always present (engine guarantees `'main'` minimum).
  //   Variants-unaware: destructure but ignore. Variants-aware: wrap
  //   the base name in `withVariant(base, variant)` so each variant
  //   produces a distinct (name, exportPath) cache key.
  toIdentifier({ operation, variant }): Identifier {
    const verb = capitalize(toMethodVerb(operation.method))
    const base = `${verb}${camelCase(operation.path, { upperFirst: true })}`
    // Variants-unaware:    return Identifier.createVariable(base)
    // Variants-aware:
    return Identifier.createVariable(withVariant(base, variant))
  },

  // ⬇ Customize: where does the generated file land?
  toExportPath({ operation, enrichments, variant }): string {
    const { name } = this.toIdentifier({ operation, enrichments, variant })
    return join('@', 'my-gen', `${name}.generated.ts`)
  }
})
```

Both `toIdentifier` and `toExportPath` **must be pure functions** of
their inputs. No `this`-side state, no async. The cross-generator cache
depends on this property.

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

export class MyGen extends MyGenBase {
  tsRequestBodyName: string

  constructor({
    context,
    operation,
    settings
  }: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    // ⬇ Compose with peer generators by name (not by source).
    // The Driver handles ref resolution, dedup, and import registration.
    const tsRequestBody = this.insertNormalizedModel(TsProjection, {
      schema: operation.toRequestBody(({ schema }) => schema),
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

export const MyGenEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,

  // ⬇ Capability gate: which operations should this generator process?
  //   Declare capability only — do NOT gate on enrichment presence
  //   (filter intent via client.json `include`/`skip`).
  //   The engine calls this per variant; `variant` is informational
  //   here, not a gate (gating on variant is an anti-pattern).
  isSupported({ operation, variant }: IsSupportedOasOperationConfigArgs<EnrichmentSchema>) {
    return ['post', 'put', 'patch'].includes(operation.method) &&
      operation.requestBody?.resolve()?.toSchema()?.resolve().type === 'object'
  },

  // ⬇ The hook the engine calls per (operation, variant) pair.
  //   Thread `variant` into `insertOperation` so the Driver builds
  //   per-variant ContentSettings. Return value is discarded — produce
  //   output via insertOperation / register.
  transform({ context, operation, variant }) {
    context.insertOperation({ projection: MyGen, operation, variant })
  },

  // ⬇ Optional: makes the artifact visible in the Editor's preview UI.
  //   Thread `variant` into each static-method call so the preview
  //   metadata reflects the variant (otherwise it stamps everything as
  //   `'main'`).
  toPreviewModule: ({ context, operation, variant }) => ({
    name: MyGen.toIdentifier({
      operation,
      enrichments: MyGen.toEnrichments({ operation, context, variant }),
      variant
    }).name,
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

The return value of OAS `transform` is discarded. All output must go
through `register` / `insertOperation` / `insertNormalizedModel`.

### Scaffold C variant: GraphQL entry (`toGqlOperationEntry`)

Two shape differences from the OAS version above:

```ts
import { toGqlOperationEntry, synthesizeArgsObject } from '@skmtc/core'

export const MyGqlEntry = toGqlOperationEntry<EnrichmentSchema>({
  id: denoJson.name,

  // ⬇ Mutations only, gated on the existence of a synthesizable args object.
  isSupported({ operation }) {
    return operation.rootKind === 'mutation' &&
      synthesizeArgsObject(operation) !== undefined
  },

  // ⬇ GQL transform takes `acc` AND `variant`. MUST return `acc`.
  //   Forgetting to return `acc` breaks downstream operations.
  //   The engine threads `acc` through variants of the same operation
  //   in `Object.keys` order — variants share the operation's acc slot.
  transform({ context, operation, acc, variant }) {
    if (operation.rootKind !== 'mutation') return acc
    context.insertOperation({ projection: MyGen, operation, variant })
    return acc
  },

  toEnrichmentSchema
})
```

Three GQL-specific things to remember (the others apply equally):

1. **`transform` is `({ context, operation, acc }) => acc`.** Threads
   the accumulator through every operation the engine visits.
   Drop `acc` and downstream calls see stale state.
2. **Enrichments are *not* pre-resolved for GQL.** OAS pre-resolves
   by path+method; GQL hands you the raw operation. Walk
   `context.settings.enrichments[id][operation.identifier]` yourself
   (`operation.identifier` is `<rootKind>_<fieldName>`).
3. **Mutation args come via `synthesizeArgsObject(operation)`.** GQL
   doesn't have a `requestBody` — `synthesizeArgsObject` turns the
   field's arguments into an object schema you can feed to
   `insertNormalizedModel`.

Background: [`concepts/the-graphql-pipeline.md`](../../concepts/the-graphql-pipeline.md).

### Scaffold C variant: Model entry (`toModelEntry`)

```ts
import { toModelEntry } from '@skmtc/core'

export const MyModelEntry = toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  // ⬇ NO `isSupported` for model entries — `transform` runs for every
  //   refName. Filter inside the callback if needed.
  transform({ context, refName }) {
    const schema = context.resolveSchemaRefOnce(refName, MyGen.id)
    if (schema.isRef() || schema.type !== 'object') return

    context.insertModel(MyGen, refName)
  },

  toPreviewModule: ({ refName, enrichments }) => ({
    name: MyGen.toIdentifier({ refName, enrichments }).name,
    exportPath: MyGen.toExportPath({ refName, enrichments }),
    group: 'models'
  })
})

export default MyModelEntry
```

Three model-specific things to remember:

1. **No `isSupported` field.** The engine visits every refName
   in the document and calls `transform`. Filter unwanted schemas
   inside the callback (`if (schema.type !== 'object') return`),
   not by gating the Entry.
2. **`transform` receives `refName`, not a schema.** Resolve via
   `context.resolveSchemaRefOnce(refName, baseId)` when you need the
   schema. The Driver also passes the schema down to your
   Projection's constructor via `schemaToValueFn`.
3. **Composition uses `context.insertModel`, not `insertOperation`.**
   The two `insert*` methods are protocol-specific. `insertModel`
   takes a refName; `insertOperation` takes an OAS or GQL operation.

### Entry-factory routing cheat sheet

The three factories share a config skeleton but differ in three
operational details — committing this table to memory saves time:

| | `toOasOperationEntry` | `toGqlOperationEntry` | `toModelEntry` |
|---|---|---|---|
| `transform` arg | `operation: OasOperation` | `operation: GqlOperation` | `refName: RefName` |
| `acc` semantics | omit `return acc` freely | **must** `return acc` | omit `return acc` freely |
| `isSupported` field | optional, default `() => true` | optional, default `() => true` | **absent** — filter in `transform` |
| Enrichment routing | `enrichments.<id>.<path>.<method>` | `enrichments.<id>.<rootKind>.<fieldName>` | `enrichments.<id>.<refName>` |
| Compose with | `context.insertOperation(P, op)` | `context.insertOperation(P, op)` | `context.insertModel(P, refName)` |
| Companion base factory | `toOasOperationProjectionBase` | `toGqlOperationProjectionBase` | `toModelProjectionBase` |

Full reference: [`reference/api/entry-factories.md`](../../reference/api/entry-factories.md).

### D. `enrichments.ts` — Valibot schema for user overrides

```ts
// gen-x/src/enrichments.ts
import * as v from 'valibot'

// ⬇ Customize: what user-facing options does this generator accept?
export const myGenEnrichmentSchema = v.optional(
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

export type EnrichmentSchema = v.InferOutput<typeof myGenEnrichmentSchema>
export const toEnrichmentSchema = () => myGenEnrichmentSchema
```

To know what enrichment shape a *consumer* would pass: this file is
canonical. Users place values under
`client.json#settings.enrichments[generatorId][...routingKeys]`,
where the routing keys depend on the generator's projection-base
factory (see [enrichments-shape](../../reference/settings/enrichments-shape.md)).

### E. Anonymous Snippet — anonymous embedded fragment

```ts
// gen-x/src/MyFieldSnippet.ts
import { SnippetBase } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core'

type MyFieldSnippetArgs = {
  context: GenerateContextType
  name: string
  label?: string
  destinationPath: string  // ⬅ Snippets need this passed in
}

export class MyFieldSnippet extends SnippetBase {
  name: string
  label: string | undefined

  constructor({ context, name, label, destinationPath }: MyFieldSnippetArgs) {
    super({ context })
    this.name = name
    this.label = label

    // ⬇ Register imports against the parent's destinationPath.
    // Snippets don't have their own exportPath, so the parent passes it.
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
`toString()` automatically.

## 7. Customization seams in stock generators

These are *deliberately* hardcoded values that mark customization
points. To change them, clone the generator and edit:

| Seam | Location | Customize by |
|---|---|---|
| Export path | `gen-x/src/base.ts` → `toExportPath` | Edit the `join('@', ...)` call — keep the `.generated.*` suffix |
| Identifier naming convention | `gen-x/src/base.ts` → `toIdentifier` | Edit the name-building expression — keep a role suffix (`Form`, `Hook`, `Table`, …) for collision avoidance (see §8 "Bare-noun identifiers") |
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

**Fails because:** return value is folded into `acc` and discarded.
Silent zero-output failure — the manifest shows `'success'` with no
artifact.

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
// ✅ RIGHT — Projection: register without destinationPath; the
//   projection-base wrapper fills it from this.settings.exportPath.
//   Passing destinationPath here is TS2353 (BaseRegisterArgs has no
//   such field).
constructor(args) {
  super(args)
  this.register({ imports: { 'y': ['X'] } })
}
toString() {
  return `<X />`
}

// ✅ RIGHT — Snippet: pass destinationPath through from the parent
//   that embeds this Snippet (Snippets have no settings.exportPath).
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
cache-key uniqueness. Use `Identifier.createVariable(derivedName)`.

### Bare-noun identifiers and missing `.generated` suffixes

```ts
// ❌ WRONG — bare noun, plausible collision with peer generators
toIdentifier({ operation }) {
  return Identifier.createVariable(camelCase(operation.path))
  // → `customers` — what if gen-table or gen-mock also picks this?
}
toExportPath({ operation }) {
  return join('@', 'forms', `${this.toIdentifier({ operation }).name}.ts`)
  // → `@/forms/customers.ts` — no marker that this file is generated
}

// ✅ RIGHT — role-suffix the name; mark the file as generated
toIdentifier({ operation }) {
  const verb = capitalize(toMethodVerb(operation.method))  // 'Create'
  const path = camelCase(operation.path, { upperFirst: true })  // 'Customers'
  return Identifier.createVariable(`${verb}${path}Form`)
  // → `CreateCustomersForm`
}
toExportPath({ operation, enrichments }) {
  const { name } = this.toIdentifier({ operation, enrichments })
  return join('@', 'forms', `${name}.generated.tsx`)
  // → `@/forms/CreateCustomersForm.generated.tsx`
}
```

**Fails because:** the cache key is `(name, exportPath)`. Two
generators that happen to compute the same `name` for the same
`exportPath` throw `"Registered definition mismatch"` at generation
time. Two conventions defuse this:

1. **Role suffix.** `Form`, `Table`, `Hook`, `Mock`, `Validator`,
   `Handler`, `Query` — whatever names the artifact's role.
   `CreateCustomersForm` collides with no other artifact in the
   project.
2. **`.generated.*` filename suffix.** Marks the file as engine-owned
   (so humans don't hand-edit it), keeps it greppable, and gives the
   `(name, exportPath)` pair a second axis of separation when the
   identifier itself overlaps with consumer-side code.

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

// ✅ RIGHT — the hardcoded path is the customization seam; clone to change
toExportPath({ operation }) {
  return join('@', 'forms', `${name}.generated.tsx`)
}
```

**Fails because:** SKMTC's customization model is `skmtc clone` and
edit. Adding flags for every variation balloons the surface area;
cloning keeps stock simple.

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

### Bare value imports of type-only symbols

```ts
// ❌ WRONG — TS1484 under verbatimModuleSyntax: true
this.register({
  imports: { 'react-hook-form': ['useForm', 'UseFormProps'] }
})

// ✅ RIGHT — tag the type explicitly
this.register({
  imports: {
    'react-hook-form': [
      'useForm',
      { name: 'UseFormProps', type: 'type' }
    ]
  }
})

// ✅ BETTER — when you already hold an Identifier, let it pick the form
this.register({
  imports: { './types': [this.userBody.identifier.toImport()] }
})
```

**Fails because:** consumers compiling with `verbatimModuleSyntax: true`
(modern Vite, Next.js strict) reject bare value imports of types with
TS1484. The `{ name, type: 'type' }` form is structural; `toImport()`
threads the entity-type discriminator automatically. See
[`reference/api/dsl-import.md`](../../reference/api/dsl-import.md).

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

When auditing a new per-type Snippet, ask: *what schema fields beyond
modifiers does my `toString()` read?* If the answer is any, the
schema must come through.

### Variants-aware `toIdentifier` that ignores `variant`

```ts
// ❌ WRONG — collision on the second variant
toIdentifier({ operation, variant }) {
  return Identifier.createVariable(`${toName(operation)}Form`)
}

// ✅ RIGHT — disambiguate by variant
import { withVariant } from '@skmtc/core'
toIdentifier({ operation, variant }) {
  return Identifier.createVariable(withVariant(`${toName(operation)}Form`, variant))
}
```

**Fails because:** the cache key is `(name, exportPath)`. Two
variants producing the same `name` hit the cached Definition on the
second variant; the Driver's `generatorKey` integrity check
(`OasOperationDriver.affirmDefinition`) fires `"Registered
definition mismatch"` because the cached entry's generatorKey ends
in `|main` while the new call's ends in `|customer`. Loud
consumer-visible failure rather than silent doubled-`export const`.

Enforcement test:
`core/dsl/operation/oas/OasOperationDriver.test.ts` →
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

**Fails because:** the Driver throws when an explicit non-`'main'`
variant isn't declared in the peer's enrichment block. Two variants
of the form pointing at the same variants-unaware peer should share
that peer's `'main'` Definition (cache hit on the second call); the
auto-inherit pattern instead forces the peer to fan out per variant,
which it isn't built to do.

Thread variant explicitly only when the peer is known to be
variants-aware AND you want a per-variant peer Definition.

Enforcement tests:
`core/context/GenerateContext.cross-variant.test.ts`,
`core/dsl/operation/oas/OasOperationDriver.test.ts` → "Variant validation".

## 9. Verification checklist

After writing or editing a generator, verify:

- [ ] All imports go through `this.register({ imports, destinationPath })` — no raw `import` statements in template literals
- [ ] No `as` casts in non-test code — narrowing uses type guards or discriminant checks
- [ ] Identifier names come from `Identifier.createVariable` / `createType` — no raw strings as identifiers
- [ ] Identifier names carry a role suffix (`Form`, `Hook`, `Table`, …); export paths use a `.generated.*` filename suffix
- [ ] No `if`/`else if` chains of length ≥ 3 — `switch` + exhaustive `never` default
- [ ] `toString()` is pure — no mutation of `this`, no side effects, deterministic in `this.*` fields set during construction
- [ ] `transform()` returns nothing meaningful — output is produced via `register` / `insertOperation`
- [ ] `toIdentifier` and `toExportPath` are **pure functions** of `(operation, enrichments)` — no `this`, no async, no environmental reads
- [ ] Cross-generator references use `insertOperation(Other, op).toName()` — never `.toString()`
- [ ] No `Deno.writeFileSync` (or equivalent) in constructors — all output through `register`
- [ ] No `process.env` — `Deno.env.get` only
- [ ] Constructor side effects (`register`, `insertNormalizedModel`) are safe to repeat (the system memoizes; idempotency is required)
- [ ] `OasSchema | OasRef<'schema'>` parameters are narrowed with `.isRef()` before accessing `.type` or `.properties`
- [ ] No `BaseSchema` or similar new base classes added to `OasSchema` variants
- [ ] Enrichment shape declared via Valibot in `enrichments.ts` — not via type-only declaration
- [ ] `isSupported` is a capability predicate — does *not* gate on enrichment presence (filter via `client.json` `include`/`skip` instead)
- [ ] Type-only cross-package imports are tagged `{ name, type: 'type' }` or use `identifier.toImport()` — no bare value imports of types
- [ ] `.toRefName()` is only called inside an `.isRef()` branch — and only if `insertNormalizedModel` won't do the same job
- [ ] Per-type Snippet routers (`toZodValue` / `toTsValue` / equivalent) forward the typed schema — not just modifiers — so constraints survive
- [ ] No reads of `context.settings.enrichments['@other/gen-id']` — cross-generator references use the operation-reference protocol (§3.5)
- [ ] GQL entries: `transform` receives `acc` and returns it; mutation gates use `synthesizeArgsObject(operation)`
- [ ] Schema `switch (schema.type)` is preceded by single-member-intersection unwrap and an `.isRef()` resolve
- [ ] Every static method (`toIdentifier`, `toExportPath`, `toEnrichments`) destructures `variant` from its args; entry callbacks (`transform`, `isSupported`, `toPreviewModule`, `toMappingModule`) too
- [ ] If this generator is **variants-aware**, `toIdentifier` incorporates `variant` (typically via `withVariant`); `toExportPath` produces distinct paths per variant (variant suffix in the filename)
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

1. Implement `isSupported` in `src/mod.ts` (capability gate).
2. Implement `toIdentifier` and `toExportPath` in `src/base.ts`.
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
   `this.settings.enrichments`.
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

1. **`src/base.ts`** — `toIdentifier` reads `variant` and folds it
   into the name via `withVariant(base, variant)`. `toExportPath`
   threads `variant` into the recursive `this.toIdentifier({…,
   variant})` call so each variant lands in its own file.

2. **`src/mod.ts`** — `transform({ context, operation, variant })`
   threads `variant` into `context.insertOperation({ projection,
   operation, variant })`. `toPreviewModule` /
   `toMappingModule` thread `variant` into every static-method call
   they make (`toEnrichments`, `toIdentifier`, `toExportPath`).

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

### Card: Accumulator-style generator (one shared aggregate, many contributors)

When the generator's output is a *single* aggregate that grows as
more operations are visited (a routes table, a registry, a barrel
export), the per-operation Projection isn't the artifact — it
contributes *into* one. Canonical example: `gen-msw`, which builds
a single `toRoutesList` map keyed by the routes it sees.

Shape (`gen-msw/src/mod.ts`):

```ts
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
  const routesList = context.defineAndRegister({
    identifier: Identifier.createVariable('toRoutesList'),
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

This card is the boundary with `skmtc-debug`. Quick checks before
escalating:

1. Is `transform()` returning instead of registering? (Return value is
   discarded.)
2. Does `isSupported` reject the operations you expected? (Check the
   predicate.)
3. Is `client.json#settings.skip` or `include` excluding the
   operations?
4. Is the schema shape what your gate expects? (e.g., gen-shadcn-form
   requires request body `type === 'object'`)

If unresolved → hand off to `skmtc-debug` with verify-first stance.

## 11. Boundary with other skills

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

- Concept docs: [`concepts/projections-and-snippets.md`](../../concepts/projections-and-snippets.md), [`concepts/cross-generator-coordination.md`](../../concepts/cross-generator-coordination.md), [`concepts/the-three-phases.md`](../../concepts/the-three-phases.md), [`concepts/variants.md`](../../concepts/variants.md)
- API reference: [`reference/api/`](../../reference/api/) — full DSL surface
- Per-generator clone seams: [`reference/stock-generators/`](../../reference/stock-generators/)
- Tutorials: [`extending/tutorials/`](../../extending/tutorials/)
- How-tos: [`extending/how-to/`](../../extending/how-to/)
- Recipes: [`extending/recipes/`](../../extending/recipes/)
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
