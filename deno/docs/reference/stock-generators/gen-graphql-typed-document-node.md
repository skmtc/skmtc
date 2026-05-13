# @skmtc/gen-graphql-typed-document-node

> Produce `TypedDocumentNode` constants for GraphQL operations,
> with SDL stubs containing TODO placeholders. Pairs with
> `@skmtc/gen-graphql-operation`.

A GraphQL operation generator. The "document" half of the GraphQL
contract pair. Running it standalone produces files that reference
undefined types — always pair with `gen-graphql-operation`.

## Source

`skmtc-generators/gen-graphql-typed-document-node/src/`

## What it generates

Per GraphQL operation, a `TypedDocumentNode` constant with an SDL
stub:

```ts
import { gql } from 'graphql-tag'
import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export const GetUserDocument: TypedDocumentNode<GetUserResult, GetUserArgs> = gql`
query GetUser($id: ID!) {
  getUser(id: $id) {
    # TODO: select fields
  }
}
`
```

The `# TODO: select fields` placeholder is intentional — the
generator can't know which fields you want; the developer fills it
in.

## Key decisions

- **Hardcoded module paths as customization seams.**
  ```ts
  const GQL_TAG_PATH = 'graphql-tag'
  const TYPED_DOC_PATH = '@graphql-typed-document-node/core'
  ```
  Top-of-file constants in `mod.ts`. Clone the generator and edit
  these if your project uses different packages (e.g.,
  `@apollo/client` re-exports `gql`).
- **SDL stub with `# TODO` placeholders.** For composite return
  types (objects, unions, arrays of objects), the generator
  produces a selection-set placeholder. The developer edits the
  generated file to specify fields. For leaf return types
  (scalar, enum), no selection set is rendered.
- **Hardcoded pairing with `gen-graphql-operation`.** The
  rendered `TypedDocumentNode<GetUserResult, GetUserArgs>`
  references types that *only* `gen-graphql-operation` produces.
  The two are designed to write into the same file (via shared
  `toExportPath` from `@skmtc/gen-graphql-operation`).

## What to learn from it

- **Paired generators as a deliberate design.** Some generators
  produce useful output only when run alongside another. Document
  this clearly (the source has a comment explicitly stating this).
- **Stub-and-edit output style.** When a generator can't know
  enough to produce final output (selection sets here, handler
  bodies in `gen-express`), `// TODO` placeholders are an
  honest way to ship a useful scaffold.
- **Hardcoded module paths as constants at the top of the file.**
  When a generator depends on specific peer packages, declare
  those paths as top-level constants. Cloners see them
  immediately and know exactly what to swap.

## Common customizations when cloned

- Swap `graphql-tag` for `@apollo/client`'s `gql` re-export.
- Remove the `# TODO` placeholder and render a default selection
  (e.g., all scalar fields one level deep).
- Add subscription-specific handling (the stock treats query,
  mutation, subscription the same; some clients want them in
  separate files).
- Customize the document-name suffix (`GetUserDocument` vs
  `GetUserQuery` vs `GET_USER`).

## See also

- [Concept: the GraphQL pipeline](../../concepts/the-graphql-pipeline.md) —
  the broader GraphQL coverage; what `gen-graphql-operation`
  produces that this generator consumes
- [gen-graphql-operation](gen-graphql-operation.md) — the required
  companion; reads sibling
- [API: toArtifacts](../api/to-artifacts.md) — GraphQL ingest
- [Generators as packages concept](../../concepts/generators-as-packages.md)
