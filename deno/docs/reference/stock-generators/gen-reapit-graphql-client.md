# @skmtc/gen-reapit-graphql-client

> Produce one React Query hook per GraphQL Query / Mutation
> operation, wrapping `graphql-request` for transport and
> `@graphql-typed-document-node/core` for the type contract.

A GraphQL operation generator. One `.generated.ts` file per
GraphQL operation, each containing a typed `useQuery` / `useMutation`
hook plus its supporting types and document constant.

## Source

`skmtc-generators/gen-reapit-graphql-client/src/`

Key files: `ReapitGraphqlClient.ts` (the main Projection),
`selection/` (selection-set rendering helpers for the SDL stub).

## What it generates

Per GraphQL operation:

```ts
// Query.GetOffices → useGetOffices.generated.ts
import { useQuery } from '@tanstack/react-query'
import { request } from 'graphql-request'
import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type GetOfficesVariables = { pageNumber?: number }
export type GetOfficesResult = { _embedded: Array<{ id: string, name: string }> }

const GetOfficesDocument = `query GetOffices($pageNumber: Int) { ... }`
  as unknown as TypedDocumentNode<GetOfficesResult, GetOfficesVariables>

export const useGetOffices = (variables: GetOfficesVariables) =>
  useQuery({
    queryKey: ['GetOffices', variables],
    queryFn: () => request(endpoint, GetOfficesDocument, variables)
  })
```

Self-contained per file: variables type, result type, document
constant, hook. Consumers tree-shake what they don't use.

## Key decisions

- **Broad `isSupported`.** Every Query and Mutation in the schema
  gets a hook. No filtering. Mirrors the
  `gen-tanstack-query-supabase-zod` philosophy: generators are
  cheap, consumers tree-shake. Narrow scoping would require every
  consumer to dispatch via `insertOperation`, adding friction
  without saving meaningful work.
- **`graphql-request` as transport.** Hardcoded import — clone the
  generator if you want a different transport (Apollo, urql,
  Pothos federation, etc.).
- **`TypedDocumentNode` for the contract.** The document constant
  is typed as `TypedDocumentNode<Result, Variables>` via a cast,
  giving downstream `request(...)` calls full type inference.
- **Self-contained per file.** Each operation gets its own file
  with all its dependencies inlined. Trade: more files, no
  cross-file imports for operation-level types. Consumers tree-
  shake aggressively and don't pay for operations they don't call.

## What to learn from it

- **The "broad generator + tree-shaking" pattern.** Both this
  generator and the tanstack-query stock generators take this
  approach. The alternative (narrow `isSupported`, peer-driven
  dispatch) trades fewer files for more coordination friction.
  Worth contrasting when designing a new operation generator.
- **`graphql-request` as the minimal transport.** When you need a
  hook generator but don't want Apollo's full state-management
  surface, `graphql-request` plus React Query gives you typed
  caching with a much smaller runtime footprint.
- **Document constant as a `TypedDocumentNode` cast.** The
  generator produces the SDL stub as a *string* and casts it. The
  type information lives in the cast; the runtime value is just a
  string. This avoids depending on `graphql-tag` or `gql.tada`
  for the build-time AST.

## Common customizations when cloned

- **Swap the transport.** Replace `graphql-request` with Apollo
  Client, urql, gql.tada, or a custom fetcher.
- **Change the cache key shape.** The stock uses
  `[operationName, variables]`; some teams prefer
  `[operationName, JSON.stringify(variables)]` for stricter
  equality semantics.
- **Add optimistic update helpers.** The stock produces bare hooks;
  cloners often add mutation helpers that update the cache
  pre-emptively.
- **Wire authentication.** The stock uses a module-level
  `endpoint` constant — production setups typically inject a
  configured `request` instance with auth headers.

## See also

- [gen-reapit-form](gen-reapit-form.md) — calls the mutation hooks
  this generator produces
- [gen-graphql-operation](gen-graphql-operation.md) — types-only
  alternative; the canonical "GraphQL types" generator
- [gen-graphql-typed-document-node](gen-graphql-typed-document-node.md) —
  separate document-constant generator (an alternative when you
  want types + document but provide your own hook layer)
- [gen-tanstack-query-fetch-zod](gen-tanstack-query-fetch-zod.md) —
  the OAS analog (REST + TanStack Query)
- [The GraphQL pipeline concept](../../concepts/the-graphql-pipeline.md)
