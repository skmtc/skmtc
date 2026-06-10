import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'
import { OasBase } from '@/types/OasBase.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

/**
 * Fields used to construct a {@link GqlArgument}.
 */
export type GqlArgumentFields = {
  name: string
  schema: OasSchema | OasRef<'schema'>
  required: boolean
  /**
   * The original GraphQL type string for this argument (e.g. `'ID!'`,
   * `'CreatePostInput!'`, `'[String!]'`). Captured at parse time so
   * generators that need to reconstruct an SDL fragment — like
   * `gen-graphql-typed-document-node` building a `gql\`...\`` template
   * — don't have to reverse-engineer it from the OAS form.
   *
   * Optional at construction so test fixtures don't have to fabricate
   * one; falls back to `''` when omitted.
   */
  gqlType?: string
  defaultValue?: unknown
  description?: string
  deprecated?: boolean
  deprecationReason?: string
}

/**
 * A single argument on a GraphQL field.
 *
 * Intentionally slimmer than `OasParameter`: GraphQL field arguments are
 * just `(name, type, default, description)` plus a required flag. None of
 * the OpenAPI HTTP encoding state (`location`, `style`, `explode`,
 * `allowReserved`, content-by-mediaType) applies, so we keep this class
 * focused.
 *
 * The `required` flag corresponds directly to the GraphQL non-null
 * indicator on the argument's type. A `defaultValue` makes an otherwise
 * required argument effectively optional from the caller's perspective —
 * but we surface both fields as the schema declared them and let
 * downstream generators decide what to do with the combination.
 */
export class GqlArgument extends OasBase {
  readonly oasType = 'gqlArgument' as const
  readonly name: string
  readonly schema: OasSchema | OasRef<'schema'>
  readonly required: boolean
  readonly gqlType: string
  readonly defaultValue: unknown
  readonly description: string | undefined
  readonly deprecated: boolean
  readonly deprecationReason: string | undefined

  constructor(fields: GqlArgumentFields, context?: ParseContextType) {
    super(context)
    this.name = fields.name
    this.schema = fields.schema
    this.required = fields.required
    this.gqlType = fields.gqlType ?? ''
    this.defaultValue = fields.defaultValue
    this.description = fields.description
    this.deprecated = fields.deprecated ?? false
    this.deprecationReason = fields.deprecationReason
  }
}
