# How generators produce output

> Two facts that flip the default mental model from other codegen
> tools: `transform` is a fire-and-forget hook (its return value
> does not produce artifacts), and Projection classes are
> instantiated *on demand* by `insert*` calls (writing a Projection
> class does not, by itself, cause it to run). Output is produced by
> side-effect through `context.register` and `context.insert*`.

The whole mechanism in one page:
[Definitions and files](definitions-and-files.md). This page deepens
its producer side.

If you have written generators for other tools (orval,
openapi-generator, kubb, graphql-codegen) you probably expect the
following: the engine walks the schema, calls your transform for
each item, and writes whatever your transform returns to disk.
Maybe with templates as the rendering step. SKMTC works
differently in two specific ways that, if missed, lead to silent
no-output bugs no error message will ever explain.

## The one-line definition

`GenerateContext.toArtifacts` walks `(generator × item × variant)`
and calls `generatorConfig.transform({ context, operation | refName,
variant })` on each. **`transform` returns `void` — the engine does
nothing with a return value.** All artifact production happens through
side effects on `context` — `register`, `insertOperation`,
`insertModel`, `insertNormalizedModel`. A Projection class is
instantiated only when one of the `insert*` calls reaches its Driver;
a Projection that nobody asks for is never constructed.

## What `GenerateContext.toArtifacts` actually does

`GenerateContext.toArtifacts` (`core/context/GenerateContext.ts:275`)
iterates the configured generators in order. For each one, it
routes by `type` to one of three per-generator loops:

- `#runOasOperationGenerator` (line 376) — over `oasDocument.operations`
- `#runGqlOperationGenerator` (line 437) — over `gqlDocument.operations`
- `#runModelGenerator` (line 472) — over schema refNames

Each loop is a nested `forEach` — over items, then over each item's
variants — that calls `transform` per `(item, variant)`:

```ts
// core/context/GenerateContext.ts (OAS variant, simplified)
oasDocument.operations.forEach(operation => {
  const variants = toVariantList({ context: this, id, operation })
  variants.forEach(variant => {
    stackTrail.trace(`${operation.path}:${operation.method}`, st => {
      try {
        if (!isSupported(...)) {
          this.captureCurrentResult('notSupported', st)
          return
        }
        if (filteredByInclude || filteredBySkip) {
          this.captureCurrentResult('skipped', st)
          return
        }
        generatorConfig.transform({ context: this, operation, variant })
        // ... preview/mapping hooks
        this.captureCurrentResult('success', st)
      } catch (error) {
        this.logger.error(error)
        this.captureCurrentResult('error', st)
      }
    })
  })
})
```

Notice what is **not** here:

- The iteration never constructs a Projection. There is no
  `new SomeProjection(...)` anywhere in this loop.
- The iteration does not look at what `transform` returned. `transform`
  is typed to return `void`; the loop captures only a per-item
  *result status* (`'success'` / `'skipped'` / …), never a value.

Output is whatever `transform` did to `context` during its
execution. If `transform` didn't call `register` or `insert*`,
nothing is produced. The item is still marked `'success'` in the
manifest — successful execution, no artifact.

## Why `transform` returns nothing

`transform` is typed `(...) => void`. If you have written generators
for map/fold-shaped tools, the instinct is to *return* your output and
let the engine write it — here, nothing you `return` reaches the
output. Everything a generator produces, it produces by calling
`register` / `insert*` on `context`. Cross-item state, if a generator
needs it, lives on the generator's own module scope or on `context`.

## Where output actually comes from

Three channels on `GenerateContext`, all called via side effect:

### `context.register({ destinationPath, imports?, definitions?, reExports? })`

The lowest-level registration API
(`core/context/GenerateContext.ts:1133`). Takes pure data
(`imports: ImportBase[]`, `reExports: ReExportBase[]`,
`definitions`) and mutates the file at `destinationPath` — which
must already exist; `register` never creates files and throws on a
miss (callers pre-create through their language, e.g. the
lang-typescript register function):

