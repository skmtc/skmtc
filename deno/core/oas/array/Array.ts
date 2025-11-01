import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Constructor fields for {@link OasArray}.
 *
 * @template Nullable - Whether the array value can be null
 */
export type ArrayFields<Nullable extends boolean | undefined> = {
  /** Schema definition for array items */
  items: OasSchema | OasRef<'schema'>
  /** A short summary of the array schema */
  title?: string
  /** A description of the array schema */
  description?: string
  /** Whether the array value can be null */
  nullable?: Nullable
  /** Whether array items must be unique */
  uniqueItems?: boolean
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
  /** Example array value */
  example?: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
  /** Maximum number of items allowed */
  maxItems?: number
  /** Minimum number of items required */
  minItems?: number
  /** Array of allowed enum values for the entire array */
  enums?: Nullable extends true ? (unknown | null)[] | undefined : unknown[] | undefined
  /** Default value for the array */
  defaultValue?: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
  /** Whether the array is read-only */
  readOnly?: boolean
  /** Whether the array is write-only */
  writeOnly?: boolean
  /** Whether the array is deprecated */
  deprecated?: boolean
}

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
  nullable: Nullable | undefined
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

  /**
   * Creates a new OasArray instance.
   *
   * @param fields - Array configuration fields including items schema, validation constraints, and metadata
   */
  /**
   * Whether the array is read-only.
   */
  readOnly: boolean | undefined
  /**
   * Whether the array is write-only.
   */
  writeOnly: boolean | undefined
  /**
   * Whether the array is deprecated.
   */
  deprecated: boolean | undefined
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
    this.readOnly = fields.readOnly
    this.writeOnly = fields.writeOnly
    this.deprecated = fields.deprecated
  }

  /**
   * Determines if this array is a reference object.
   *
   * @returns Always returns false since this is a concrete array instance, not a reference
   */
  isRef(): this is OasRef<'schema'> {
    return false
  }

  /**
   * Resolves this array object.
   *
   * @returns The array instance itself since it's already a concrete object, not a reference
   */
  resolve(): OasArray<Nullable> {
    return this
  }

  /**
   * Resolves this array object one level.
   *
   * @returns The array instance itself since it's already a concrete object, not a reference
   */
  resolveOnce(): OasArray<Nullable> {
    return this
  }

  /**
   * Converts this OAS array to an OpenAPI v3 JSON schema representation.
   *
   * @param options - Conversion options including reference handling and formatting preferences
   * @returns OpenAPI v3 array schema object with type, items schema, and all validation constraints
   */
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
      default: this.defaultValue,
      readOnly: this.readOnly,
      writeOnly: this.writeOnly
    }
  }
}
