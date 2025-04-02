import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
export type NumberFields<Nullable extends boolean | undefined> = {
  title?: string
  description?: string
  nullable: Nullable
  extensionFields?: Record<string, unknown>
  example?: Nullable extends true ? number | null | undefined : number | undefined
  enums?: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  format?: 'float' | 'double'
  multipleOf?: number
  maximum?: number
  exclusiveMaximum?: boolean
  minimum?: number
  exclusiveMinimum?: boolean
}

/**
 * Object representing a number in the OpenAPI Specification.
 */
export class OasNumber<Nullable extends boolean | undefined = boolean | undefined> {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'number' useful for type narrowing and tagged unions.
   */
  type = 'number' as const
  /**
   * A short summary of the number.
   */
  title: string | undefined
  /**
   * A description of the number.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: Nullable
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the number.
   */
  example: Nullable extends true ? number | null | undefined : number | undefined
  /**
   * An array of allowed values for the number.
   */
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
  /**
   * The format of the number.
   */
  format: 'float' | 'double' | undefined
  /**
   * The multiple of the number.
   */
  multipleOf: number | undefined
  /**
   * The maximum value of the number.
   */
  maximum: number | undefined
  /**
   * Whether the maximum value is exclusive.
   */
  exclusiveMaximum: boolean | undefined
  /**
   * The minimum value of the number.
   */
  minimum: number | undefined
  /**
   * Whether the minimum value is exclusive.
   */
  exclusiveMinimum: boolean | undefined
  constructor(fields: NumberFields<Nullable>) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.enums = fields.enums
    this.format = fields.format
    this.multipleOf = fields.multipleOf
    this.maximum = fields.maximum
    this.exclusiveMaximum = fields.exclusiveMaximum
    this.minimum = fields.minimum
    this.exclusiveMinimum = fields.exclusiveMinimum
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasNumber<Nullable> {
    return this
  }

  resolveOnce(): OasNumber<Nullable> {
    return this
  }

  // deno-lint-ignore no-unused-vars
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      type: 'number',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example,
      enum: this.enums,
      format: this.format,
      multipleOf: this.multipleOf,
      maximum: this.maximum,
      exclusiveMaximum: this.exclusiveMaximum,
      minimum: this.minimum,
      exclusiveMinimum: this.exclusiveMinimum
    }
  }
}
