import type { OasSchema } from '@/oas/schema/Schema.ts'
import type { OasRef } from '@/oas/ref/Ref.ts'

/**
 * Fields used to construct a {@link GqlArgument}.
 */
export type GqlArgumentFields = {
  name: string
  schema: OasSchema | OasRef<'schema'>
  required: boolean
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
export class GqlArgument {
  readonly oasType = 'gqlArgument' as const
  readonly name: string
  readonly schema: OasSchema | OasRef<'schema'>
  readonly required: boolean
  readonly defaultValue: unknown
  readonly description: string | undefined
  readonly deprecated: boolean
  readonly deprecationReason: string | undefined

  constructor(fields: GqlArgumentFields) {
    this.name = fields.name
    this.schema = fields.schema
    this.required = fields.required
    this.defaultValue = fields.defaultValue
    this.description = fields.description
    this.deprecated = fields.deprecated ?? false
    this.deprecationReason = fields.deprecationReason
  }
}
