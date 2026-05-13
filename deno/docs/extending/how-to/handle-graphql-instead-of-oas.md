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

The factory is the GraphQL counterpart. Use the class-based
projection pattern — the same shape as OAS operation generators:
extend `toGqlOperationProjectionBase`, then dispatch the class
from the entry's `transform`.

```ts
// src/base.ts
import { toGqlOperationProjectionBase, Identifier, capitalize } from '@skmtc/core'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const MyGqlBase = toGqlOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  toIdentifier: ({ operation }) =>
    Identifier.createVariable(`use${capitalize(operation.fieldName)}`),
  toExportPath: ({ operation }) =>
    join('@', 'graphql', `use${capitalize(operation.fieldName)}.generated.ts`)
})

// src/MyGqlHook.ts
import { TsProjection } from '@skmtc/gen-typescript'
import { synthesizeArgsObject } from '@skmtc/core'
import { MyGqlBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'
import type { GqlOperationProjectionConstructorArgs } from '@skmtc/core'

export class MyGqlHook extends MyGqlBase {
  argsTypeName: string | undefined
  resultTypeName: string

  constructor(args: GqlOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super(args)

    const argsObject = synthesizeArgsObject(args.operation)
    if (argsObject !== undefined) {
      const argsType = this.insertNormalizedModel(TsProjection, {
        schema: argsObject,
        fallbackName: `${args.settings.identifier.name}Args`
      })
      this.argsTypeName = argsType.identifier.name
    }

    const resultType = this.insertNormalizedModel(TsProjection, {
      schema: args.operation.returnType,
      fallbackName: `${args.settings.identifier.name}Result`
    })
    this.resultTypeName = resultType.identifier.name

    this.register({
      imports: { '@tanstack/react-query': ['useQuery'] }
    })
  }

  override toString(): string {
    return `(${this.argsTypeName ? `args: ${this.argsTypeName}` : ''}) => useQuery<${this.resultTypeName}>({ ... })`
  }
}

// src/mod.ts
import { toGqlOperationEntry, synthesizeArgsObject } from '@skmtc/core'
import { MyGqlHook } from './MyGqlHook.ts'
import { toEnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const myGqlEntry = toGqlOperationEntry({
  id: denoJson.name,
  toEnrichmentSchema,

  // GQL `isSupported` typically checks the args shape — synthesizeArgsObject
  // returns undefined for fields with no arguments, which most generators
  // don't want to process.
  isSupported: ({ operation }) => synthesizeArgsObject(operation) !== undefined,

  // GQL transform must return acc.
  transform: ({ context, operation, acc }) => {
    context.insertOperation({ projection: MyGqlHook, operation })
    return acc
  }
})

export default myGqlEntry
```

Three GraphQL-specific shape differences vs OAS:

1. **`transform` is `({ context, operation, acc }) => acc`.** The
   accumulator threads through every operation `GenerateContext`
   visits in the GraphQL document. Dropping `acc` (or forgetting to
   return it) breaks downstream operations that rely on accumulated
   state.

2. **Enrichments are not pre-resolved.** OAS pre-resolves by
   `[path][method]`; GQL hands you the raw operation. Walk
   `context.settings.enrichments[id][operation.identifier]` yourself
   (`operation.identifier` is `<rootKind>_<fieldName>`).

3. **Mutation args come via `synthesizeArgsObject(operation)`.** GQL
   has no `requestBody`. `synthesizeArgsObject` turns the field's
   typed argument list into an `OasObject` so the same
   `insertNormalizedModel(TsProjection, …)` path that OAS uses for
   request bodies works for GraphQL arguments.

### Why the class-based pattern, not a functional `transform`?

Earlier stock generators (`@skmtc/gen-graphql-operation`,
`@skmtc/gen-graphql-typed-document-node`) used a functional pattern
— a free `emitOperation` helper called from `transform`, no
Projection class. Both were deleted on 2026-05-13. The reasons were
mechanical:

- The artifacts they produced (`<Op>Args`, `<Op>Result`,
  `<Op>Document`) had zero `.ts` consumers across the workspace —
  no peer generator ever needed to find them via `insertOperation`.
- Most of each `transform`'s work was `context.insertNormalizedModel(TsProjection, …)`
  delegation; the package's distinctive logic was a naming
  convention plus an export path — which is exactly what a
  Projection class encapsulates.
- The functional shape bypassed `affirmDefinition` integrity checks
  (it called `context.register({ definitions: [new Definition(...)] })`
  directly with hand-built `generatorKey`s).

Class-based Projections get all four framework guarantees from
`insertOperation` (Definition registration, cross-File import
registration, insertion order, refactor resilience). A free helper
in `transform` skips them.

If the only thing your generator does in `transform` is delegate to
`TsProjection` / `ZodProjection` for typing the operation, the
package may not be earning its boundary. Inline the call in
whichever consuming generator needs the type, or audit zero
consumers before publishing.

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
[gen-reapit-graphql-client](../../reference/stock-generators/gen-reapit-graphql-client.md)
for a real example.

### Compose with peer GraphQL generators

The remaining stock GraphQL generator is
`@skmtc/gen-reapit-graphql-client` — it produces React Query hooks
per Query/Mutation. New GraphQL generator authors typically reach
for `TsProjection` from `@skmtc/gen-typescript` for typing
operations' arguments and return values. The parsed types are
interoperable across OAS and GraphQL because of the shared
`OasSchema` representation, so the same
`insertNormalizedModel(TsProjection, …)` call works for both
protocols.

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
- [gen-reapit-graphql-client reference](../../reference/stock-generators/gen-reapit-graphql-client.md) — the surviving stock GraphQL generator after the 2026-05-13 cleanup
- [API: Projection bases](../../reference/api/projection-bases.md) —
  including `toGqlOperationProjectionBase`
- [API: GraphQL document model](../../reference/api/gql-document.md) —
  `GqlDocument`, `GqlRegistry`, `GqlOperation`, `GqlArgument`
