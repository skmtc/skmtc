# Projection bases

> The three base classes for file-level Projections:
> `ModelProjectionBase`, `OasOperationProjectionBase`,
> `GqlOperationProjectionBase`. Constructed via factory functions
> that bind the generator's required static methods.

A "Projection" is a named, file-level generated artifact. The three
projection bases differ in what input they're parameterized over —
schema components (`ModelProjectionBase`), OAS operations
(`OasOperationProjectionBase`), or GraphQL operations
(`GqlOperationProjectionBase`) — but share the same instance API.

## Source

- `skmtc/deno/core/dsl/model/ModelProjectionBase.ts`
- `skmtc/deno/core/dsl/operation/oas/OasOperationProjectionBase.ts`
- `skmtc/deno/core/dsl/operation/gql/GqlOperationProjectionBase.ts`

Plus factory functions:

- `toOasOperationProjectionBase`
- `toGqlOperationProjectionBase`
- `toModelProjectionBase`

## The three bases

| Base | Source unit | Use for |
|---|---|---|
| `ModelProjectionBase` | A schema component (`refName`) | Generators that produce one file per type / schema (gen-typescript, gen-zod) |
| `OasOperationProjectionBase` | An OAS operation (path + method) | Generators that produce one file per endpoint (gen-shadcn-form, gen-tanstack-query) |
| `GqlOperationProjectionBase` | A GraphQL operation | GraphQL-side generators (`gen-reapit-graphql-client`) |

All three extend `SnippetBase`, so Projections are technically
Snippets — but with substantial additional structure (static
methods, settings, projection-base convenience methods).

## Common shape

Each projection base, when constructed via its factory, provides:

### Factory config object

You hand this object to the factory (e.g.
`toOasOperationProjectionBase(config)`). Required vs optional
matches the source type (`toOasOperationProjectionBase.ts:18–30`):

```ts
{
  id: string                              // required — generator package name
  toIdentifier: (args) => Identifier      // required — pure function: name from input
  toExportPath: (args) => string          // required — pure function: file path from input
  toEnrichmentSchema?: () => ValibotSchema  // optional — declare accepted enrichment shape
  isSupported?: (args) => boolean         // optional — defaults to `() => true`
}
```

- **`toIdentifier`** and **`toExportPath`** are *load-bearing pure
  functions*. They produce the cache key for cross-generator
  coordination. Same inputs → same key.
- **`toEnrichmentSchema`** returns the Valibot schema declaring
  what enrichment fields this generator accepts. Omit for
  generators with no enrichments — the factory defaults to
  `v.optional(v.unknown())` and the parse succeeds on any payload.
- **`isSupported`** is the family-level applicability predicate.
  Omit to advertise support for every item.

Note: **`toEnrichments` is not a config field.** The factory
builds it from `toEnrichmentSchema` and the project's
`enrichments` settings and exposes it as a class static (see below).

### Class statics produced by the factory

The factory returns a class with the following statics
(`toOasOperationProjectionBase.ts:48–66`):

| Static | Source |
|---|---|
| `id` | `config.id` |
| `type` | factory-hardcoded discriminator (`'oasOperation'`, `'gqlOperation'`, or `'model'`) |
| `toIdentifier` | `config.toIdentifier` |
| `toExportPath` | `config.toExportPath` |
| `isSupported` | `config.isSupported ?? (() => true)` |
| `toEnrichments` | factory-built; reads from `context.settings.enrichments.<id>.…` (path depends on `type`) and parses against `config.toEnrichmentSchema?.()` |

The `type` static is the discriminator the engine's dispatcher
reads to route entries against the right protocol — operation
generators built via the OAS factory only fire on OAS documents,
GraphQL ones only on GraphQL documents.

### Instance properties

- `context: GenerateContextType` — inherited from SnippetBase
- `settings: ContentSettings<EnrichmentType>` — computed by the
  Driver. Has `identifier`, `exportPath`, `enrichments`.
