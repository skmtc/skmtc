import type { OasDiscriminator } from '../discriminator/Discriminator.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Constructor fields for {@link OasUnion}.
 */
export type UnionFields = {
  /** A short summary of the union type */
  title?: string
  /** A description of the union type */
  description?: string
  /** Whether the union value can be null */
  nullable?: boolean
  /** Discriminator object for creating tagged unions */
  discriminator?: OasDiscriminator
  /** Example value for the union */
  example?: unknown
  /** Default value for the union */
  default?: unknown
  /** Array of schemas that make up the union members */
  members: (OasSchema | OasRef<'schema'>)[]
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents a union type schema in the OpenAPI Specification.
 * 
 * `OasUnion` handles both OpenAPI `oneOf` and `anyOf` constructs by mapping them
 * to TypeScript union types. While OpenAPI distinguishes between these concepts,
 * in TypeScript they both represent union types (A | B | C), making the distinction
 * less meaningful for code generation.
 * 
 * This class supports both simple unions and discriminated (tagged) unions through
 * the discriminator property, which enables more precise type narrowing in generated code.
 * 
 * ## Key Features
 * 
 * - **Union Types**: Represents multiple possible schema types as a single union
 * - **Tagged Unions**: Supports discriminator properties for type narrowing
 * - **Reference Resolution**: Handles references to other schemas within union members
 * - **Nullable Support**: Can represent nullable union types (A | B | null)
 * - **JSON Schema**: Converts to standard JSON Schema format for validation
 * 
 * @example Basic union type
 * ```typescript
 * import { OasUnion, OasString, OasInteger } from '@skmtc/core';
 * 
 * const stringOrNumber = new OasUnion({
 *   title: 'StringOrNumber',
 *   description: 'A value that can be either a string or number',
 *   members: [
 *     new OasString({ title: 'String Value' }),
 *     new OasInteger({ title: 'Integer Value' })
 *   ]
 * });
 * 
 * // This represents: string | number
 * ```
 * 
 * @example Discriminated union (tagged union)
 * ```typescript
 * const shape = new OasUnion({
 *   title: 'Shape',
 *   description: 'Different types of geometric shapes',
 *   discriminator: new OasDiscriminator({
 *     propertyName: 'type',
 *     mapping: {
 *       'circle': '#/components/schemas/Circle',
 *       'square': '#/components/schemas/Square'
 *     }
 *   }),
 *   members: [
 *     new OasRef({ $ref: '#/components/schemas/Circle' }),
 *     new OasRef({ $ref: '#/components/schemas/Square' })
 *   ]
 * });
 * 
 * // This creates a tagged union that can be narrowed by the 'type' property
 * ```
 * 
 * @example Nullable union
 * ```typescript
 * const nullableStatus = new OasUnion({
 *   title: 'NullableStatus',
 *   nullable: true,
 *   members: [
 *     new OasString({ enum: ['active', 'inactive'] }),
 *     new OasString({ enum: ['pending', 'suspended'] })
 *   ],
 *   default: null
 * });
 * 
 * // This represents: ('active' | 'inactive' | 'pending' | 'suspended') | null
 * ```
 * 
 * @example Complex nested union
 * ```typescript
 * const apiResponse = new OasUnion({
 *   title: 'ApiResponse',
 *   description: 'Response from API endpoint',
 *   members: [
 *     new OasObject({
 *       title: 'SuccessResponse',
 *       properties: {
 *         success: new OasBoolean({ default: true }),
 *         data: new OasObject({ additionalProperties: true })
 *       }
 *     }),
 *     new OasObject({
 *       title: 'ErrorResponse',
 *       properties: {
 *         error: new OasString(),
 *         code: new OasInteger()
 *       }
 *     })
 *   ]
 * });
 * 
 * // This represents: { success: boolean; data: Record<string, any> } | { error: string; code: number }
 * ```
 * 
 * @example Using with references
 * ```typescript
 * const userOrAdmin = new OasUnion({
 *   title: 'UserOrAdmin',
 *   description: 'Either a regular user or an admin user',
 *   members: [
 *     new OasRef({ $ref: '#/components/schemas/User' }),
 *     new OasRef({ $ref: '#/components/schemas/Admin' })
 *   ]
 * });
 * 
 * // References will be resolved during processing
 * // This represents: User | Admin
 * ```
 */
export class OasUnion {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'union' useful for type narrowing and tagged unions.
   */
  type = 'union' as const
  /**
   * A short summary of the union.
   */
  title: string | undefined
  /**
   * A description of the union.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: boolean | undefined
  /**
   * Discriminator object used to tag member types and make the union a tagged union.
   */
  discriminator: OasDiscriminator | undefined
  /**
   * Array of schemas or references to schemas that are part of the union.
   */
  members: (OasSchema | OasRef<'schema'>)[]

  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the union type.
   */
  example?: unknown
  /**
   * The default value of the union type.
   */
  default?: unknown

  constructor(fields: UnionFields) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.discriminator = fields.discriminator
    this.members = fields.members
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.default = fields.default
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasUnion {
    return this
  }

  resolveOnce(): OasUnion {
    return this
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example,
      default: this.default,
      oneOf: this.members.map(member => member.toJsonSchema(options))
    }
  }
}
