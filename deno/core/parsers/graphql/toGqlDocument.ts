import type { GraphQLSchema } from 'graphql'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import {
  GqlParseContext,
  type GqlParseOptions
} from '@/context/GqlParseContext.ts'

/**
 * Options accepted by {@link toGqlDocument}. Re-exported alias of
 * {@link GqlParseOptions} so the parser sub-module stays the
 * single-stop import for one-line usage.
 */
export type ToGqlDocumentOptions = GqlParseOptions

/**
 * One-line convenience for parsing a GraphQL SDL string (or pre-built
 * `GraphQLSchema`) into a {@link GqlDocument}.
 *
 * Wraps `new GqlParseContext({ source }).parse(options)`. Issues are
 * recorded on the constructed context and discarded — callers that
 * want to inspect issues should construct the context themselves:
 *
 * ```ts
 * const ctx = new GqlParseContext({ source: sdl })
 * const doc = ctx.parse()
 * console.log(ctx.issues)
 * ```
 */
export const toGqlDocument = (
  source: string | GraphQLSchema,
  options: ToGqlDocumentOptions = {}
): GqlDocument => {
  return new GqlParseContext({ source }).parse(options)
}
