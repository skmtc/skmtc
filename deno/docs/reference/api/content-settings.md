# ContentSettings

> The per-Projection settings object: `identifier`, `exportPath`, and
> `enrichments`. Computed by Drivers from a Projection's static
> methods (`toIdentifier`, `toExportPath`, `toEnrichmentSchema`) and
> passed to the Projection constructor as `args.settings`. Available
> at runtime as `this.settings`.

`ContentSettings` is the smallest yet most load-bearing class in the
DSL. It's the **only** thing connecting a Projection instance to its
identifier (name + entity type), its export path, and its enrichments.
Drivers compute it before construction; Projections consume it during
`toString()`.

## Source

`skmtc/deno/core/dsl/ContentSettings.ts`

## Constructor

```ts
class ContentSettings<E = undefined> {
  identifier: Identifier
  exportPath: string
  enrichments: E

  constructor(args: {
    identifier: Identifier
    exportPath: string
    enrichments: E
  })

  static empty(args: {
    identifier: Identifier
    exportPath: string
  }): ContentSettings<undefined>
}
```

```ts
new ContentSettings({
  identifier: Identifier,        // the name + entityType
  exportPath: string,            // the file path this Projection lands in
  enrichments: E                 // the validated enrichment payload (or undefined)
})
```

The generic parameter `E` is the enrichment shape — declared by the
generator's `toEnrichmentSchema` factory. When the generator declares
no enrichments, `E = undefined`.

## Properties

### `identifier`

The Projection's name and entity-type marker. Used in two ways:

1. **In the rendered output** — wrapped by `Definition`, this becomes
   the `export const NAME =` or `export type Name =` declaration.
2. **In the cross-generator coordination cache** — the
   `(identifier.name, exportPath)` pair is the cache key. Two
   generators producing the same name in the same file converge on
   one entry.

See [API: Identifier](dsl-identifier.md) for the entity-type semantics
(`'variable'` vs `'type'` — the discriminator values; the rendered
declaration keyword for `'variable'` is `const`) and factory methods.

### `exportPath`

The file path where this Projection's `Definition` will live in the
output. Computed by the Projection's static `toExportPath()` method,
typically:

```ts
static toExportPath({ operation }): string {
  return `${basePath}/forms/${toEndpointName(operation)}.tsx`
}
```

The path is the second half of the cache key — two Projections with
the same `identifier.name` but different `exportPath` are *distinct*
entries (no collision).

The Driver also uses `exportPath` to route the Projection's
`register({ definitions })` call to the right `File`.

### `enrichments`

The validated enrichment payload for this specific Projection
instance. The projection-base factory routes via a key path that
depends on the factory kind (OAS operation, model, or GraphQL
operation) — see
[enrichments-shape reference](../settings/enrichments-shape.md)
for the three routing structures.

The result is type-narrowed to `E`, the schema declared by the
generator's `toEnrichmentSchema` factory. May be `undefined` when:

- The generator declared no enrichments (`E = undefined`)
- The user didn't supply enrichments for this operation
- The enrichments are optional and absent

The Projection's `toString()` reads `this.settings.enrichments?.X` to
access user-supplied overrides.

## Factory

### `ContentSettings.empty(args)`

A convenience factory for the no-enrichments case. Equivalent to:

```ts
new ContentSettings({
  identifier,
  exportPath,
  enrichments: undefined
})
```

Used by Drivers when constructing settings for generators that don't
declare an enrichment schema. The static method makes the intent
explicit: "no enrichments here, just the identifier and path."

```ts
const settings = ContentSettings.empty({
  identifier: createVariable('userBody'),
  exportPath: '@/types/userBody.generated.ts'
})
// → ContentSettings<undefined>
```

## Use sites

### In Projection constructors (via `this.settings`)

The Driver constructs `ContentSettings` and passes it to the
Projection constructor:

```ts
const settings = new ContentSettings({
  identifier: projection.toIdentifier({ operation }),
  exportPath: projection.toExportPath({ operation }),
  enrichments: routedEnrichments
})

const instance = new projection({
  context,
  operation,
  settings              // ← passed in
})
```

Inside the Projection, the settings are available as `this.settings`:

```ts
// ShadcnFormBase = toOasOperationProjectionBase({...}) in base.ts

class ShadcnForm extends ShadcnFormBase {
  override toString(): string {
    const { title, submitLabel } = this.settings.enrichments ?? {}

    return `
      <Form>
        ${title ? `<h2>${title}</h2>` : ''}
        ${this.fields}
        <Button>${submitLabel ?? 'Submit'}</Button>
      </Form>
    `
  }
}
```

The identifier is used implicitly when the Projection's `Definition`
is rendered (`export const ${this.settings.identifier.name} = ...`).

### In Drivers (computed from projection static methods)

Drivers (`OasOperationDriver`, `OasModelDriver`, `GqlOperationDriver`)
compute `ContentSettings` by calling the projection's static methods.
The flow:

