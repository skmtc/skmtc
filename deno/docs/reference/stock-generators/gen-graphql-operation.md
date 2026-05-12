# @skmtc/gen-graphql-operation

> Emit TypeScript args and result type contracts for GraphQL root
> fields. Pairs with `@skmtc/gen-graphql-typed-document-node`.

A GraphQL operation generator. The "types-only" half of the
GraphQL contract pair — produces `<Op>Args` and `<Op>Result` types
that downstream code (or a paired generator) can reference.

## Source

`skmtc-generators/gen-graphql-operation/src/`

Uses `toGqlOperationEntry`, which is the GraphQL equivalent of
`toOasOperationEntry`. The dispatcher only routes this generator
against GraphQL documents, not OAS.

## What it generates

Per GraphQL root field, two type aliases:

```ts
// For: query getUser(id: ID!): User
import type { User } from '@/types/user.generated.ts'

export type GetUserArgs = { id: string }
export type GetUserResult = User
```

For fields with no arguments:

```ts
export type GetMeArgs = Record<string, never>
export type GetMeResult = User
```

## Key decisions

- **Types only — no query string, no transport.** The generator
  emits *just* the type contracts. The query string (SDL fragment)
  and the transport mechanism are downstream concerns delegated to
  `gen-graphql-typed-document-node` and whatever client library
  the consumer uses.
- **Composes with `gen-typescript`.** Uses `TsProjection` (imported
  from `@skmtc/gen-typescript`) for the actual TS emission. The
  result type either references the model's TS alias (via
  `insertModel`) or inlines via `insertNormalisedModel`.
- **`synthesizeArgsObject` for args type.** Builds an `OasObject`
  representation of the GraphQL operation's arguments, then routes
  it through `TsProjection` — same emission path as inline OAS
  schemas. This gives args the same scalar/format mapping as any
  other emitted type.
- **`isSupported: () => true`.** No filtering — every GraphQL
  operation gets contracts emitted.

## What to learn from it

- **GraphQL/OAS parity through Projection reuse.** Args
  synthesized as `OasObject` go through the same TS-emission code
  as native OAS schemas. The two ecosystems share emission infra;
  only the parse phase differs.
- **`toGqlOperationEntry` for GraphQL-only generators.** The
  typed-end-to-end factory ensures the engine dispatches this
  generator only against GraphQL documents. No runtime cast needed.
- **Pairing generators by design.** This generator is half of a
  pair — its emitted file is incomplete without
  `gen-graphql-typed-document-node` adding the `<Op>Document`
  constants that reference these types.

## Common customizations when cloned

- Change naming convention (`GetUserArgs` → `GetUserVariables` to
  match Apollo's convention).
- Emit a different shape for fields with no args (`undefined`
  rather than `Record<string, never>`).
- Customize how nested ref types resolve — for projects with
  deeply-nested types you might want `Awaited<...>` or `Required<...>`
  wrappers.

## See also

- [gen-graphql-typed-document-node](gen-graphql-typed-document-node.md) —
  the required companion generator
- [gen-typescript](gen-typescript.md) — composes via
  `TsProjection`
- [API: toArtifacts](../api/to-artifacts.md) — accepts both OAS
  and GraphQL inputs
- [Projection bases reference](../api/projection-bases.md) —
  including `toGqlOperationProjectionBase`
