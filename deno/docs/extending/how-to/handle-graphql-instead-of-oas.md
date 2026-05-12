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

The factory is the GraphQL counterpart:

```ts
import { toGqlOperationEntry } from '@skmtc/core'
import { MyGqlGenerator } from './MyGqlGenerator.ts'

export const myGqlEntry = toGqlOperationEntry({
  id: denoJson.name,
  isSupported: () => true,
  transform: ({ context, operation }) => {
    context.insertOperation({ projection: MyGqlGenerator, operation })
  }
})
```

The engine's dispatcher routes this entry only against GraphQL
documents. Mixing both an OAS entry and a GQL entry in one
generator package is uncommon but supported (each runs only
against its matching document type).

### Extend `GqlOperationProjectionBase`

Your Projection class extends the GraphQL projection base:

```ts
import { GqlOperationProjectionBase } from '@skmtc/core'

export class MyGqlGenerator extends GqlOperationProjectionBase {
  override toString(): string {
    // ...
  }
}
```

This base's constructor accepts `{ context, operation, settings }`
where `operation: GqlOperation` (not `OasOperation`).

### Read the GraphQL operation model

The `GqlOperation` shape differs from `OasOperation`:

```ts
class GqlOperation {
  rootKind: 'query' | 'mutation' | 'subscription'
  fieldName: string                       // e.g., 'getUser'
  arguments: GqlArgument[]                // typed argument list
  returnType: OasSchema | OasRef<'schema'>  // converted to OAS-style schema
}
```

GraphQL types are normalized to the same `OasSchema` family used
for OAS schemas — that's how the same TS-emission code works for
both ecosystems. See [gen-graphql-operation](../../reference/stock-generators/gen-graphql-operation.md)
for a real example.

### Compose with peer GraphQL generators

Two stock generators pair up:

- **`@skmtc/gen-graphql-operation`** — emits `<Op>Args` and
  `<Op>Result` TypeScript types
- **`@skmtc/gen-graphql-typed-document-node`** — emits
  `<Op>Document: TypedDocumentNode<Result, Args>`

If your generator needs the types, compose with
`gen-graphql-operation` similarly to how OAS hook generators
compose with `gen-typescript`. Same `insertModel`/`insertNormalizedModel`
mechanism — the parsed types are interoperable across OAS and
GraphQL because of the shared `OasSchema` representation.

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
- **Schemas referenced but not emitted** — Composing with a
  peer GraphQL generator that's not installed. Run `skmtc list`.

## Related

- [The GraphQL asymmetry](../../explanation/the-graphql-asymmetry.md) —
  why GraphQL parses inside the worker
- [gen-graphql-operation reference](../../reference/stock-generators/gen-graphql-operation.md)
- [gen-graphql-typed-document-node reference](../../reference/stock-generators/gen-graphql-typed-document-node.md)
- [API: Projection bases](../../reference/api/projection-bases.md) —
  including `toGqlOperationProjectionBase`
