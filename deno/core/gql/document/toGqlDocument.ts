import type { GraphQLSchema } from 'graphql'
import type * as log from '@std/log'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import { ParseContext, type GqlParseOptions } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'

/**
 * Options accepted by {@link toGqlDocument}. Re-exported alias of
 * {@link GqlParseOptions} so the parser sub-module stays the
 * single-stop import for one-line usage.
 */
export type ToGqlDocumentOptions = GqlParseOptions

/**
 * Silent logger used by the one-line `toGqlDocument` convenience. The
 * unified {@link ParseContext} expects a logger, but in silent mode it
 * never gets called — so a no-op stub is sufficient.
 */
const noopLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

/**
 * One-line convenience for parsing a GraphQL SDL string (or pre-built
 * `GraphQLSchema`) into a {@link GqlDocument}.
 *
 * Constructs a unified {@link ParseContext} pinned to the GQL protocol
 * and runs `.parse()`. Issues are recorded on the context and
 * discarded; callers that want to inspect them should construct the
 * context themselves:
 *
 * ```ts
 * const ctx = new ParseContext({
 *   input: { type: 'gql', value: sdl },
 *   logger: myLogger,
 *   silent: true
 * })
 * const parsed = ctx.parse(new StackTrail([]))
 * console.log(ctx.issues)
 * ```
 */
export const toGqlDocument = (
  source: string | GraphQLSchema,
  options: ToGqlDocumentOptions = {}
): GqlDocument => {
  const ctx = new ParseContext({
    input: { type: 'gql', value: source },
    logger: noopLogger,
    silent: true,
    options: { gql: options }
  })
  const parsed = ctx.parse(new StackTrail([]))
  if (parsed.type !== 'gql') {
    // Unreachable: input was tagged 'gql' so the parsed branch must be 'gql'.
    throw new Error('toGqlDocument: parse returned non-gql variant')
  }
  return parsed.value
}