- `operation: OasOperation | GqlOperation` (operation bases only) —
  the source operation.
- `refName: RefName` (model base only) — the source schema's refName.
- `generatorKey: GeneratorKey` — composite of generator id and
  operation/refName. Used by `affirmDefinition` for cache integrity.

### Instance methods

The projection-base convenience layer that auto-fills
`destinationPath` from `this.settings.exportPath`:

```ts
insertOperation<V, E>(
  projection: OperationProjection<V, E>,
  operation: OasOperation | GqlOperation,
  options?: { noExport?: boolean }
): Inserted<V, E>

insertModel<V, E>(
  projection: ModelProjection<V, E>,
  refName: RefName,
  options?: { noExport?: boolean }
): Inserted<V, E>

insertNormalizedModel<V, S, E>(
  projection: ModelProjection<V, E>,
  args: { schema: S, fallbackName: string },  // ← no destinationPath needed
  options?: { noExport?: boolean }
): InsertNormalizedModelReturn<V, S>

defineAndRegister<V>(
  args: { identifier: Identifier, value: V, noExport?: boolean }  // ← no destinationPath
): Definition<V>
```

These delegate to the corresponding methods on `GenerateContext`,
filling in `destinationPath: this.settings.exportPath`. Generator
code typically uses these wrappers rather than the underlying
context methods directly.

### `register` is overridden on Projection bases — the signature is different from SnippetBase

Each projection base overrides `register` with a narrower signature
than the one on `SnippetBase`. The two signatures are not
interchangeable, and the difference is enforced at typecheck time.

```ts
// SnippetBase.register — takes RegisterArgs (caller passes destinationPath)
class SnippetBase {
  register(args: RegisterArgs): void {
    this.context.register(args)
  }
}

// OasOperationProjectionBase.register — takes BaseRegisterArgs (no destinationPath)
class OasOperationProjectionBase extends SnippetBase {
  override register(args: BaseRegisterArgs): void {
    this.context.register({
      ...args,
      destinationPath: this.settings.exportPath
    })
  }
}
```

`BaseRegisterArgs` (`core/context/generateTypes.ts:138`) has
`imports?`, `reExports?`, `definitions?` — and *no* `destinationPath`.
`RegisterArgs` (`core/context/generateTypes.ts:255`) extends
`BaseRegisterArgs` with `destinationPath: string`.

Mechanical consequence on a Projection:

```ts
class MyProjection extends MyGenBase {
  constructor(args) {
    super(args)

    // ✅ Correct: no destinationPath. The wrapper fills it.
    this.register({
      imports: { 'my-runtime-lib': ['someHelper'] }
    })

    // ❌ Fails typecheck: TS2353 — Object literal may only specify
    //   known properties, and 'destinationPath' does not exist in
    //   type 'BaseRegisterArgs'.
    this.register({
      imports: { 'my-runtime-lib': ['someHelper'] },
      destinationPath: this.settings.exportPath
    })
  }
}
```

The Projection override removes the caller's ability to choose
`destinationPath` because a Projection has a single legitimate target
file — its own `settings.exportPath`. Letting the caller pass a
different path would let a Projection register against a File it
doesn't own, breaking the Projection-owns-its-File invariant.

`ModelProjectionBase` and `GqlOperationProjectionBase` apply the same
override. Snippets keep the full `RegisterArgs` signature because they
have no `settings.exportPath`; the parent that embeds the Snippet
must supply `destinationPath` explicitly.

#### Refactor signal at the API boundary

Promoting a Snippet to a Projection means removing every
`destinationPath:` field from the class's `register({ ... })` calls.
TypeScript surfaces this as TS2353 at each call site, exactly where
the edit is needed.

## Factory functions

The factories take a configuration object and return a class
constructor. Generator authors call the factory to produce a base
class, then extend it.

### `toOasOperationProjectionBase<E>(config): typeof OasOperationProjectionBase<E>`

