import type { OasDocument } from '@/oas/document/Document.ts'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import type { OpenAPIV3 } from 'openapi-types'

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

/**
 * Discriminated union representing a *source* document accepted by
 * `CoreContext.toArtifacts`. Mirrors {@link SkmtcDocument} but carries
 * the raw OpenAPI v3 document on the OAS side instead of the parsed
 * {@link OasDocument} — `CoreContext.toArtifacts` runs the parse phase
 * itself when the input is OAS, then hands the result to the generate
 * phase as a {@link SkmtcDocument}.
 *
 * GraphQL has no parallel parse step at this layer because SDL parsing
 * is owned by `core/parsers/graphql/toGqlDocument.ts`, which is a
 * sub-export — keeping it out of `core` proper means consumers that
 * only need the data model don't pay the `graphql` npm dependency cost.
 */
export type SkmtcDocumentInput =
  | { type: 'oas'; value: OpenAPIV3.Document<Record<string, never>> }
  | { type: 'gql'; value: GqlDocument }
