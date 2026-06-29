import type { OasDocument } from '@/oas/document/Document.ts'
import type { GqlDocument } from '@/gql/document/GqlDocument.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { GraphQLSchema } from 'graphql'

/**
 * Discriminated union representing a *parsed* source document inside the
 * SKMTC pipeline. Each variant carries the protocol-specific
 * post-parse document object as `value`, tagged by `type` so generator
 * dispatch and downstream consumers can narrow with a `switch`.
 *
 * This shape is the *output* of the parse phase. The pipeline's public
 * entry point ({@link SkmtcDocumentInput}) carries raw schema sources
 * and is converted into this shape inside `CoreContext.toArtifacts`
 * before the generate phase runs.
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
export type SkmtcParsedDocument =
  | { type: 'oas'; value: OasDocument }
  | { type: 'gql'; value: GqlDocument }

/**
 * Discriminator for the source protocol of a {@link SkmtcParsedDocument}.
 *
 * Operation generators declare which protocol they target via this same
 * value on their generator config; the dispatcher uses it to skip
 * generators that don't match the current document.
 */
export type SkmtcProtocol = SkmtcParsedDocument['type']

/**
 * Wraps an {@link OasDocument} in the OAS variant of {@link SkmtcParsedDocument}.
 *
 * Convenience constructor used by the pipeline when transitioning from
 * the parse phase (which produces an `OasDocument` directly) into the
 * generate phase (which expects the discriminated wrapper).
 */
export const toOasParsedDocument = (value: OasDocument): SkmtcParsedDocument => ({
  type: 'oas',
  value
})

/**
 * Wraps a {@link GqlDocument} in the GQL variant of {@link SkmtcParsedDocument}.
 */
export const toGqlParsedDocument = (value: GqlDocument): SkmtcParsedDocument => ({
  type: 'gql',
  value
})

/**
 * Discriminated union representing a *raw* source document accepted by
 * `CoreContext.toArtifacts`. This is the public input shape — callers
 * supply the schema as the protocol-specific source type, and the
 * pipeline runs the protocol-appropriate parser before handing the
 * post-parse {@link SkmtcParsedDocument} to the generate phase.
 *
 * - `oas.value` is an `OpenAPIV3.Document`. Schema versions other than
 *   3.0 (Swagger 2, OpenAPI 3.1) are normalized to 3.0 by
 *   `@skmtc/convert` before reaching `toArtifacts`. 3.1 `webhooks` ride
 *   *on* that document as a retained member (the 3.0 base type omits
 *   `webhooks`, so it is widened here) — the parser flattens them into
 *   {@link OasDocument.webhooks}.
 * - `gql.value` is either a raw SDL string or a pre-built
 *   `GraphQLSchema`. Strings are run through `buildSchema` inside the
 *   pipeline; pre-built `GraphQLSchema` instances are used as-is.
 */
export type SkmtcDocumentInput =
  | {
      type: 'oas'
      value: OpenAPIV3.Document<Record<string, never>> & {
        webhooks?: Record<string, OpenAPIV3.PathItemObject>
      }
    }
  | { type: 'gql'; value: string | GraphQLSchema }
