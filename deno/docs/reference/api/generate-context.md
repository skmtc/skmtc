# GenerateContext

> The Generate-phase context. Owns the file map, orchestrates
> per-generator transforms, mediates cross-generator coordination
> through Drivers, and provides the `register` / `insertOperation` /
> `insertModel` / `insertNormalizedModel` surface that generators use
> to register output.

## Source

`skmtc/deno/core/context/GenerateContext.ts`

## Class

```ts
class GenerateContext implements GenerateContextType {
  document: SkmtcParsedDocument
  settings: ClientSettings | undefined
  logger: Logger
  captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void
  toGeneratorConfigMap: <E = undefined>() => GeneratorsMapContainer<E>
  modelDepth: Record<string, number>

  #files: Map<string, File | JsonFile>     // private
  #previews: Record<string, Preview>       // private
  #mappings: Record<string, Mapping>       // private

  constructor(args: {
    document: SkmtcParsedDocument
    settings: ClientSettings | undefined
    logger: Logger
    captureCurrentResult: ...
    toGeneratorConfigMap: ...
  })

  toArtifacts(stackTrail: StackTrail): GenerateResult
  register(args: RegisterArgs): void
  registerJson(args: RegisterJsonArgs): void
  insertOperation<V, E>(args: InsertOperationArgs<V, E>): Inserted<V, E>
  insertModel<V, E>(projection: ModelProjection<V, E>, refName: RefName, options?: InsertModelOptions): Inserted<V, E>
  insertNormalizedModel<V, S, E>(projection: ModelProjection<V, E>, args: InsertNormalizedModelArgs<S>, options?: InsertNormalizedModelOptions): InsertNormalizedModelReturn<V, S>
  defineAndRegister<V>(args: DefineAndRegisterArgs<V>): Definition<V>
  findDefinition(args: PickArgs): Definition | undefined
  toOperationContentSettings<V, E>(args: ToOperationSettingsArgs<V, E>): ContentSettings<E>
  toModelContentSettings<V, E>(args: BuildModelSettingsArgs<V, E>): ContentSettings<E>
  resolveSchemaRefOnce(refName: RefName, generatorId: string): OasSchema | OasRef<'schema'>
}
```

## Constructor

Constructed internally by `toArtifacts`. Generators receive a
`GenerateContextType` (the interface) on their `transform`'s `context`
parameter — not the class directly.

You won't typically instantiate `GenerateContext` yourself unless
writing engine-level test scaffolding.

## Properties

### `document: SkmtcParsedDocument`

The parsed source document, wrapped in the discriminated union:

```ts
type SkmtcParsedDocument =
  | { type: 'oas', value: OasDocument }
  | { type: 'gql', value: GqlDocument }
```

Generators that target a specific protocol narrow on `document.type`.

### `settings: ClientSettings | undefined`

The user's `client.json#settings` block. May be undefined if no
client.json was loaded (rare; usually settings is populated by the
CLI before passing through).

### `logger: Logger`

The structured logger. Generators rarely log directly — output goes
through the manifest. The logger is used by the engine for trace
events and is occasionally useful for diagnostic logging.

### `captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void`

Called by the engine to record per-item outcomes
(`success | warning | error | skipped | notSupported`) into the
manifest. Generators don't call this directly.

### `toGeneratorConfigMap`

A function returning the configured generator map. Called by
`toArtifacts` to iterate generators. Generators don't call this.

### `modelDepth: Record<string, number>`

Tracking model nesting depth per `(generatorId, refName)` to prevent
infinite recursion. Used by the engine; generators don't read this
directly.

### `#files`, `#previews`, `#mappings` (private)

The accumulated file map (`Map<path, File | JsonFile>`), preview
objects, and mapping objects. Mutated by `register` and the Drivers.
Accessed through public methods like `findDefinition`.

## Methods

### `toArtifacts(stackTrail: StackTrail): GenerateResult`

The engine entry point. Iterates the configured generators, applies
skip/include filters, calls each generator's `transform` for every
matching operation/model, accumulates output. Returns
`{ files, previews, mappings }`.

Generators don't call this — it's invoked by the engine.

### `register(args: RegisterArgs): void`

The primary side-effect API. Registers any combination of imports,
re-exports, and definitions into a target file.

