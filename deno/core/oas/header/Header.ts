import type { OasMediaType } from '../mediaType/MediaType.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasExample } from '../example/Example.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Constructor fields for {@link OasHeader}.
 */
export type HeaderFields = {
  /** A brief description of the header */
  description: string | undefined
  /** Whether the header is required */
  required: boolean | undefined
  /** Whether the header is deprecated */
  deprecated: boolean | undefined
  /** Schema defining the header's data type */
  schema: OasSchema | OasRef<'schema'> | undefined
  /** Example values for the header */
  examples: Record<string, OasExample | OasRef<'example'>> | undefined
  /** Content definitions for complex header values */
  content: Record<string, OasMediaType> | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents a Header Object in the OpenAPI Specification.
 *
 * The `OasHeader` class encapsulates the definition of a single HTTP header that
 * can be sent with responses or expected in requests. Headers provide additional
 * metadata about the HTTP message and can include authentication tokens, content
 * information, pagination data, rate limiting details, and more.
 *
 * This class provides comprehensive support for header definitions with typed
 * values, validation schemas, examples, and documentation.
 *
 * @example Basic authentication header
 * ```typescript
 * import { OasHeader, OasString } from '@skmtc/core';
 *
 * const authHeader = new OasHeader({
 *   description: 'Bearer token for API authentication',
 *   required: true,
 *   schema: new OasString({
 *     pattern: '^Bearer [A-Za-z0-9+/=]+$',
 *     description: 'JWT bearer token'
 *   }),
 *   examples: {
 *     valid: new OasExample({
 *       summary: 'Valid bearer token',
 *       value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *     })
 *   }
 * });
 * ```
 */
export class OasHeader {
  oasType: 'header' = 'header'
  /** Brief description of header */
  description: string | undefined
  /** Indicates if header is mandatory. Default value is `false` */
  required: boolean | undefined
  /** Indicates if header is deprecated and should no longer be used. Default value is false */
  deprecated: boolean | undefined
  /** Schema for the header */
  schema: OasSchema | OasRef<'schema'> | undefined
  /** Examples of the header */
  examples: Record<string, OasExample | OasRef<'example'>> | undefined
  /** Content of the header */
  content: Record<string, OasMediaType> | undefined
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined

  constructor(fields: HeaderFields) {
    this.description = fields.description
    this.required = fields.required
    this.deprecated = fields.deprecated
    this.schema = fields.schema
    this.examples = fields.examples
    this.content = fields.content
    this.extensionFields = fields.extensionFields
  }

  /** Returns true if object is a reference */
  isRef(): this is OasRef<'header'> {
    return false
  }

  /** Returns itself */
  resolve(): OasHeader {
    return this
  }

  resolveOnce(): OasHeader {
    return this
  }

  /** Returns schema for the header. Either, `schema` property if
   * definedor value matching `mediaType` from `content` property.
   *
   * @param mediaType - Optional media type to get schema for. Defaults to `application/json`
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

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.HeaderObject {
    return {
      description: this.description,
      required: this.required ?? false,
      deprecated: this.deprecated ?? false,
      schema: this.schema?.toJsonSchema(options),
      examples: this.examples
    }
  }
}
