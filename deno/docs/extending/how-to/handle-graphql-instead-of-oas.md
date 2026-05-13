# How to handle GraphQL instead of OAS

> Author (or clone) a generator that processes GraphQL operations
> instead of OAS operations.

## When to use this

Your input is a GraphQL schema (SDL), not OpenAPI. The engine
supports both, but the entry-point factory and the parsed model
differ.

## Prerequisites

- The project's `client.json#source` points at a GraphQL SDL
  (`.graphql` file or content-type `application/graphql`).
- Familiarity with [the GraphQL asymmetry](../../explanation/the-graphql-asymmetry.md).

## Steps

### Use `toGqlOperationEntry` (not `toOasOperationEntry`)

The factory is the GraphQL counterpart. Both stock GraphQL
generators (`gen-graphql-operation` and
`gen-graphql-typed-document-node`) follow a **functional** pattern:
the `transform` callback inserts a model for the operation's
return type and registers any per-operation definitions directly
on the context.

```ts
import { toGqlOperationEntry, Definition, toGeneratorOnlyKey } from '@skmtc/core'
import { TsProjection } from '@skmtc/gen-typescript'
import denoJson from '../deno.json' with { type: 'json' }

const id = denoJson.name

export const myGqlEntry = toGqlOperationEntry({
  id,
  isSupported: () => true,
  transform: ({ context, operation, acc }) => {
    const exportPath = toExportPath(operation)
    const generatorKey = toGeneratorOnlyKey({ generatorId: id })

    // Insert a normalized TypeScript model for the operation's
    // return type. gen-typescript handles the schema → TS mapping.
    context.insertNormalizedModel(TsProjection, {
      schema: operation.returnType,
      fallbackName: `${operation.fieldName}Result`,
      destinationPath: exportPath
    })

    // Or register a definition directly when you need to write
    // your own typed value into the file.
    context.register({
      destinationPath: exportPath,
      imports: { '@graphql-typed-document-node/core': ['TypedDocumentNode'] },
      definitions: [
        new Definition({
          context,
          identifier: someIdentifier,
          value: { generatorKey, toString: () => '/* value body */' }
        })
      ]
    })

    return acc
  }
})
```

The engine's dispatcher routes this entry only against GraphQL
documents. Mixing both an OAS entry and a GQL entry in one
generator package is uncommon but supported (each runs only
against its matching document type).

Stock generators extract the body of `transform` into a local
helper function for readability — see
`gen-graphql-operation/src/mod.ts` for a concrete example.

### Insert models and register definitions through the context

There is no Projection class in either stock GraphQL generator.
Instead, the `transform` callback uses `GenerateContext` methods
directly:

- `context.insertNormalizedModel(TsProjection, { schema, fallbackName, destinationPath })`
  delegates rendering of a TypeScript type for an inline schema.
  The TS file is added (or reused if already present) and you
  get back a stable identifier.
- `context.insertModel(TsProjection, refName)` is the named
  counterpart — use it when you have a `RefName` (e.g. from
  `returnType.toRefName()` after `returnType.isRef()`).
- `context.register({ destinationPath, imports, definitions })`
  writes to a specific file. Use it when you need to add your
  own typed definitions (not just delegate to another generator).

If you genuinely want a class-based Projection for a GraphQL
generator (most authors do not), use the
`toGqlOperationProjectionBase` factory — the GraphQL counterpart
to `toOasOperationProjectionBase`:

```ts
import { toGqlOperationProjectionBase, Identifier, capitalize } from '@skmtc/core'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const MyGqlBase = toGqlOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  toIdentifier: ({ operation }) =>
    Identifier.createVariable(`${capitalize(operation.fieldName)}Form`),
  toExportPath: ({ operation }) =>
    join('@', 'forms', `${operation.fieldName}.generated.tsx`),
  isSupported: () => true
})

export class MyGqlForm extends MyGqlBase {
  constructor({ context, operation, settings }) {
    super({ context, operation, settings })
    // ... pull peer artifacts via this.insertOperation / this.insertNormalizedModel
    // ... register imports
  }
  override toString() { /* JSX template */ }
}
```