```ts
type RegisterArgs = {
  imports?: Record<string, ImportNameArg[]>
  reExports?: Record<string, Identifier[]>
  definitions?: (Definition | undefined)[]
  destinationPath: string
}
```

**Idempotent.** Imports dedupe via `Set`; definitions first-write-wins
via `File.definitions.has(name)`. Safe to call repeatedly with the
same payload.

Common usage from a Projection constructor:

```ts
this.register({
  imports: {
    'react-hook-form': ['useForm'],
    '@/components/ui/form': ['Form']
  },
  destinationPath: this.settings.exportPath
})
```

### `registerJson(args: RegisterJsonArgs): void`

For files whose destination path ends in `.json`. Registers a JSON
value as the file's content.

```ts
type RegisterJsonArgs = {
  destinationPath: string
  json: unknown
}
```

The destination file must be created as a `JsonFile` (happens
automatically when the path ends in `.json`).

### `insertOperation<V, E>(args: InsertOperationArgs<V, E>): Inserted<V, E>`

Insert a peer operation Projection's output. The Driver computes
the peer's identifier and exportPath, performs the cache lookup,
and either returns the cached Definition or constructs a new one.

```ts
type InsertOperationArgs<V, E> = {
  projection: OperationProjection<V, E>      // class, not instance
  operation: OasOperation | GqlOperation
  destinationPath?: string                    // optional override
  noExport?: boolean
}
```

Returns an `Inserted<V, E>` wrapper with the peer's identifier and
the resulting Definition. Use `.toName()` to get the peer's name for
your template.

Throws `"Registered definition mismatch"` if the cache contains a
definition at the same `(name, exportPath)` from a different
generator.

Generators typically call this through the projection-base wrapper
(`this.insertOperation(Peer, op)`) which auto-fills `destinationPath`
from `this.settings.exportPath`.

### `insertModel<V, E>(projection, refName, options?): Inserted<V, E>`

The model equivalent of `insertOperation`. Routes through
`ModelDriver`.

```ts
insertModel(
  projection: ModelProjection<V, E>,
  refName: RefName,
  options?: { destinationPath?: string, noExport?: boolean }
): Inserted<V, E>
```

Used by model Projections to reference each other (e.g., a Zod
Projection referencing a TypeScript-type Projection for the same
refName).

### `insertNormalizedModel<V, S, E>(projection, args, options?): InsertNormalizedModelReturn<V, S>`

The "either ref or inline schema" entry. Dispatches based on whether
the schema is a `$ref`:

```ts
insertNormalizedModel<V, S extends OasSchema | OasRef<'schema'> | OasVoid, E>(
  projection: ModelProjection<V, E>,
  args: { schema: S, fallbackName: string, destinationPath: string },
  options?: { noExport?: boolean }
): InsertNormalizedModelReturn<V, S>
```

Branches:

- **`schema.isRef()` is true**: routes through `insertModel` using
  the resolved refName. Strict integrity check.
- **`schema.isRef()` is false** (inline schema): caches by
  `(fallbackName, destinationPath)`. **Name-only check** — does not
  verify generator identity (the `#SKM-47` integrity gap).

### `defineAndRegister<V>(args): Definition<V>`

Create a Definition and register it in one call. Used by Drivers;
generators rarely call directly.

```ts
defineAndRegister<V>({
  identifier: Identifier
  value: V
  destinationPath: string
  noExport?: boolean
}): Definition<V>
```

Performs a cache check on `(identifier.name, destinationPath)` first;
returns cached if hit.

### `findDefinition({ name, exportPath }): Definition | undefined`

Cache lookup. Returns the existing Definition or `undefined`.

```ts
findDefinition({ name: string, exportPath: string }): Definition | undefined
```

Used by Drivers as the first step of insert flows. Generators may
call directly when implementing custom coordination.

### `toOperationContentSettings<V, E>(args)`, `toModelContentSettings<V, E>(args)`

Compute `ContentSettings` (identifier + exportPath + enrichments)
for a projection on a given operation/refName. Used by Drivers;
generators rarely call directly.

### `resolveSchemaRefOnce(refName, generatorId): OasSchema | OasRef<'schema'>`

One-step ref resolution from the component bucket, with depth
tracking. Throws `Schema not found` if the refName isn't present.