```ts
// In OasOperationDriver
const identifier = projection.toIdentifier({ operation })
const exportPath = projection.toExportPath({ operation })
const enrichments = this.routeEnrichments(operation, projection)

const settings = new ContentSettings({
  identifier,
  exportPath,
  enrichments
})

const instance = new projection({ context, operation, settings })
```

The static methods are pure functions of the operation (or schema).
Two calls with the same operation produce the same settings — which
is why the cache key `(identifier.name, exportPath)` is stable across
generator iterations.

### In the cache key

`GenerateContext.findDefinition({ name, exportPath })` searches by
those two fields exactly. They're derived from
`ContentSettings.identifier.name` and `ContentSettings.exportPath`,
respectively. The full `ContentSettings` instance isn't part of the
key — just the two scalars.

Why not the full object? Identity stability. The static methods
recompute fresh objects on every call (they're pure), but their
outputs are equal-by-content. Keying by scalars sidesteps the issue
of comparing object references.

## Examples

### Empty (no enrichments)

```ts
const settings = ContentSettings.empty({
  identifier: createVariable('userBody'),
  exportPath: '@/types/userBody.generated.ts'
})

// In the Projection
// UserBodyBase = toModelProjectionBase({...}) in base.ts

class UserBody extends UserBodyBase {
  override toString(): string {
    // No enrichments available; type is undefined
    return `z.object({ name: z.string() })`
  }
}
```

### With enrichments

```ts
type EnrichmentSchema = {
  title?: string
  submitLabel?: string
}

const settings = new ContentSettings<EnrichmentSchema>({
  identifier: createVariable('createUserForm'),
  exportPath: '/forms/CreateUser.generated.tsx',
  enrichments: { title: 'Create User', submitLabel: 'Create' }
})

// ShadcnFormBase = toOasOperationProjectionBase<EnrichmentSchema>({...}) in base.ts

class ShadcnForm extends ShadcnFormBase {
  override toString(): string {
    const { title, submitLabel } = this.settings.enrichments ?? {}
    return `<Form><h2>${title}</h2>...<Button>${submitLabel}</Button></Form>`
  }
}
```

## Common questions

### Why is `enrichments` inside settings rather than a separate constructor arg?

Settings is the *bundle*: identifier, exportPath, and enrichments all
flow together from the Driver. Splitting them would require every
Projection constructor to accept three args instead of one — and
would make it harder for projection-base classes to forward them.

The single `settings` object is the consistent interface across
operation, model, and GQL projection bases.

### Why does `ContentSettings.empty` exist if I can just pass `enrichments: undefined`?

Two reasons:

1. **Intent clarity** — `ContentSettings.empty({...})` reads as "no
   enrichments here," while `new ContentSettings({..., enrichments: undefined})`
   looks like an oversight.
2. **Type correctness** — `ContentSettings.empty` returns
   `ContentSettings<undefined>` directly, so downstream code sees the
   precise type rather than `ContentSettings<E>` where `E` could be
   anything.

Functionally they're equivalent; semantically the factory is
preferable.

### Can I mutate `settings` after construction?

Don't. `ContentSettings` is treated as immutable by the engine.
Mutating `this.settings.identifier.name` after construction would
desync the cache key from the actual rendered name, leading to
duplicate or missing definitions.

If you need a different identifier for some reason, construct a
fresh `ContentSettings` and a fresh `Definition`. Don't reach into
the existing object.

### What if my generator needs additional per-instance data beyond `ContentSettings`?

Pass it via the Projection's constructor `args` object:

```ts
// MyBase = toOasOperationProjectionBase({...}) in base.ts

class MyProjection extends MyBase {
  constructor(args: {
    context, operation, settings,
    customData: { ... }       // ← additional field
  }) {
    super(args)
    this.customData = args.customData
  }
}
```

Then read it as `this.customData` in `toString()`. This is the
escape hatch for data that doesn't fit the identifier/path/enrichments
shape.

### Where does `ContentSettings` not flow?

Snippets. Snippets don't have a `settings` object — they're anonymous
helpers, not addressable units. Snippets receive their parameters via
their constructor's `args` and have no identifier or exportPath of
their own.

If a Snippet needs enrichment data, the parent Projection extracts it
from `this.settings.enrichments` and passes it to the Snippet
constructor.

## Related types

```ts
class ContentSettings<E = undefined> {
  identifier: Identifier
  exportPath: string
  enrichments: E
}

// Convenience aliases (used in projection-base type parameters)
type OperationContentSettings<E> = ContentSettings<E>
type ModelContentSettings<E> = ContentSettings<E>
```

## See also

- [API: Identifier](dsl-identifier.md) — what `settings.identifier` is
- [API: Projection bases](projection-bases.md) — how settings are constructed and forwarded
- [API: GenerateContext](generate-context.md) — `findDefinition({ name, exportPath })` uses the settings' values
- [Reference: enrichments shape](../settings/enrichments-shape.md) — how `settings.enrichments` is routed
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md) — why settings drive the cache key
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md) — settings' role in Projections
- [Glossary: ContentSettings, Identifier, Enrichments](../glossary.md)
