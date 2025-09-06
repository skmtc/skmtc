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
 * ## Key Features
 * 
 * - **Schema Validation**: Typed header values through schema definitions
 * - **Examples**: Multiple example values for documentation and testing
 * - **Content Types**: Support for complex header values with media types
 * - **Deprecation Support**: Mark headers as deprecated with proper warnings
 * - **Required/Optional**: Control whether headers are mandatory
 * - **Documentation**: Rich description support for API documentation
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
 * 
 * @example Pagination headers
 * ```typescript
 * const totalCountHeader = new OasHeader({
 *   description: 'Total number of items available',
 *   required: false,
 *   schema: new OasInteger({
 *     minimum: 0,
 *     description: 'Non-negative integer count'
 *   }),
 *   examples: {
 *     empty: new OasExample({ value: 0, description: 'No items' }),
 *     normal: new OasExample({ value: 150, description: 'Normal case' }),
 *     large: new OasExample({ value: 10000, description: 'Large dataset' })
 *   }
 * });
 * 
 * const linkHeader = new OasHeader({
 *   description: 'Pagination links (RFC 5988)',
 *   required: false,
 *   schema: new OasString({
 *     description: 'Comma-separated list of link relations'
 *   }),
 *   examples: {
 *     withNext: new OasExample({
 *       value: '</api/users?page=2>; rel="next", </api/users?page=10>; rel="last"'
 *     }),
 *     lastPage: new OasExample({
 *       value: '</api/users?page=9>; rel="prev", </api/users?page=1>; rel="first"'
 *     })
 *   }
 * });
 * ```
 * 
 * @example Content type and encoding headers
 * ```typescript
 * const contentTypeHeader = new OasHeader({
 *   description: 'MIME type of the response content',
 *   required: true,
 *   schema: new OasString({
 *     enum: [
 *       'application/json',
 *       'application/xml', 
 *       'text/csv',
 *       'application/pdf',
 *       'application/octet-stream'
 *     ]
 *   }),
 *   examples: {
 *     json: new OasExample({ value: 'application/json' }),
 *     xml: new OasExample({ value: 'application/xml' }),
 *     csv: new OasExample({ value: 'text/csv' })
 *   }
 * });
 * 
 * const contentLengthHeader = new OasHeader({
 *   description: 'Size of the response body in bytes',
 *   required: false,
 *   schema: new OasInteger({
 *     minimum: 0,
 *     description: 'Content size in bytes'
 *   })
 * });
 * ```
 * 
 * @example Rate limiting headers
 * ```typescript
 * const rateLimitHeader = new OasHeader({
 *   description: 'Number of requests remaining in the current window',
 *   required: false,
 *   schema: new OasInteger({
 *     minimum: 0,
 *     description: 'Remaining request count'
 *   }),
 *   examples: {
 *     available: new OasExample({ value: 95, description: '95 requests remaining' }),
 *     depleted: new OasExample({ value: 0, description: 'Rate limit reached' })
 *   }
 * });
 * 
 * const rateLimitResetHeader = new OasHeader({
 *   description: 'Unix timestamp when the rate limit window resets',
 *   required: false,
 *   schema: new OasInteger({
 *     minimum: 0,
 *     description: 'Unix timestamp in seconds'
 *   }),
 *   examples: {
 *     reset: new OasExample({ 
 *       value: 1634567890, 
 *       description: 'Reset at 2021-10-18 12:31:30 UTC' 
 *     })
 *   }
 * });
 * ```
 * 
 * @example Custom application headers
 * ```typescript
 * const requestIdHeader = new OasHeader({
 *   description: 'Unique identifier for request tracing',
 *   required: false,
 *   schema: new OasString({
 *     format: 'uuid',
 *     description: 'UUID v4 request identifier'
 *   }),
 *   examples: {
 *     uuid: new OasExample({ 
 *       value: '123e4567-e89b-12d3-a456-426614174000',
 *       description: 'Request tracking ID'
 *     })
 *   }
 * });
 * 
 * const serverTimingHeader = new OasHeader({
 *   description: 'Server-side performance metrics',
 *   required: false,
 *   schema: new OasString({
 *     description: 'Server-Timing header format (RFC 8760)'
 *   }),
 *   examples: {
 *     timing: new OasExample({
 *       value: 'db;dur=53, app;dur=47.2',
 *       description: 'Database took 53ms, app logic 47.2ms'
 *     })
 *   }
 * });
 * ```
 * 
 * @example Deprecated header
 * ```typescript
 * const deprecatedHeader = new OasHeader({
 *   description: 'Legacy API version header (deprecated)',
 *   required: false,
 *   deprecated: true,
 *   schema: new OasString({
 *     enum: ['v1', 'v2'],
 *     description: 'Use Accept or Content-Type header instead'
 *   }),
 *   examples: {
 *     legacy: new OasExample({ 
 *       value: 'v1',
 *       description: 'Legacy version (use Accept header instead)'
 *     })
 *   }
 * });
 * ```
 * 
 * @example Using in response definitions
 * ```typescript
 * const successResponse = new OasResponse({
 *   description: 'Paginated user list',
 *   headers: {
 *     'X-Total-Count': totalCountHeader,
 *     'Link': linkHeader,
 *     'X-Rate-Limit-Remaining': rateLimitHeader,
 *     'X-Rate-Limit-Reset': rateLimitResetHeader,
 *     'X-Request-ID': requestIdHeader
 *   },
 *   content: {
 *     'application/json': new OasMediaType({
 *       schema: new OasArray({
 *         items: new OasRef({ $ref: '#/components/schemas/User' })
 *       })
 *     })
 *   }
 * });
 * ```
 */
export class OasHeader {
  oasType: 'header' = 'header'
  #fields: HeaderFields

  constructor(fields: HeaderFields) {
    this.#fields = fields
  }

  /** Brief description of header */
  get description(): string | undefined {
    return this.#fields.description
  }

  /** Indicates if header is mandatory. Default value is `false` */
  get required(): boolean | undefined {
    return this.#fields.required
  }

  /** Indicates if header is deprecated and should no longer be used. Default value is false */
  get deprecated(): boolean | undefined {
    return this.#fields.deprecated
  }

  /** Schema for the header */
  get schema(): OasSchema | OasRef<'schema'> | undefined {
    return this.#fields.schema
  }

  /** Examples of the header */
  get examples(): Record<string, OasExample | OasRef<'example'>> | undefined {
    return this.#fields.examples
  }

  /** Content of the header */
  get content(): Record<string, OasMediaType> | undefined {
    return this.#fields.content
  }

  /** Specification Extension fields */
  get extensionFields(): Record<string, unknown> | undefined {
    return this.#fields.extensionFields
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

    const schema = this.#fields.content?.[mediaType]?.schema

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