```ts
export const MyGenBase = toOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,                                       // generator package name
  toEnrichmentSchema,                                       // import from enrichments.ts

  toIdentifier({ operation }): Identifier {
    // Pure function of the operation
    return Identifier.createVariable(deriveName(operation))
  },

  toExportPath({ operation, enrichments }): string {
    // Pure function of (operation, enrichments)
    const { name } = this.toIdentifier({ operation, enrichments })
    return join('@', 'my-gen', `${name}.generated.ts`)
  }
})
```

The returned `MyGenBase` is then extended by the actual Projection
class:

```ts
class MyProjection extends MyGenBase {
  constructor(args: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super(args)
    // ...
  }

  override toString(): string {
    return `...`
  }
}
```

### `toGqlOperationProjectionBase<E>(config)`

Same shape as OAS but for GraphQL operations. The `operation`
parameter has the GQL operation shape (root kind, field name).

### `toModelProjectionBase<E>(config)`

Same shape but the parameter is `{ refName, enrichments }` instead
of `{ operation, enrichments }`. Used for generators that produce one
file per schema component.

```ts
export const ZodBase = toModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  toIdentifier({ refName }): Identifier {
    return Identifier.createVariable(decapitalize(refName))
  },

  toExportPath({ refName }): string {
    return join('@', 'zod', `${refName}.generated.ts`)
  }
})
```

## Pure function requirement

`toIdentifier` and `toExportPath` **must be pure functions** of
their inputs:

- No `this`-side state. (Hence why they're static — `this` isn't an
  instance.)
- No async. Synchronous return.
- No environmental reads (no `Date`, `Math.random`, `process.env`,
  etc.).

The reason: their outputs become the cache key for cross-generator
coordination. If `toIdentifier(op)` returned different names on
successive calls, the cache would lose its uniqueness invariant and
the order-independence guarantee would break.

The purity invariant is **convention-enforced, not type-enforced**.
The TypeScript type signature doesn't prevent impurity; relying on
convention is the cost of the design choice.

