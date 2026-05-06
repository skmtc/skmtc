import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import type { GqlArgument } from '@/gql/argument/GqlArgument.ts'

/**
 * GraphQL root operation kind. Maps directly onto the schema's root type
 * pointers (Query / Mutation / Subscription).
 */
export type GqlRootKind = 'query' | 'mutation' | 'subscription'

/**
 * Fields used to construct a {@link GqlOperation}.
 */
export type GqlOperationFields = {
  rootKind: GqlRootKind
  fieldName: string
  arguments: GqlArgument[]
  returnType: OasSchema | OasRef<'schema'>
  /**
   * The original GraphQL return-type string (e.g. `'User'`,
   * `'[Post!]!'`). Captured at parse time so generators don't have
   * to reverse-engineer it from the OAS form when emitting SDL
   * fragments. Optional in construction with `''` fallback so test
   * fixtures don't have to fabricate one.
   */
  returnTypeString?: string
  description?: string
  deprecated?: boolean
  deprecationReason?: string
}

/**
 * GraphQL counterpart to `OasOperation`.
 *
 * Each instance represents a single root-level field exposed by the schema
 * (e.g. `Query.user`, `Mutation.createPost`). Operation generators marked
 * `protocol: 'gql'` receive these via the same `transform({ context, operation, acc })`
 * shape as their HTTP siblings, but with this class instead of
 * `OasOperation`.
 *
 * Field arguments are kept structured (a list of `GqlArgument`) rather
 * than synthesized into an `OasObject` upfront — generators that want an
 * args object can build one at emit time, while generators that just need
 * the per-argument metadata don't pay for the synthesis.
 */
export class GqlOperation {
  readonly oasType = 'gqlOperation' as const
  readonly rootKind: GqlRootKind
  readonly fieldName: string
  readonly arguments: GqlArgument[]
  readonly returnType: OasSchema | OasRef<'schema'>
  readonly returnTypeString: string
  readonly description: string | undefined
  readonly deprecated: boolean
  readonly deprecationReason: string | undefined

  constructor(fields: GqlOperationFields) {
    this.rootKind = fields.rootKind
    this.fieldName = fields.fieldName
    this.arguments = fields.arguments
    this.returnType = fields.returnType
    this.returnTypeString = fields.returnTypeString ?? ''
    this.description = fields.description
    this.deprecated = fields.deprecated ?? false
    this.deprecationReason = fields.deprecationReason
  }

  /**
   * Stable identifier for this operation, suitable for file naming and
   * cache keying. Concatenates the root kind and field name with an
   * underscore: `query_getUser`, `mutation_createPost`.
   */
  get identifier(): string {
    return `${this.rootKind}_${this.fieldName}`
  }
}
