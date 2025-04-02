import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
export type IntegerFields<Nullable extends boolean | undefined> = {
  title?: string
  description?: string
  nullable: Nullable
  format?: 'int32' | 'int64'
  default?: Nullable extends true ? number | null | undefined : number | undefined
  enums?: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  extensionFields?: Record<string, unknown>
  example?: Nullable extends true ? number | null | undefined : number | undefined
  multipleOf?: number
  maximum?: number
  exclusiveMaximum?: boolean
  minimum?: number
  exclusiveMinimum?: boolean
}

export class OasInteger<Nullable extends boolean | undefined = boolean | undefined> {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'integer' useful for type narrowing and tagged unions.
   */
  type = 'integer' as const
  /**
   * A short summary of the integer.
   */
  title: string | undefined
  /**
   * A description of the integer.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: Nullable
  /**
   * The format of the integer.
   */
  format: 'int32' | 'int64' | undefined
  /**
   * An array of allowed values for the integer.
   */
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the integer.
   */
  example: Nullable extends true ? number | null | undefined : number | undefined
  /**
   * The multiple of the integer.
   */
  multipleOf: number | undefined
  /**
   * The maximum value of the integer.
   */
  maximum: number | undefined
  /**
   * Whether the maximum value is exclusive.
   */
  exclusiveMaximum: boolean | undefined
  /**
   * The minimum value of the integer.
   */
  minimum: number | undefined
  /**
   * Whether the minimum value is exclusive.
   */
  exclusiveMinimum: boolean | undefined
  /**
   * The default value of the integer.
   */
  default: Nullable extends true ? number | null | undefined : number | undefined
  constructor(fields: IntegerFields<Nullable>) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.format = fields.format
    this.enums = fields.enums
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.multipleOf = fields.multipleOf
    this.maximum = fields.maximum
    this.exclusiveMaximum = fields.exclusiveMaximum
    this.minimum = fields.minimum
    this.exclusiveMinimum = fields.exclusiveMinimum
    this.default = fields.default
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasInteger<Nullable> {
    return this
  }

  resolveOnce(): OasInteger<Nullable> {
    return this
  }

  // deno-lint-ignore no-unused-vars
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      type: 'integer',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      format: this.format,
      enum: this.enums,
      example: this.example,
      multipleOf: this.multipleOf,
      maximum: this.maximum,
      exclusiveMaximum: this.exclusiveMaximum,
      minimum: this.minimum,
      exclusiveMinimum: this.exclusiveMinimum,
      default: this.default
    }
  }
}
