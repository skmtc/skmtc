import type { OasParameterLocation, OasParameterStyle } from './parameter-types.ts'
import type { OasMediaType } from '../mediaType/MediaType.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasExample } from '../example/Example.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

// @TODO It might be a good idea to set up separate classes for
// path, query, header, and cookie parameters

/**
 * Constructor fields for {@link OasParameter}.
 */
export type ParameterFields = {
  /** The name of the parameter */
  name: string
  /** The location of the parameter (path, query, header, cookie) */
  location: OasParameterLocation
  /** A brief description of the parameter */
  description?: string | undefined
  /** Determines whether this parameter is mandatory */
  required?: boolean | undefined
  /** Specifies that the parameter is deprecated */
  deprecated?: boolean | undefined
  /** Whether to allow empty values for the parameter */
  allowEmptyValue?: boolean | undefined
  /** Whether reserved characters are allowed in the parameter value */
  allowReserved?: boolean | undefined
  /** The schema defining the parameter's data type */
  schema?: OasSchema | OasRef<'schema'> | undefined
  /** Example values for the parameter */
  examples?: Record<string, OasExample | OasRef<'example'>> | undefined
  /** Media type definitions for the parameter content */
  content?: Record<string, OasMediaType> | undefined
  /** The serialization style for the parameter */
  style: OasParameterStyle
  /** Whether to explode parameter values */
  explode: boolean
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents a Parameter Object in the OpenAPI Specification.
 * 
 * The `OasParameter` class encapsulates the definition of a single operation parameter,
 * including its location, data type, validation rules, and serialization behavior.
 * Parameters can be located in the path, query string, headers, or cookies.
 * 
 * This class provides comprehensive support for parameter validation, serialization
 * styles, and complex data types through schema definitions or content specifications.
 * 
 * ## Key Features
 * 
 * - **Location Support**: Path, query, header, and cookie parameters
 * - **Schema Validation**: Comprehensive data type validation through schemas
 * - **Serialization Styles**: Various parameter serialization formats
 * - **Content Types**: Support for complex parameter content with media types
 * - **Examples & Documentation**: Parameter examples and descriptive documentation
 * - **Advanced Options**: Empty values, reserved characters, and explode behavior
 * 
 * @example Basic path parameter
 * ```typescript
 * import { OasParameter, OasString } from '@skmtc/core';
 * 
 * const userIdParam = new OasParameter({
 *   name: 'userId',
 *   location: 'path',
 *   description: 'Unique identifier for the user',
 *   required: true,
 *   schema: new OasString({
 *     pattern: '^[0-9a-f]{24}$',
 *     example: '507f1f77bcf86cd799439011'
 *   }),
 *   style: 'simple',
 *   explode: false
 * });
 * 
 * // Used in path: /users/{userId}
 * ```
 * 
 * @example Query parameter with validation
 * ```typescript
 * const pageSizeParam = new OasParameter({
 *   name: 'pageSize',
 *   location: 'query',
 *   description: 'Number of items to return per page',
 *   required: false,
 *   schema: new OasInteger({
 *     minimum: 1,
 *     maximum: 100,
 *     default: 20
 *   }),
 *   style: 'form',
 *   explode: true,
 *   examples: {
 *     small: new OasExample({ value: 10 }),
 *     medium: new OasExample({ value: 25 }),
 *     large: new OasExample({ value: 50 })
 *   }
 * });
 * 
 * // Used in query: ?pageSize=20
 * ```
 * 
 * @example Header parameter
 * ```typescript
 * const authHeaderParam = new OasParameter({
 *   name: 'Authorization',
 *   location: 'header',
 *   description: 'Bearer token for authentication',
 *   required: true,
 *   schema: new OasString({
 *     pattern: '^Bearer [A-Za-z0-9+/=]+$',
 *     example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *   }),
 *   style: 'simple',
 *   explode: false
 * });
 * ```
 * 
 * @example Complex parameter with content
 * ```typescript
 * const filterParam = new OasParameter({
 *   name: 'filter',
 *   location: 'query',
 *   description: 'Complex filter object',
 *   required: false,
 *   content: {
 *     'application/json': new OasMediaType({
 *       schema: new OasObject({
 *         properties: {
 *           category: new OasString(),
 *           priceRange: new OasObject({
 *             properties: {
 *               min: new OasNumber(),
 *               max: new OasNumber()
 *             }
 *           })
 *         }
 *       })
 *     })
 *   },
 *   style: 'deepObject',
 *   explode: true
 * });
 * 
 * // Used as: ?filter[category]=electronics&filter[priceRange][min]=100
 * ```
 * 
 * @example Array parameter with explode
 * ```typescript
 * const tagsParam = new OasParameter({
 *   name: 'tags',
 *   location: 'query',
 *   description: 'Filter by multiple tags',
 *   required: false,
 *   schema: new OasArray({
 *     items: new OasString(),
 *     minItems: 1,
 *     maxItems: 10
 *   }),
 *   style: 'form',
 *   explode: true // Results in: ?tags=tech&tags=api&tags=rest
 * });
 * 
 * // Without explode: ?tags=tech,api,rest
 * // With explode: ?tags=tech&tags=api&tags=rest
 * ```
 * 
 * @example Cookie parameter
 * ```typescript
 * const sessionParam = new OasParameter({
 *   name: 'sessionId',
 *   location: 'cookie',
 *   description: 'Session identifier cookie',
 *   required: false,
 *   schema: new OasString({
 *     minLength: 32,
 *     maxLength: 128
 *   }),
 *   style: 'form',
 *   explode: false
 * });
 * ```
 */
export class OasParameter {
  /** Type identifier for OAS parameter objects */
  oasType: 'parameter' = 'parameter'
  /** The name of the parameter */
  name: string
  /** Where the parameter is located (path, query, header, cookie) */
  location: OasParameterLocation
  /** A brief description of the parameter's purpose and usage */
  description?: string | undefined
  /** Determines whether this parameter is mandatory for the operation */
  required?: boolean | undefined
  /** Indicates that the parameter is deprecated and should be avoided */
  deprecated?: boolean | undefined
  /** Whether to allow empty values for this parameter */
  allowEmptyValue?: boolean | undefined
  /** Whether reserved characters are allowed in parameter values */
  allowReserved?: boolean | undefined
  /** The schema defining the parameter's data type and validation rules */
  schema?: OasSchema | OasRef<'schema'> | undefined
  /** Example values demonstrating parameter usage */
  examples?: Record<string, OasExample | OasRef<'example'>> | undefined
  /** Media type definitions for complex parameter content */
  content?: Record<string, OasMediaType> | undefined
  /** The serialization style for the parameter (form, simple, etc.) */
  style: OasParameterStyle
  /** Whether to explode parameter values into separate key-value pairs */
  explode: boolean
  /** Custom extension fields (x-* properties) defined for this parameter */
  extensionFields: Record<string, unknown> | undefined
  /**
   * Creates a new OasParameter instance.
   * 
   * @param fields - Parameter configuration fields including name, location, schema, and serialization options
   */
  constructor(fields: ParameterFields) {
    this.name = fields.name
    this.location = fields.location
    this.style = fields.style
    this.explode = fields.explode
    this.description = fields.description
    this.required = fields.required
    this.deprecated = fields.deprecated
    this.allowEmptyValue = fields.allowEmptyValue
    this.allowReserved = fields.allowReserved
    this.schema = fields.schema
    this.examples = fields.examples
    this.content = fields.content
    this.style = fields.style
    this.explode = fields.explode
    this.extensionFields = fields.extensionFields
  }

  /**
   * Determines if this parameter is a reference object.
   * 
   * @returns Always false since this is a concrete parameter instance, not a reference
   */
  isRef(): this is OasRef<'parameter'> {
    return false
  }

  /**
   * Resolves this parameter object.
   * 
   * @returns The parameter instance itself since it's already a concrete object
   */
  resolve(): OasParameter {
    return this
  }

  /**
   * Resolves this parameter object one level.
   * 
   * @returns The parameter instance itself since it's already a concrete object
   */
  resolveOnce(): OasParameter {
    return this
  }

  /**
   * Extracts the schema for this parameter.
   * 
   * Returns the direct schema if available, or extracts schema from content
   * for the specified media type.
   * 
   * @param mediaType - Media type to extract schema from when using content definitions
   * @returns The parameter's schema object
   * @throws Error if no schema is found for the specified media type
   */
  toSchema(mediaType: string = 'application/json'): OasSchema | OasRef<'schema'> {
    if (this.schema) {
      return this.schema
    }

    const schema = this.content?.[mediaType]?.schema

    if (!schema) {
      throw new Error(`Schema not found for media type ${mediaType}`)
    }

    return schema
  }

  /**
   * Converts this OAS parameter to an OpenAPI v3 JSON schema representation.
   * 
   * @param options - Conversion options including reference handling and formatting preferences
   * @returns OpenAPI v3 parameter object with all properties and validation constraints
   */
  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ParameterObject {
    return {
      name: this.name,
      in: this.location,
      description: this.description,
      required: this.required,
      deprecated: this.deprecated,
      allowEmptyValue: this.allowEmptyValue,
      allowReserved: this.allowReserved,
      schema: this.schema?.toJsonSchema(options),
      examples: this.examples,
      content: this.content
        ? Object.fromEntries(
            Object.entries(this.content).map(([mediaType, mediaTypeObject]) => [
              mediaType,
              mediaTypeObject.toJsonSchema(options)
            ])
          )
        : undefined,
      style: this.style,
      explode: this.explode
    }
  }
}
