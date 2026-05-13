# How idempotency works

> Why generator order doesn't affect output — and what the system
> would have to break for that to stop being true.

## The question

A code generator pipeline that runs multiple generators against
the same schema typically has to answer: **what if two generators
want to produce the same thing?** In SKMTC, two generators producing
`Foo` schemas in the same file converge on one definition — the
file ends up with one `export const foo = ...`, not two.

Even more strongly: **the order in which the generators run
doesn't matter**. Running `gen-zod` before `gen-shadcn-form`
produces the same output as running them in the reverse order.

How does this work? And what invariants does it rest on?

## The short answer

Cross-generator coordination is **memoization**. Every
`insertOperation` / `insertModel` / `insertNormalizedModel` call
is keyed by `(identifier.name, exportPath)`. If an entry with
that key already exists, the existing entry is returned; if not,
a new one is created.

For this to work, two invariants must hold:

1. **`identifier.name` and `exportPath` are pure functions of
   input.** Two generators producing a `Foo` schema in the same
   destination derive the same key.
2. **`register`'s side effects are idempotent** — `Set` for
   imports, `Map.has` for definitions. Repeated calls converge on
   the same state.

These two together make order irrelevant. The system *can't*
allow order to matter.

## The invariants that combine

### Identifier and exportPath are pure functions

The cache key is `(identifier.name, exportPath)`. Both come from
config fields supplied to the projection-base factory. From the
stock `gen-zod/src/base.ts`:

```ts
import {
  camelCase,
  decapitalize,
  Identifier,
  toModelProjectionBase,
} from '@skmtc/core'
import { join } from '@std/path'
import denoJson from '../deno.json' with { type: 'json' }

export const ZodBase = toModelProjectionBase({
  id: denoJson.name,

  toIdentifier({ refName }): Identifier {
    const name = decapitalize(camelCase(refName))
    return Identifier.createVariable(name)
  },

  toExportPath({ refName, enrichments }): string {
    const { name } = this.toIdentifier({ refName, enrichments })
    return join('@', 'types', `${decapitalize(name)}.generated.ts`)
  },
})
```

`ZodProjection` (in a separate file) extends `ZodBase` — the
factory result — and provides the per-instance `toString()`. The
factory wires `toIdentifier` and `toExportPath` onto the class
as statics so the cache key can be computed without
instantiating.

`toIdentifier` and `toExportPath` are **pure functions** of
their inputs. Given the same `refName`, they return identical
identifier names and paths. No mutation, no random suffixes, no
timestamps.

This is the load-bearing property. If `toIdentifier` were
non-deterministic — say, by including a timestamp or a random
ID — the cache would never hit. Each call would produce a fresh
key; each entry would be unique; the file would accumulate
duplicates.

The purity invariant is enforced by convention, not by the type
system. A generator author *could* write a non-pure
`toIdentifier`. Doing so would silently break idempotency.

### Cache key uses both deterministically

`GenerateContext.findDefinition({ name, exportPath })` searches
by exactly those two fields. The check is:

```ts
findDefinition({ name, exportPath }): Definition | undefined {
  const file = this.#files.get(exportPath)
  if (!file) return undefined
  return file.definitions.get(name)
}
```

A `Map.get` lookup, nothing more. The first registration with a
given key wins; subsequent ones return the existing entry.

The `(name, exportPath)` pair is the **only** dimension along
which definitions can collide. Two definitions with the same
name but different paths are independent. Two definitions with
different names in the same path are independent. Same name,
same path → same definition.

### `register`'s side effects are idempotent

Generators contribute to a file via `register({ imports,
destinationPath, definitions })`. Each piece of state register
manages is idempotent:

- **Imports** accumulate into `Map<module, Set<importNameKey>>`.
  A `Set` is order-insensitive and duplicate-rejecting. Registering
  the same import twice produces one entry.
- **Definitions** are added via `Map.set`, gated by `Map.has`.
  If a definition with the given identifier name already exists,
  the register call doesn't overwrite it. First-writer-wins.

The two together mean **register is safe to call multiple times
with the same arguments**. The file's state converges on one
correct value regardless of how many generators contribute it.

## Walking through a concrete scenario

Two generators, two orderings, identical output.

The setup: `gen-shadcn-form` produces a form for `CreateUser`.
Inside its `toString()`, it calls
`insertNormalizedModel(ZodProjection, { schema: userBodySchema })`.
`gen-zod` independently iterates all schemas and produces the same
`userBody` Zod schema. We want the file to end up with one
`userBody` definition either way.

### Order A: gen-zod first

1. The engine iterates generators. `gen-zod` runs first.
2. `gen-zod`'s `transform({ refName: 'User' })` calls
   `context.insertModel(ZodProjection, 'User')`.
3. Driver calls `findDefinition({ name: 'user', exportPath:
   '@/types/user.generated.ts' })`. Not found.
4. Driver creates a `ZodProjection` instance, wraps it in a
   `Definition`, and registers it. File map now contains
   `user.generated.ts → { user: Definition }`.
5. `gen-shadcn-form` runs. Its `transform` calls `insertOperation`,
   which constructs the form Projection.