- `definitions` are added via the file's `addDefinition`
  (first-write-wins per declaration slot)
- `imports` are merged via the file's `addImports` (per-module merge)
- `reExports` are merged via the file's `addReExports`

A generator that needs full control can build a `Definition`
itself and register it directly. Stock generators rarely do this
for primary artifacts — they go through the projection-base
wrappers — but they often register raw `imports` for peer
dependencies.

### `context.insertOperation({ projection, operation })` and `context.insertModel(MyProjection, refName)`

(`insertOperation` takes a single object argument; `insertModel` is
positional — `insertModel(projection, refName, options?)`.)

The cross-generator coordination APIs. Both delegate to a Driver
class (`OasOperationDriver`, `GqlOperationDriver`, `ModelDriver`)
that:

1. Computes `settings = { identifier, exportPath, enrichments }`
   from the Projection's static `toIdentifierName` / `toIdentifierType` /
   `toExportPath` / `toEnrichments` methods.
2. Looks up `(identifier.name, exportPath)` in the
   `currentFile.definitions` cache.
3. **On cache miss:** constructs `new MyProjection({ context,
   operation/refName, settings, destinationPath })` — this is
   where the Projection class is actually instantiated — wraps the
   value in a `Definition`, and registers it.
4. **On cache hit:** runs `affirmDefinition` integrity check
   (matches `generatorKey`, `value instanceof projection`); returns
   the cached `Definition`.
5. Stitches an import into `destinationPath` if it differs from
   `settings.exportPath`.

Both return an `Inserted` carrying `settings` and `definition`. The
calling generator typically uses `inserted.toName()` to splice the
peer's identifier name into its own template. (`insertNormalizedModel`,
below, returns the underlying `Definition` instead — it has
`.identifier` / `.value`, not `.toName()`.)

### `context.insertNormalizedModel(MyProjection, { schema, fallbackName, destinationPath })`

For inline schemas (not addressable by `$ref`). If the schema is
a `$ref`, delegates to `insertModel`; otherwise registers a one-off
`Definition` under `fallbackName` via the projection's
`schemaToValueFn` (`core/context/GenerateContext.ts:752-798`).

## Projections are pull-based

The Projection class **does nothing on its own**. Defining
`export class MyProjection extends MyBase ...` in `mod.ts`
(where `MyBase = toTsOasOperationProjectionBase({...})` is the
factory-built base from `base.ts`) makes the class available; it
does not register the class with the engine or arrange for it to
be called.

The only thing the engine calls is `transform`. If `transform`
doesn't ask for the Projection, the constructor never runs:

```ts
// In your generator's mod.ts
export default toOasOperationEntry({
  id: '@my/gen-thing',
  toEnrichmentSchema: () => emptyEnrichmentSchema,
  transform: ({ context, operation, variant }) => {
    // This call is what causes MyProjection's constructor to fire.
    // Without it, MyProjection is a class that the engine never instantiates.
    context.insertOperation({
      projection: MyProjection,
      operation
    })
  }
})
```

The same Projection class can be instantiated from multiple
directions:

- Your own `transform` calls `insertOperation({ projection: MyProjection, operation })`.
- A *peer* generator's `transform` calls `insertOperation({ projection: MyProjection, operation })`
  because it needs your output (cross-generator coordination).
- Another Projection's constructor calls `this.insertOperation({ projection: MyProjection, operation })`
  recursively.

Whichever call is *first* hits the cache miss and triggers the
constructor. Subsequent callers hit the cache and reuse the result.
The `(identifier.name, exportPath)` cache key is what makes this
order-independent — see [cross-generator-coordination.md](cross-generator-coordination.md).

## Silent failure modes

These are the most common authoring mistakes. None produces an
error message; you have to *know* to check.

### "I wrote a Projection, generation succeeded, no file appeared"

The `transform` didn't call `insertOperation` / `insertModel` /
`insertNormalizedModel`. The Projection class is defined; the
engine has no reason to construct it. Add the `insert*` call in
`transform`.

