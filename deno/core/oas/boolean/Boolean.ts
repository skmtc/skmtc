import type { OpenAPIV3 } from 'openapi-types'
import type { OasRef } from '../ref/Ref.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
export type BooleanFields<Nullable extends boolean | undefined> = {
  title?: string
  description?: string
  nullable?: Nullable
  extensionFields?: Record<string, unknown>
  example?: Nullable extends true ? boolean | null | undefined : boolean | undefined
  enum?: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined
  default?: Nullable extends true ? boolean | null | undefined : boolean | undefined
}

/**
 * Object representing a boolean in the OpenAPI Specification.
 */
export class OasBoolean<Nullable extends boolean | undefined = boolean | undefined> {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'boolean' useful for type narrowing and tagged unions.
   */
  type = 'boolean' as const
  /**
   * A short summary of the boolean.
   */
  title: string | undefined
  /**
   * A description of the boolean.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: Nullable | undefined

  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the boolean.
   */
  example: Nullable extends true ? boolean | null | undefined : boolean | undefined

  /**
   * Possible values the boolean can have
   */
  enum: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined
  /**
   * The default value of the boolean.
   */
  default: Nullable extends true ? boolean | null | undefined : boolean | undefined

  constructor(fields: BooleanFields<Nullable> = {}) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.enum = fields.enum
    this.default = fields.default
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasBoolean<Nullable> {
    return this
  }

  resolveOnce(): OasBoolean<Nullable> {
    return this
  }

  // deno-lint-ignore no-unused-vars
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      type: 'boolean',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example,
      enum: this.enum,
      default: this.default
    }
  }
}