6. Form Projection's `toString()` calls
   `insertNormalizedModel(ZodProjection, { schema: userBodySchema,
   fallbackName: 'createUserBody' })`.
7. The schema *is* a ref to the `User` component. Driver derives
   key `('user', '@/types/user.generated.ts')`.
8. `findDefinition` returns the existing entry from step 4. No
   new Projection is constructed.
9. Form Projection records the import (`import { user } from
   '@/types/user.generated.ts'`) and references `user` in its
   output.

Final state: one `userBody` definition, imported by the form.

### Order B: gen-shadcn-form first

1. The engine iterates. `gen-shadcn-form` runs first.
2. `gen-shadcn-form`'s `transform` constructs the form Projection.
3. Form Projection's `toString()` calls
   `insertNormalizedModel(ZodProjection, { schema: userBodySchema })`.
4. `findDefinition({ name: 'user', exportPath:
   '@/types/user.generated.ts' })`. Not found.
5. Driver creates a `ZodProjection` instance, wraps it in a
   `Definition`, registers it. File map now contains
   `user.generated.ts → { user: Definition }`.
6. Form Projection records the import.
7. `gen-zod` runs. Its `transform({ refName: 'User' })` calls
   `context.insertModel(ZodProjection, 'User')`.
8. Driver derives key `('user', '@/types/user.generated.ts')`.
9. `findDefinition` returns the existing entry from step 5. No
   new Projection is constructed.

Final state: one `userBody` definition, imported by the form.

### Result: identical `#files` map

Both orderings produce the same `#files` map. The Render phase
walks the map and produces the same strings. The only observable
difference between the runs is in log line ordering, not output.

The cache makes order irrelevant *by construction*. Generators
don't need to know about each other's existence. They can be
written and tested in isolation.

## Edge cases

### Same-name collisions across generators

What if two unrelated generators independently produce a `Foo`
definition in the same file? It depends on the insertion path:

- **Driver path** (`insertModel`, `insertOperation`,
  `insertNormalizedModel`): the second writer throws
  `Registered definition mismatch` via `affirmDefinition`
  (`core/dsl/operation/oas/OasOperationDriver.ts:129`,
  `GqlOperationDriver.ts:129`, `model/ModelDriver.ts:137`).
  The collision is loud.
- **Bare `register({ definitions })` path**: silent
  first-write-wins via `Map.has`. The second is dropped.

This is a known sharp edge. Two scenarios where it happens:

1. **Two generators with overlapping scope** (e.g., two different
   schema generators producing the same `User` definition). The
   first to run wins. The user typically doesn't want both
   anyway, so the collision is harmless if benign.
2. **Two generators using `fallbackName` for unrelated inline
   schemas** (see below).

The engine doesn't warn about same-name overwrites. A future
improvement would add a diagnostic for this case.

### Inline-schema fallback names

`insertNormalizedModel(ZodProjection, { schema, fallbackName })`
accepts either an `OasSchema | OasRef | OasVoid`. The two cases
differ:

- **Ref**: the schema *is* a ref. The Driver routes through the
  model cache using the ref's name. Strict integrity — multiple
  generators referring to the same component converge.
- **Inline schema** (no ref): there's no canonical name. The
  Driver uses `fallbackName` to derive the cache key.

The integrity gap: two generators independently passing different
`fallbackName`s for the *same* inline schema will produce two
separate definitions. The system can't tell that they're "the
same" without a name.

This is tracked as `#SKM-47` in the [status and roadmap](status-and-roadmap.md).
The mitigation: generator authors should prefer refs when
possible; the spec author should hoist commonly-used inline
schemas to components.

### Pure functions that aren't really pure

A generator's `toIdentifier` could depend on context state
(e.g., reading `this.context.someState`), accidentally violating
purity. The cache would then miss inconsistently — sometimes
hitting, sometimes missing, depending on what state had been
mutated when.

Anti-pattern; the operational principles in
[`llms.md`](../llms.md) call this out explicitly. Generator
authors should treat `toIdentifier` and `toExportPath` as pure
functions of their inputs.

### Memoization can't work if `toString()` is non-pure

The cache returns existing `Definition` instances. Their `value`
is a Projection. The Projection's `toString()` is called once at
Render time. If a generator's `toString()` reads state that
changed between calls, the output could vary.

In practice this is rare — Projection state is initialized at
construction (via the constructor args) and immutable thereafter.
But the failure mode exists for generator authors who write
`this.someField = newValue` in `toString()`.

## See also

- [Cross-generator coordination concept](../concepts/cross-generator-coordination.md) —
  the practical walkthrough
- [Why three phases](why-three-phases.md) — Generate's invariant
  is one of three
- [API: GenerateContext](../reference/api/generate-context.md) — the
  `register`, `findDefinition`, `insertModel`, `insertOperation`
  surface
- [API: ContentSettings](../reference/api/content-settings.md) — what the
  cache key is derived from
- [Status and roadmap](status-and-roadmap.md) — `#SKM-47` and
  related known limitations
- [Design philosophy](design-philosophy.md) — idempotency as a
  load-bearing principle
