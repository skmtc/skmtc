# Inserted

> The return value of `insertOperation` and `insertModel`. Carries
> the peer Projection's `ContentSettings` and resulting
> `Definition`, plus four accessor helpers — most importantly
> `toName()`, which is how the consuming generator splices the
> peer's identifier into its own template.

For the broader pull-based-Projection story this class participates
in, see
[how-generators-produce-output.md](../../concepts/how-generators-produce-output.md).
For cross-generator coordination, see
[cross-generator-coordination.md](../../concepts/cross-generator-coordination.md).

## Source

`skmtc/deno/core/dsl/Inserted.ts`

## Class

```ts
class Inserted<V extends GeneratedValue, EnrichmentType = undefined> {
  settings: ContentSettings<EnrichmentType>
  definition: GeneratedDefinition<V>

  constructor(args: {
    settings: ContentSettings<EnrichmentType>
    definition: GeneratedDefinition<V>
  })

  toName(): string
  toIdentifier(): IdentifierBase
  toExportPath(): string
  toValue(): V
}
```

`Inserted` is constructed by `GenerateContext.insertOperation` and
`GenerateContext.insertModel` after the Driver has produced (or
retrieved from cache) the peer Projection's `Definition`. The
consuming generator receives this instance and uses the helpers
to wire the peer's name into its own output.

## Generic parameters

| Parameter | Role |
|---|---|
| `V extends GeneratedValue` | The Projection's value type. Determined by the Projection class passed to `insertOperation` / `insertModel`. |
| `EnrichmentType = undefined` | The Projection's enrichment shape. Defaults to `undefined` for Projections without enrichments. |

The parameters propagate from the Projection's static
`toEnrichmentSchema` typing back through the call site, so
`inserted.settings.enrichments` is typed correctly at the call
site without manual annotation.

## Properties

### `settings: ContentSettings<EnrichmentType>`

The peer's content settings — the bundle of
`{ identifier, exportPath, enrichments, variant }` computed by the Driver
from the Projection's static methods. Same instance as the one on
the Projection class (`peerProjection.settings`).

### `definition: GeneratedDefinition<V>`

The peer's `Definition` — the `export const NAME = …;` wrapper
that lives in the peer's `exportPath`. Same instance the Driver
registered (or, on cache hit, the cached one).

## Methods

### `toName(): string`

Returns `this.settings.identifier.name`. The peer's identifier
name as a plain string. This is the most-used accessor — it's
what a consuming generator interpolates into its own template:

```ts
const inserted = context.insertOperation({
  projection: TanstackQuery,
  operation
})
return `<Form onSubmit={form.handleSubmit(${inserted.toName()})} />`
```

### `toIdentifier(): IdentifierBase`

Returns `this.settings.identifier`. The full `IdentifierBase`
object — useful when the consumer needs more than the name (the
`typeName` annotation or `exported` flag, or — after narrowing to
the language subclass — the declaration `type`) for an import
registration:

```ts fragment
import { TsIdentifier, isTypeOnly } from '@skmtc/lang-typescript'

const identifier = inserted.toIdentifier()

this.register({
  imports: {
    [inserted.toExportPath()]: [
      identifier instanceof TsIdentifier && isTypeOnly(identifier.type)
        ? { name: identifier.name, type: 'type' }
        : identifier.name
    ]
  }
})
```

(In practice, the Driver already registers the cross-file import
when `destinationPath !== exportPath` — most consumers don't need
to do this manually.)

### `toExportPath(): string`

Returns `this.settings.exportPath`. The peer's file path. Useful
when constructing import statements for cases the Driver hasn't
handled automatically (rare — see note on `toIdentifier`).

### `toValue(): V`

Returns `this.definition.value`. The Projection's raw value
(typed as `V`, the Projection's value type). Most consumers don't
read the peer's value directly — coordination is by name, not by
content. The exception is rare cases where a generator needs to
inspect the peer's structure.

## Examples

### Pulling a mutation hook's name into a form template

```ts
class CreateUserForm extends SnippetBase {
  #submitFn: string

  constructor({ context, destinationPath, operation }: Args) {
    super({ context })
    const inserted = context.insertOperation({
      projection: TanstackQuery,
      operation
    })
    this.#submitFn = inserted.toName()    // 'useCreateUser'
  }

  override toString(): string {
    return `
      const { mutate } = ${this.#submitFn}()
      return <Form onSubmit={form.handleSubmit(mutate)}>…</Form>
    `
  }
}
```

The hook lives in a different file; the Driver stitches the
cross-file import automatically because `destinationPath` (form)
differs from the hook's `exportPath`.

### Wiring a model's type into a TanStack Query argument

```ts
const userType = context.insertModel({
  projection: TsProjection,
  refName: 'User'
})

const body = `
  export const useUpdateUser = (input: ${userType.toName()}) => {
    // ...
  }
`
```

## Common questions

### Why not just return the `Definition` from `insertOperation`?

Two reasons. First, the *name* is what the consumer almost always
wants (for template interpolation); the `Definition` is the
container. A separate wrapper class lets the API surface the
common case (`.toName()`) as a one-liner while keeping the full
`Definition` accessible.

Second, the wrapper carries the `ContentSettings` separately from
the `Definition`. The settings include enrichments (typed via
`EnrichmentType`) that aren't on the `Definition` itself.
Consumers that need the peer's enrichments read
`inserted.settings.enrichments`.

### Can `Inserted` be `undefined`?

No. `insertOperation` and `insertModel` always return an
`Inserted` instance. If the peer Projection's constructor throws,
the throw propagates up through the Driver and out of the
`insert*` call — the dispatcher's per-item try/catch catches it
and marks the item `'error'`. There is no "the peer wasn't
generated, so we got `undefined` back" path.

### Does `Inserted` participate in caching?

No. `Inserted` is a transient wrapper constructed on each `insert*`
call. The cache lives in `File.definitions: Map<name, Definition>`;
the `Inserted` instances are built fresh from cached `Definition`s
on each lookup.

## See also

- [Concept: cross-generator coordination](../../concepts/cross-generator-coordination.md)
- [Concept: how generators produce output](../../concepts/how-generators-produce-output.md)
- [Concept: composing output with Stringable](../../concepts/stringable-composition.md)
- [API: GenerateContext.insertOperation](generate-context.md#insertoperationv-eargs-insertoperationargsv-e-insertedv-e)
- [API: GenerateContext.insertModel](generate-context.md#insertmodelv-eprojection-refname-options-insertedv-e)
- [API: ContentSettings](content-settings.md)
- [Glossary: Inserted](../glossary.md#inserted)