See [cross-generator-coordination concept](../../concepts/cross-generator-coordination.md#identifier-and-exportpath-are-pure-functions).

## Instance construction

The Projection's constructor signature varies by base:

```ts
// Operation projection
type OasOperationProjectionConstructorArgs<E> = {
  context: GenerateContextType
  operation: OasOperation
  settings: ContentSettings<E>
}

// Model projection
type ModelProjectionConstructorArgs<E> = {
  context: GenerateContextType
  refName: RefName
  settings: ContentSettings<E>
  destinationPath: string
  rootRef?: RefName
}
```

The Driver constructs the Projection with these args; generators
write the constructor body that:

1. Calls `super(args)`
2. Composes with peer generators via `insertOperation` /
   `insertNormalizedModel`
3. Registers imports via `this.register({ imports })` (the wrapper fills `destinationPath` from `this.settings.exportPath` — passing it explicitly is TS2353)

## Examples

### Complete operation projection

```ts
// gen-x/src/base.ts
export const MyGenBase = toOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  toIdentifier({ operation }) {
    const verb = capitalize(toMethodVerb(operation.method))
    const name = `${verb}${camelCase(operation.path, { upperFirst: true })}`
    return Identifier.createVariable(name)
  },

  toExportPath({ operation, enrichments }) {
    const { name } = this.toIdentifier({ operation, enrichments })
    return join('@', 'my-gen', `${name}.generated.ts`)
  }
})

// gen-x/src/MyProjection.ts
export class MyProjection extends MyGenBase {
  bodyTypeName: string

  constructor(args: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super(args)

    // Compose with peer generator
    const bodyType = this.insertNormalizedModel(TsProjection, {
      schema: args.operation.toRequestBody(({ schema }) => schema),
      fallbackName: `${args.settings.identifier.name}Body`
    })
    this.bodyTypeName = bodyType.identifier.name

    // Register runtime imports. The Projection wrapper fills
    // destinationPath from this.settings.exportPath; passing it here
    // is a typecheck error (TS2353).
    this.register({
      imports: { 'my-runtime-lib': ['someHelper'] }
    })
  }

  override toString(): string {
    return `(args: ${this.bodyTypeName}) => someHelper(args)`
  }
}
```

### Complete model projection

```ts
// gen-zod/src/base.ts
export const ZodBase = toModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  toIdentifier({ refName }) {
    return Identifier.createVariable(decapitalize(refName))
  },

  toExportPath({ refName }) {
    return join('@', 'zod', `${refName}.generated.ts`)
  }
})

// gen-zod/src/ZodProjection.ts
export class ZodProjection extends ZodBase {
  // ...
}
```

## Common questions

### Why static methods instead of methods on the instance?

`toIdentifier` and `toExportPath` are called by the Driver *before*
the Projection instance exists — the Driver needs them to compute
the cache key, which determines whether to construct the instance
at all. Static-on-class is the right shape for "available without
an instance."

### Can I override `toIdentifier` per instance?

No. The static methods are bound to the class via the factory.
Per-instance variation would defeat the cache-key purity invariant
(different instances would compute different names for the same
input, breaking memoization).

If you need per-operation variation in identifier shape, encode it
in `toIdentifier({ operation, enrichments })` — make the function
branch on properties of the operation or enrichment payload.

### What if I want to extend an existing projection base?

You can extend the class produced by the factory, but the static
methods are bound at factory time — overriding them in a subclass
is brittle (the cached factory-produced methods take precedence in
most paths).

The cleanest pattern is to use the factory directly with your own
configuration. If you're extending a stock generator, clone-then-
edit `src/base.ts` rather than subclassing.

### What's the relationship between the projection base's `insertOperation` and `GenerateContext.insertOperation`?

The projection-base method wraps the context method, auto-filling
`destinationPath` from `this.settings.exportPath`. So:

```ts
this.insertOperation(Peer, op)
// ≡
this.context.insertOperation({
  projection: Peer,
  operation: op,
  destinationPath: this.settings.exportPath
})
```

Generators almost always use the projection-base form because it
reads cleaner and gets the destination right by default.

### Why is `defineAndRegister` available on projection bases?

For the rare case of registering a Definition directly without going
through a peer Projection. Useful for small inline values (a
constants table, a default-values object) that need to be rendered
as `export const X = ...` but don't justify a full Projection of
their own.

Direct `defineAndRegister` bypasses cross-generator coordination
(the resulting Definition isn't discoverable via
`insertOperation` from other generators). Use only for definitions
that don't need cross-generator discoverability.

## Related types

```ts
// Constructor argument shapes
type OasOperationProjectionConstructorArgs<E = undefined> = {
  context: GenerateContextType
  operation: OasOperation
  settings: ContentSettings<E>
}

type GqlOperationProjectionConstructorArgs<E = undefined> = {
  context: GenerateContextType
  operation: GqlOperation
  settings: ContentSettings<E>
}

type ModelProjectionConstructorArgs<E = undefined> = {
  context: GenerateContextType
  refName: RefName
  settings: ContentSettings<E>
  destinationPath: string
  rootRef?: RefName
}

// Factory result
type OasOperationProjection<V, E> = new (args: OasOperationProjectionConstructorArgs<E>) => V & GeneratedValue
```

## See also

- [API: SnippetBase](dsl-snippet-base.md) — what projection bases extend
- [API: GenerateContext](generate-context.md) — what the projection-base methods delegate to
- [API: Identifier](dsl-identifier.md) — what `toIdentifier` returns
- [API: ContentSettings](content-settings.md) — what `settings` carries
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md) — the two-level model
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md) — pure functions and the cache
- [`skmtc-generator` skill scaffolds](../../skills/skmtc-generator/SKILL.md) — concrete templates A, B, C, D
