import type { OasDocument } from '@/oas/document/Document.ts'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'

/**
 * Discriminated union representing a parsed source document inside the SKMTC
 * pipeline. Each variant carries the protocol-specific document object as
 * `value`, tagged by `type` so generator dispatch and downstream consumers
 * can narrow with a `switch`.
 *
 * The pipeline keeps OpenAPI and GraphQL documents as siblings: model
 * generators are protocol-neutral and run against whichever variant is
 * present, while operation generators are routed by their declared
 * `protocol` field on the generator config.
 *
 * @example Narrowing in a protocol-aware generator
 * ```typescript
 * switch (context.document.type) {
 *   case 'oas':
 *     // context.document.value is OasDocument
 *     break
 *   case 'gql':
 *     // context.document.value is GqlDocument
 *     break
 * }
 * ```
 */
export type SkmtcDocument =
  | { type: 'oas'; value: OasDocument }
  | { type: 'gql'; value: GqlDocument }

/**
 * Discriminator for the source protocol of a {@link SkmtcDocument}.
 *
 * Operation generators declare which protocol they target via this same
 * value on their generator config; the dispatcher uses it to skip
 * generators that don't match the current document.
 */
export type SkmtcProtocol = SkmtcDocument['type']

/**
 * Wraps an {@link OasDocument} in the OAS variant of {@link SkmtcDocument}.
 *
 * Convenience constructor used by the pipeline when transitioning from the
 * parse phase (which produces an `OasDocument` directly) into the generate
 * phase (which expects the discriminated wrapper).
 */
export const toOasSkmtcDocument = (value: OasDocument): SkmtcDocument => ({
  type: 'oas',
  value
})

/**
 * Wraps a {@link GqlDocument} in the GQL variant of {@link SkmtcDocument}.
 */
export const toGqlSkmtcDocument = (value: GqlDocument): SkmtcDocument => ({
  type: 'gql',
  value
})
