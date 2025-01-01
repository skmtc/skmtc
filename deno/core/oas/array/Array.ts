import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'

export type ArrayFields = {
  items: OasSchema | OasRef<'schema'>
  title?: string
  description?: string
  nullable?: boolean
  uniqueItems?: boolean
  extensionFields?: Record<string, unknown>
  // deno-lint-ignore no-explicit-any
  example?: Array<any>
}

/**
 * Object representing an array in the OpenAPI Specification.
 */
export class OasArray {
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
  nullable: boolean | undefined
  /**
   * Indicates whether the array items must be unique.
   */
  uniqueItems: boolean | undefined

  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined

  /**
   * An example of the array.
   */
  example: Array<unknown> | undefined

  constructor(fields: ArrayFields) {
    this.items = fields.items
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.uniqueItems = fields.uniqueItems
    this.extensionFields = fields.extensionFields
    this.example = fields.example
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasArray {
    return this
  }

  resolveOnce(): OasArray {
    return this
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ArraySchemaObject {
    return {
      type: 'array',
      items: this.items.toJsonSchema(options),
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example
    }
  }
}