Used internally during model dispatch; generators reaching for
schemas usually use `OasRef.resolve()` instead.

## Examples

### Inside a Projection constructor

```ts
class MyProjection extends OasOperationProjectionBase<E> {
  bodyTypeName: string
  hookName: string

  constructor(args) {
    super(args)

    // Cross-generator coordination
    const bodyType = this.insertNormalizedModel(TsProjection, {
      schema: args.operation.toRequestBody(({ schema }) => schema),
      fallbackName: `${args.settings.identifier.name}Body`
    })
    this.bodyTypeName = bodyType.identifier.name

    this.hookName = this.insertOperation(TanstackQuery, args.operation).toName()

    // Register imports
    this.register({
      imports: {
        'react-hook-form': ['useForm'],
        '@hookform/resolvers/zod': ['zodResolver']
      }
    })
  }
}
```

### Inside a Snippet

A Snippet has access to `context` directly (no projection-base
wrapper), so it calls `context.insertOperation` with an explicit
`destinationPath`:

```ts
class MyFieldSnippet extends SnippetBase {
  refTargetName?: string

  constructor({ context, schema, destinationPath }) {
    super({ context })

    if (schema.isRef()) {
      const inserted = context.insertNormalizedModel(SomeProjection, {
        schema,
        fallbackName: 'unused-when-ref',
        destinationPath
      })
      this.refTargetName = inserted.identifier.name
    }
  }
}
```

## Common questions

### What's the difference between `context.insertNormalizedModel` and `this.insertNormalizedModel` on a projection base?

Same name, two methods. The one on `GenerateContext` takes an
explicit `destinationPath`. The wrapper on
`OasOperationProjectionBase` / `GqlOperationProjectionBase` /
`ModelProjectionBase` auto-fills `destinationPath` from
`this.settings.exportPath` and forwards to the context method.

### Can I read `#files` directly?

No — it's private. Use `findDefinition` to query the cache. The
private field is private because direct mutation would bypass
deduplication, cache integrity checks, and the `register` contract.

### What happens if `transform` throws?

`#runOasOperationGenerator` (and the GQL/model variants) catches
the throw, marks the per-item result as `'error'` in the manifest,
and continues to the next operation. The error doesn't propagate
to the caller — generator errors are per-item isolated.

### Can I `insertOperation` against a generator that isn't installed?

You'll get a TypeScript error at the import level — the peer
Projection class isn't importable. Cross-generator coordination
requires the peer to be in `deno.json#imports` so its source is
bundled into `worker.ts`.

### How does `register` know which File to register into?

The `destinationPath` argument. If the file doesn't exist yet,
`register` creates it. File creation auto-routes by extension —
`.json` paths create `JsonFile`, everything else creates `File`.

### What's the relationship between `register` and Drivers?

Drivers call `register` (specifically `register({ definitions })`)
as part of their flow. Generators *can* call `register` directly,
but typically reach for `insertOperation` / `insertNormalizedModel`
because those handle the Driver lifecycle (cache check, peer
construction, integrity verification).

Direct `register({ definitions })` bypasses cross-generator
coordination — the Definition exists in the file but isn't
discoverable via `findDefinition` from other generators in the
correct way. Use only for one-off definitions that don't participate
in cross-generator dispatch.

## Related types

```ts
// Return wrapper from insertOperation / insertModel
type Inserted<V, E> = {
  settings: ContentSettings<E>
  definition: GeneratedDefinition<V>
  toName(): string                        // shortcut to settings.identifier.name
}

// Per-item result tracking
type ResultType = 'success' | 'warning' | 'error' | 'skipped' | 'notSupported'

// Engine output
type GenerateResult = {
  files: Map<string, File | JsonFile>
  previews: Record<string, Preview>
  mappings: Record<string, Mapping>
}
```

## See also

- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md) — the memoization model
- [The three phases concept](../../concepts/the-three-phases.md) — pipeline context
- [API: ParseContext](parse-context.md) — what runs before GenerateContext
- [API: RenderContext](render-context.md) — what runs after
- [API: Projection bases](projection-bases.md) — what wraps `insertOperation` etc.
- [API: Definition](dsl-definition.md) — what `register({ definitions })` accepts
- [`skmtc-generator` skill](../../skills/skmtc-generator/SKILL.md) — operational guidance
