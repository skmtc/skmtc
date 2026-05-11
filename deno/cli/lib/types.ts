import type { SkmtcProtocol } from '@skmtc/core'

/**
 * Supported source-file types for the schema input.
 *
 * `json` and `yaml` are OpenAPI variants; `graphql` is a GraphQL SDL
 * file (`.graphql`, `.gql`, or `.graphqls`). The CLI uses the file type
 * to route the parse step: OpenAPI inputs go through `@skmtc/convert`
 * to produce an `OpenAPIV3.Document`; GraphQL inputs are sent as raw
 * SDL to the worker, which parses them via the unified
 * `ParseContext` exported from `@skmtc/core`.
 */
export type FileType = 'json' | 'yaml' | 'graphql'

/**
 * Discriminator for the source-document protocol.
 *
 * Aliased from core's {@link SkmtcProtocol} (which is
 * `SkmtcDocument['type']`) so the CLI carries the same vocabulary at
 * its own boundaries (worker payload, sandbox API). Re-aliased here
 * rather than re-defined so adding a third protocol in core
 * automatically propagates.
 */
export type Protocol = SkmtcProtocol

/**
 * Maps a {@link FileType} to its corresponding {@link Protocol}.
 *
 * Implemented as an exhaustive switch (with a `never` assertion in the
 * default branch) so adding a new {@link FileType} variant forces a
 * compile error here rather than silently falling through to one of
 * the existing protocols.
 */
export const fileTypeToProtocol = (fileType: FileType): Protocol => {
  switch (fileType) {
    case 'json':
    case 'yaml':
      return 'oas'
    case 'graphql':
      return 'gql'
    default: {
      const _exhaustive: never = fileType
      throw new Error(`Unhandled file type: ${_exhaustive}`)
    }
  }
}

export type SchemaSource =
  | {
      type: 'local'
      path: string
    }
  | {
      type: 'remote'
      url: string
    }
