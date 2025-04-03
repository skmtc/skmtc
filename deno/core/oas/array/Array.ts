import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'

export type ArrayFields<Nullable extends boolean | undefined> = {
  items: OasSchema | OasRef<'schema'>
  title?: string
  description?: string
  nullable: Nullable
  uniqueItems?: boolean
  extensionFields?: Record<string, unknown>
  example?: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
  maxItems?: number
  minItems?: number
  enums?: Nullable extends true ? (unknown | null)[] | undefined : unknown[] | undefined
  defaultValue?: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
}

/**
 * Object representing an array in the OpenAPI Specification.
 */
export class OasArray<Nullable extends boolean | undefined = boolean | undefined> {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'array' useful for type narrowing and tagged unions.
   */
  type = 'array' as const
  /**
   * Defines the type of items in the array.
   */
  items: OasSchema | OasRef<'schema'>
  /**
   * A short summary of the array.
   */
  title: string | undefined
  /**
   * A description of the array.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: Nullable
  /**
   * Indicates whether the array items must be unique.
   */
  uniqueItems: boolean | undefined

  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined

  /**
   * An example of the array.
   */
  example: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
  /**
   * The maximum number of items in the array.
   */
  maxItems: number | undefined
  /**
   * The minimum number of items in the array.
   */
  minItems: number | undefined

  /**
   * The enum values for the array.
   */
  enums: Nullable extends true ? (unknown | null)[] | undefined : unknown[] | undefined

  /**
   * The default value for the array.
   */
  defaultValue: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined

  constructor(fields: ArrayFields<Nullable>) {
    this.items = fields.items
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.uniqueItems = fields.uniqueItems
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.maxItems = fields.maxItems
    this.minItems = fields.minItems
    this.enums = fields.enums
    this.defaultValue = fields.defaultValue
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasArray<Nullable> {
    return this
  }

  resolveOnce(): OasArray<Nullable> {
    return this
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ArraySchemaObject {
    return {
      type: 'array',
      items: this.items.toJsonSchema(options),
      title: this.title,
      enum: this.enums,
      description: this.description,
      nullable: this.nullable,
      example: this.example,
      maxItems: this.maxItems,
      minItems: this.minItems,
      uniqueItems: this.uniqueItems,
      default: this.defaultValue
    }
  }
}