Wire it up via `transform` calling `context.insertOperation({
projection: MyGqlForm, operation })`. The
[`GqlOperationDriver`](../../concepts/files-and-dedup.md#what-drivers-do--in-one-sentence-each)
handles cache, integrity check, and import stitching — same as
the OAS counterpart. Reach for this pattern when your generator's
output is referenced by peer generators (cache participation
matters). The functional pattern shown above is the right
default when output is application-facing only.

See [the GraphQL pipeline concept](../../concepts/the-graphql-pipeline.md#operation-generator-patterns)
for when each pattern fits.

### Read the GraphQL operation model

The full `GqlOperation` shape (from
`core/gql/operation/GqlOperation.ts`):

```ts
class GqlOperation {
  readonly oasType: 'gqlOperation'
  readonly rootKind: 'query' | 'mutation' | 'subscription'
  readonly fieldName: string                          // e.g., 'getUser'
  readonly arguments: GqlArgument[]                   // typed argument list
  readonly returnType: OasSchema | OasRef<'schema'>   // OAS-shaped return type
  readonly returnTypeString: string                   // human-readable original
  readonly description: string | undefined
  readonly deprecated: boolean
  readonly deprecationReason: string | undefined

  // Computed: `<rootKind>_<fieldName>` e.g. `query_getUser`
  get identifier(): string
}
```

GraphQL types are normalized to the same `OasSchema` family used
for OAS schemas — that's how the same TypeScript-producing code
works for both ecosystems. See
[gen-graphql-operation](../../reference/stock-generators/gen-graphql-operation.md)
for a real example.

### Compose with peer GraphQL generators

Two stock generators pair up:

- **`@skmtc/gen-graphql-operation`** — produces `<Op>Args` and
  `<Op>Result` TypeScript types
- **`@skmtc/gen-graphql-typed-document-node`** — produces
  `<Op>Document: TypedDocumentNode<Result, Args>`

`gen-graphql-typed-document-node` writes into the same file as
`gen-graphql-operation` (it reuses `toExportPath` from the peer
package). Pair them so the document's `<Base>Args` and
`<Base>Result` references resolve locally. Same
`insertModel` / `insertNormalizedModel` mechanism — the parsed
types are interoperable across OAS and GraphQL because of the
shared `OasSchema` representation.

## Verification

```bash
skmtc generate <project>
```

The CLI's worker parses the GraphQL SDL inside the worker
process (host-side parsing isn't possible — see [the GraphQL
asymmetry](../../explanation/the-graphql-asymmetry.md)). Your
generator runs against each `GqlOperation`.

Inspect the output for a representative root field. The
generated code should reference the field name, args, and
result type as expected.

## Troubleshooting

- **"GraphQL parse error"** — The SDL has syntax issues. The
  parse runs inside the worker; the error message includes a
  line/column. Validate with a standalone GraphQL parser if
  needed.
- **`isRef()` always false on return types** — GraphQL return
  types are sometimes converted to inline `OasObject`s rather
  than `OasRef`s, depending on whether the type is reusable
  across operations. Handle both cases via the standard
  schema-variant dispatch.
- **Schemas referenced but not produced** — Composing with a
  peer GraphQL generator that's not installed. Run `skmtc list`.

## Related

- [The GraphQL pipeline concept](../../concepts/the-graphql-pipeline.md) —
  the conceptual model: shared `OasSchema` vocabulary, type-
  mapping rules, scalar handling, operation generator patterns
- [The GraphQL asymmetry](../../explanation/the-graphql-asymmetry.md) —
  why GraphQL parses inside the worker
- [gen-graphql-operation reference](../../reference/stock-generators/gen-graphql-operation.md)
- [gen-graphql-typed-document-node reference](../../reference/stock-generators/gen-graphql-typed-document-node.md)
- [API: Projection bases](../../reference/api/projection-bases.md) —
  including `toGqlOperationProjectionBase`
- [API: GraphQL document model](../../reference/api/gql-document.md) —
  `GqlDocument`, `GqlRegistry`, `GqlOperation`, `GqlArgument`
