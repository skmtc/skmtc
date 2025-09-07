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
}

/**
 * Represents an array schema in the OpenAPI Specification.
 * 
 * `OasArray` handles array type definitions with comprehensive validation
 * constraints including item count limits, uniqueness requirements, and
 * item type specifications. It supports nested schemas and references
 * for complex array structures.
 * 
 * This class is used throughout the OAS processing pipeline to represent
 * array fields in API schemas, including lists of objects, primitive arrays,
 * and complex nested array structures.
 * 
 * ## Key Features
 * 
 * - **Item Type Definition**: Support for any schema type as array items
 * - **Size Constraints**: Minimum and maximum item count validation
 * - **Uniqueness Validation**: Ensure array items are unique (like Set behavior)
 * - **Nested Schemas**: Support for complex nested array structures
 * - **Reference Handling**: Seamless integration with schema references
 * - **Nullable Support**: Type-safe nullable array handling
 * - **JSON Schema**: Conversion to standard JSON Schema format
 * 
 * @template Nullable - Whether the array value can be null
 * 
 * @example String array
 * ```typescript
 * import { OasArray, OasString } from '@skmtc/core';
 * 
 * const tagsArray = new OasArray({
 *   title: 'Tags',
 *   description: 'List of tags associated with the item',
 *   items: new OasString({ minLength: 1 }),
 *   minItems: 1,
 *   uniqueItems: true,
 *   example: ['javascript', 'typescript', 'react']
 * });
 * ```
 * 
 * @example Object array with references
 * ```typescript
 * import { OasArray, OasRef } from '@skmtc/core';
 * 
 * const usersArray = new OasArray({
 *   title: 'Users',
 *   description: 'List of user objects',
 *   items: new OasRef({ refName: 'User' }),
 *   maxItems: 100,
 *   example: [
 *     { id: 1, name: 'John' },
 *     { id: 2, name: 'Jane' }
 *   ]
 * });
 * ```
 * 
 * @example Nested array (array of arrays)
 * ```typescript
 * const matrixArray = new OasArray({
 *   title: 'Matrix',
 *   description: '2D array of numbers',
 *   items: new OasArray({
 *     items: new OasInteger({ minimum: 0 })
 *   }),
 *   example: [
 *     [1, 2, 3],
 *     [4, 5, 6],
 *     [7, 8, 9]
 *   ]
 * });
 * ```
 * 
 * @example Nullable array with constraints
 * ```typescript
 * const optionalIdsArray = new OasArray<true>({
 *   title: 'Optional IDs',
 *   description: 'Optional list of IDs',
 *   items: new OasInteger({ format: 'int64', minimum: 1 }),
 *   nullable: true,
 *   minItems: 0,
 *   maxItems: 10,
 *   defaultValue: null
 * });
 * ```
 * 
 * @example Unique items validation
 * ```typescript
 * const uniqueEmailsArray = new OasArray({
 *   title: 'Email Recipients',
 *   description: 'List of unique email addresses',
 *   items: new OasString({ format: 'email' }),
 *   uniqueItems: true, // Ensures no duplicate emails
 *   minItems: 1,
 *   example: ['user1@example.com', 'user2@example.com']
 * });
 * ```
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
      default: this.defaultValue
    }
  }
}