The manifest will show `'success'` for the item (transform
executed without throwing) and an empty (or missing) entry for the
expected file in `files`. If you see "success but no output," this
is almost always the cause.

### "I returned the Definition from transform and got no output"

```ts
transform: ({ context, operation, variant }) => {
  return new TsDefinition({ ... })  // ← discarded
}
```

`transform` returns `void`; the return value is ignored, not used for
output. Replace with `register({ definitions: [...], destinationPath: ... })`
or `insertOperation(...)`.

### "Imports show up in the file body, not at the top"

```ts
override toString(): string {
  return `
    import { z } from 'zod'      // ← lands in the body
    export const ${name} = ${value}
  `
}
```

Imports written inline in a template literal end up in the file
body, after the imports header that `File.toString()` produces.
They also bypass the dedup pass on `currentFile.imports` so the
same import can repeat. The fix is to register imports via
`context.register({ imports, destinationPath })` or, for projection
bases, via the constructor: the `Snippet` registers its own
dependencies in its constructor.

### "Definition appears twice in the same file"

Probably a non-pure `toIdentifierName` or `toExportPath` — same input
producing different output across calls. The cache splits into two
entries. See [cross-generator-coordination.md](cross-generator-coordination.md#identifier-and-exportpath-are-pure-functions).

### "`Registered definition mismatch`"

A Driver hit the cache, looked up `(identifier.name, exportPath)`,
found a Definition whose `generatorKey` doesn't match what the
current `insert*` call computed. Two different generators landed
on the same `(name, exportPath)` pair. Either rename one or change
its export path so the keys differ. See
`core/dsl/model/ModelDriver.ts:124-144` for the check.

## Related invariants

### `toString()` must be pure

`Definition.toString()` is called multiple times — at least once
for the final serialization, plus during preview/integrity hooks. Generators
that mutate `this` inside `toString()` get inconsistent output.
Set state in the constructor; `toString()` should be a pure
function of `this` at the time it's called.

If you find yourself wanting to compute something in `toString()`,
either compute it in the constructor and store it on `this`, or
compute it in a getter that's referentially transparent for the
lifetime of the instance.

### `register({ imports })` is the only legitimate way to add imports

Why the API channel exists at all when template literals can write
`import` statements: `currentFile.imports` is a
`Map<module, Set<name>>`. Registration mutates the Set, which:

- Dedupes automatically across multiple calls.
- Renders into a single import statement per module at file
  serialization time.
- Cooperates with `verbatimModuleSyntax`-aware rendering through
  the `Identifier`'s entity-type tag.

None of that happens for imports written inline in a template. The
inline version *looks* like it works (the output file has the
import line) but the line ends up in the body, not deduped, and
not entity-type-aware.

### `transform` runs once per item; the Projection constructor runs once per cache key

The `toArtifacts` loop is per-item. The Projection's constructor
is per-cache-key. If two iterations of `transform` ask for the
same `(identifier.name, exportPath)` Projection, the constructor
runs once. If three peer generators all ask for the same
Projection, the constructor runs once. The relationship between
how many `transform` calls happen and how many constructor calls
happen is mediated by the cache.

## Common questions

### How does the engine know which generators to run?

The `toGeneratorConfigMap` argument to `toArtifacts` returns a
`Record<generatorId, GeneratorConfig>`. `toArtifacts` iterates
`Object.values(map)`. Each config carries a `type` field
(`'oasOperation' | 'gqlOperation' | 'model'`) and `toArtifacts`
routes by that.

A generator's `mod.ts` exports a config produced by
`toOasOperationEntry`, `toGqlOperationEntry`, or `toModelEntry`.
The exported config is what populates the map.

### Can I produce output without a Projection?

Yes. A generator whose `transform` calls `context.register({
definitions: [new TsDefinition({...})], destinationPath })` directly
produces output without ever defining a Projection class.
Projections give you (a) cross-generator coordination via the
`(name, exportPath)` cache and (b) the `insertOperation` /
`insertModel` convenience for peers. If you need neither, raw
`register` is enough.

### What if I throw from `transform`?

`toArtifacts` catches it (`GenerateContext.ts:428-432`), logs to
`logger.error`, and marks the item `'error'` in the manifest
results. Siblings continue. The throw does not propagate out of
the generator's pass.

### What if I throw from a Projection's constructor?

The throw propagates out of the `new MyProjection(...)` call
inside the Driver, up through `insertOperation` / `insertModel`,
into whatever `transform` called it — and is caught by
`toArtifacts`'s outer try/catch. Same outcome: item marked
`'error'`, siblings continue.

### What's the order of operations within one `transform` call?

```
transform({ context, operation, variant }) {
  context.insertOperation({ projection: MyProjection, operation })
    └─ Driver computes settings (calls projection.toIdentifierName, toExportPath)
       └─ Cache lookup on (name, exportPath)
          └─ MISS: new MyProjection({ context, operation, settings, destinationPath })
             └─ Projection constructor runs; may call insertNormalizedModel,
                register({ imports }), or recursive insertOperation
             └─ Projection's value is wrapped in Definition
             └─ context.register({ definitions: [definition], destinationPath: exportPath })
          └─ HIT: affirmDefinition integrity check, return cached
       └─ If destinationPath !== exportPath, stitch an import into destinationPath
    └─ Returns Inserted<V, EnrichmentType>
  // nothing returned — output was produced by the insertOperation side effect
}
```

The Projection's constructor is where most of the "real work"
happens — it produces the value (the `Definition.value`) and
registers its own dependencies (peer Projections, peer imports).

### Does `transform` need to be synchronous?

Yes. `toArtifacts`'s generate loop is synchronous. Generators that
need async work (e.g., HTTP enrichment fetches) must complete
before the Generate phase — typically by pre-computing enrichments
at config time. The Worker boundary is also synchronous-message;
no top-level await of network calls from `transform`.

### Why is `toArtifacts` push-and-discard rather than push-and-collect?

Side effects on `context` accumulate into a single file map. A
collect-and-merge approach would require `transform` to return
*structured* output (something the engine could fold into the file
map), which means the engine would have to know about file paths,
import dedup, the projection cache, and the type-system. Side
effects through the API channels keep that knowledge in `context`
and let `transform` stay shaped however the generator author
wants.

## Further reading

- [Composing output with Stringable](stringable-composition.md) —
  how the values registered here compose into rendered output
- [Files, deduplication, and integrity](files-and-dedup.md) — what
  `register` mutates, the dedup rules for the three file maps,
  and the `generatorKey` integrity check that surfaces
  "Registered definition mismatch"
- [The type system](the-type-system.md) — the
  `schemaToValueFn` contract that `insertNormalizedModel` invokes
  for inline schemas
- [Cross-generator coordination](cross-generator-coordination.md)
  — how the `(name, exportPath)` cache makes generator order
  irrelevant
- [Projections and Snippets](projections-and-snippets.md) — the
  two-level DSL: file-scoped artifacts vs embedded fragments
- [The three phases](the-three-phases.md) — where the Generate
  phase sits in the pipeline
- [Error handling philosophy](error-handling-philosophy.md) — how
  per-item throws become manifest entries, not crashes
- [The manifest](the-manifest.md) — where `toArtifacts`'s per-item
  `results` and the generators' `previews` / `mappings` land for
  tooling
- [Recipe: composing multi-generator stacks](../authoring/recipes/composing-multi-generator-stacks.md)
  — the pattern walked end-to-end via `gen-shadcn-form` and
  `gen-shadcn-table`
- [API: GenerateContext](../reference/api/generate-context.md) —
  full method signatures for `register`, `insertOperation`,
  `insertModel`, `insertNormalizedModel`
- [API: Projection bases](../reference/api/projection-bases.md) —
  the factory pattern for the three Projection base classes
