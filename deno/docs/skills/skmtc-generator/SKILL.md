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

5. **Two intentional spellings.** `insertNormalisedModel` (British, on
   `GenerateContext`) and `insertNormalizedModel` (American, on
   `OasOperationProjectionBase` / `GqlOperationProjectionBase` — the
   wrapper that auto-fills `destinationPath`). Both correct.

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
| "Fix" the British/American spelling discrepancy | `insertNormalisedModel` and `insertNormalizedModel` are two methods | Two distinct methods, not a typo |

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
  toOasOperationProjectionBase
} from '@skmtc/core'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const MyGenBase = toOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  // ⬇ Customize: how is the generated identifier name derived?
  toIdentifier({ operation }): Identifier {
    const verb = capitalize(toMethodVerb(operation.method))
    const name = `${verb}${camelCase(operation.path, { upperFirst: true })}`
    return Identifier.createVariable(name)
  },

  // ⬇ Customize: where does the generated file land?
  toExportPath({ operation, enrichments }): string {
    const { name } = this.toIdentifier({ operation, enrichments })
    return join('@', 'my-gen', `${name}.generated.ts`)
  }
})
```

Both `toIdentifier` and `toExportPath` **must be pure functions** of
their inputs. No `this`-side state, no async. The cross-generator cache
depends on this property.

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
  isSupported({ operation }: IsSupportedOasOperationConfigArgs<EnrichmentSchema>) {
    return ['post', 'put', 'patch'].includes(operation.method) &&
      operation.requestBody?.resolve()?.toSchema()?.resolve().type === 'object'
  },

  // ⬇ The hook the engine calls per matched operation.
  transform({ context, operation }) {
    context.insertOperation({ projection: MyGen, operation })
  },

  toEnrichmentSchema
})

export default MyGenEntry
```

The return value of `transform` is discarded. All output must go
through `register` / `insertOperation` / `insertNormalizedModel`.

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
| Export path | `gen-x/src/base.ts` → `toExportPath` | Edit the `join('@', ...)` call |
| Identifier naming convention | `gen-x/src/base.ts` → `toIdentifier` | Edit the name-building expression |
| Peer dependency (e.g., HTTP layer) | `gen-x/src/<Main>.ts` top imports | Swap the import target (e.g., `gen-tanstack-query-supabase-zod` → `gen-tanstack-query-fetch-zod`) |
| Consumer-side component path | `gen-x/src/fields/<X>.ts` `register` call | Change the import key |
| Capability gate | `gen-x/src/mod.ts` → `isSupported` | Change the predicate |
| Enrichment schema | `gen-x/src/enrichments.ts` | Add Valibot fields |
| Field-type dispatch (form generators) | `gen-x/src/schemaToField.ts` | Add a branch for the new schema shape |

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
// ✅ RIGHT
constructor(args) {
  super(args)
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
// ❌ WRONG — register is already idempotent
if (!this.context.findDefinition({ name, exportPath })) {
  this.register({ definitions: [def], destinationPath })
}

// ✅ RIGHT
this.register({ definitions: [def], destinationPath })
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

## 9. Verification checklist

After writing or editing a generator, verify:

- [ ] All imports go through `this.register({ imports, destinationPath })` — no raw `import` statements in template literals
- [ ] No `as` casts in non-test code — narrowing uses type guards or discriminant checks
- [ ] Identifier names come from `Identifier.createVariable` / `createType` — no raw strings as identifiers
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

If any box is unchecked, refactor before moving on. The skill loaded
into context cannot enforce these mechanically; the LLM applying them
is the only enforcement.

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
2. Edit `src/schemaToField.ts` — add a branch dispatching to `MyInput`
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

- Concept docs: [`concepts/projections-and-snippets.md`](../../concepts/projections-and-snippets.md), [`concepts/cross-generator-coordination.md`](../../concepts/cross-generator-coordination.md), [`concepts/the-three-phases.md`](../../concepts/the-three-phases.md)
- API reference: [`reference/api/`](../../reference/api/) — full DSL surface
- Per-generator clone seams: [`reference/stock-generators/`](../../reference/stock-generators/)
- Tutorials: [`extending/tutorials/`](../../extending/tutorials/)
- How-tos: [`extending/how-to/`](../../extending/how-to/)
- Recipes: [`extending/recipes/`](../../extending/recipes/)
- Design philosophy: [`explanation/design-philosophy.md`](../../explanation/design-philosophy.md), [`explanation/why-clone-to-customize.md`](../../explanation/why-clone-to-customize.md)
- Consolidated LLM reference: [`llms.md`](../../llms.md) — the operational principles in §4 are mirrored from `llms.md`'s canonical version
