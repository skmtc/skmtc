import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasExample } from '../example/Example.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Constructor fields for {@link OasMediaType}.
 */
export type MediaTypeFields = {
  /** The media type string (e.g., 'application/json', 'text/xml') */
  mediaType: string
  /** The schema defining the structure of the content */
  schema?: OasSchema | OasRef<'schema'> | undefined
  /** Example values for the media type */
  examples?: Record<string, OasExample | OasRef<'example'>> | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
  /** Encoding information for multipart or form data */
  encoding?: Record<string, unknown> | undefined
}

/**
 * Represents a Media Type Object in the OpenAPI Specification.
 * 
 * The `OasMediaType` class encapsulates the definition of content for different
 * media types in request bodies and responses. It defines the structure, format,
 * and validation rules for content using schemas and provides examples for
 * documentation and testing purposes.
 * 
 * This class supports various content types including JSON, XML, form data,
 * file uploads, and binary content, making it essential for describing API
 * request and response payloads.
 * 
 * ## Key Features
 * 
 * - **Schema Validation**: Define content structure through OpenAPI schemas
 * - **Multiple Examples**: Rich example support for documentation and testing
 * - **Encoding Support**: Handle multipart and form data encoding
 * - **Content Type Support**: JSON, XML, binary, form data, and more
 * - **Reference Integration**: Work seamlessly with schema references
 * 
 * @example JSON content type
 * ```typescript
 * import { OasMediaType, OasObject, OasString } from '@skmtc/core';
 * 
 * const jsonContent = new OasMediaType({
 *   mediaType: 'application/json',
 *   schema: new OasObject({
 *     properties: {
 *       name: new OasString(),
 *       email: new OasString({ format: 'email' })
 *     }
 *   }),
 *   examples: {
 *     user: new OasExample({
 *       summary: 'Sample user',
 *       value: { name: 'John Doe', email: 'john@example.com' }
 *     })
 *   }
 * });
 * ```
 * 
 * @example File upload with multipart form data
 * ```typescript
 * const fileUpload = new OasMediaType({
 *   mediaType: 'multipart/form-data',
 *   schema: new OasObject({
 *     properties: {
 *       file: new OasString({ format: 'binary' }),
 *       description: new OasString()
 *     }
 *   }),
 *   encoding: {
 *     file: {
 *       contentType: 'image/png, image/jpeg',
 *       style: 'form'
 *     }
 *   }
 * });
 * ```
 * 
 * @example XML content with namespace
 * ```typescript
 * const xmlContent = new OasMediaType({
 *   mediaType: 'application/xml',
 *   schema: new OasObject({
 *     properties: {
 *       product: new OasRef({ $ref: '#/components/schemas/Product' })
 *     }
 *   }),
 *   examples: {
 *     sample: new OasExample({
 *       value: '<product><name>Widget</name><price>19.99</price></product>'
 *     })
 *   }
 * });
 * ```
 */
export class OasMediaType {
  oasType: 'mediaType' = 'mediaType'
  mediaType: string
  schema: OasSchema | OasRef<'schema'> | undefined
  examples: Record<string, OasExample | OasRef<'example'>> | undefined
  extensionFields: Record<string, unknown> | undefined
  encoding?: Record<string, unknown> | undefined
  constructor(fields: MediaTypeFields) {
    this.mediaType = fields.mediaType
    this.schema = fields.schema
    this.examples = fields.examples
    this.encoding = fields.encoding
    this.extensionFields = fields.extensionFields
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.MediaTypeObject {
    return {
      schema: this.schema?.toJsonSchema(options),
      examples: this.examples
    }
  }
}
