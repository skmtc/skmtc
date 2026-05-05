import type { RefName } from '@/types/RefName.ts'

/**
 * Names of the root operation types declared by a GraphQL schema.
 *
 * Defaults are `Query`, `Mutation`, and `Subscription` but a schema may
 * override any of them via `schema { query: Foo, mutation: Bar }`. Each
 * field, when set, is a {@link RefName} into the document's
 * {@link GqlRegistry}.
 */
export type GqlRootTypes = {
  query?: RefName
  mutation?: RefName
  subscription?: RefName
}
