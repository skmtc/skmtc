import type { GqlRegistry } from '@/gql/registry/GqlRegistry.ts'
import type { GqlOperation } from '@/gql/operation/GqlOperation.ts'
import type { GqlRootTypes } from '@/gql/rootType/GqlRootTypes.ts'
import type { OasInfo } from '@/oas/info/Info.ts'

/**
 * Fields used to construct a {@link GqlDocument}.
 */
export type GqlDocumentFields = {
  /** Type registry containing all named GraphQL types as OAS schema objects. */
  registry: GqlRegistry
  /** Root-level fields exposed as Query, Mutation, or Subscription. */
  operations: GqlOperation[]
  /** Names of the root operation types (Query, Mutation, Subscription). */
  rootTypes: GqlRootTypes
  /** Schema-level metadata (title, version, description). Optional. */
  info?: OasInfo
}

/**
 * Top-level container for a parsed GraphQL schema.
 *
 * `GqlDocument` is the GraphQL counterpart to {@link OasDocument}. It owns
 * a {@link GqlRegistry} (the named-type registry, parallel to
 * `OasComponents.schemas`), the list of root-level fields exposed as
 * {@link GqlOperation} entries, and pointers to the schema's root operation
 * types.
 *
 * Both documents are wrapped by {@link SkmtcDocument} so the pipeline can
 * carry either through the same generate phase.
 */
export class GqlDocument {
  readonly oasType = 'gqlDocument' as const
  readonly registry: GqlRegistry
  readonly operations: GqlOperation[]
  readonly rootTypes: GqlRootTypes
  readonly info: OasInfo | undefined

  constructor(fields: GqlDocumentFields) {
    this.registry = fields.registry
    this.operations = fields.operations
    this.rootTypes = fields.rootTypes
    this.info = fields.info
  }
}
