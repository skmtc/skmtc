import type { OasHeader } from '../header/Header.ts'
import type { OasMediaType } from '../mediaType/MediaType.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Constructor fields for {@link OasResponse}.
 */
export type ResponseFields = {
  /** A description of the response */
  description?: string | undefined
  /** Response headers that can be sent */
  headers?: Record<string, OasHeader | OasRef<'header'>> | undefined
  /** Response content for different media types */
  content?: Record<string, OasMediaType> | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents a Response Object in the OpenAPI Specification.
 * 
 * The `OasResponse` class encapsulates the definition of a single HTTP response,
 * including its description, headers, and content for different media types.
 * Responses describe the possible outcomes of API operations and can include
 * both successful and error scenarios.
 * 
 * This class provides comprehensive support for response definitions with typed
 * content, custom headers, and multiple media type representations.
 * 
 * ## Key Features
 * 
 * - **Content Types**: Support for multiple media types (JSON, XML, HTML, etc.)
 * - **Header Definitions**: Custom response headers with validation
 * - **Schema Integration**: Typed response bodies through schema definitions
 * - **Reference Support**: Can reference reusable response components
 * - **Documentation**: Rich description support for API documentation
 * - **JSON Schema**: Converts to standard JSON Schema format for validation
 * 
 * @example Basic JSON response
 * ```typescript
 * import { OasResponse, OasMediaType, OasObject, OasString } from '@skmtc/core';
 * 
 * const successResponse = new OasResponse({
 *   description: 'User retrieved successfully',
 *   content: {
 *     'application/json': new OasMediaType({
 *       schema: new OasObject({
 *         properties: {
 *           id: new OasString(),
 *           name: new OasString(),
 *           email: new OasString({ format: 'email' })
 *         }
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example Response with custom headers
 * ```typescript
 * const paginatedResponse = new OasResponse({
 *   description: 'Paginated list of items',
 *   headers: {
 *     'X-Total-Count': new OasHeader({
 *       description: 'Total number of items',
 *       schema: new OasInteger({ minimum: 0 })
 *     }),
 *     'X-Page-Number': new OasHeader({
 *       description: 'Current page number',
 *       schema: new OasInteger({ minimum: 1 })
 *     }),
 *     'Link': new OasHeader({
 *       description: 'Pagination links',
 *       schema: new OasString()
 *     })
 *   },
 *   content: {
 *     'application/json': new OasMediaType({
 *       schema: new OasArray({
 *         items: new OasRef({ $ref: '#/components/schemas/Item' })
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example Multiple content types
 * ```typescript
 * const multiFormatResponse = new OasResponse({
 *   description: 'User data in multiple formats',
 *   content: {
 *     'application/json': new OasMediaType({
 *       schema: new OasRef({ $ref: '#/components/schemas/User' })
 *     }),
 *     'application/xml': new OasMediaType({
 *       schema: new OasObject({
 *         // XML-specific schema definition
 *         properties: {
 *           user: new OasRef({ $ref: '#/components/schemas/User' })
 *         }
 *       })
 *     }),
 *     'text/csv': new OasMediaType({
 *       schema: new OasString({
 *         description: 'User data in CSV format'
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example Error responses
 * ```typescript
 * const errorResponse = new OasResponse({
 *   description: 'Validation error occurred',
 *   content: {
 *     'application/json': new OasMediaType({
 *       schema: new OasObject({
 *         properties: {
 *           error: new OasString({ description: 'Error message' }),
 *           code: new OasString({ description: 'Error code' }),
 *           details: new OasArray({
 *             items: new OasObject({
 *               properties: {
 *                 field: new OasString(),
 *                 message: new OasString()
 *               }
 *             })
 *           })
 *         },
 *         required: ['error', 'code']
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example File download response
 * ```typescript
 * const fileDownloadResponse = new OasResponse({
 *   description: 'File download',
 *   headers: {
 *     'Content-Disposition': new OasHeader({
 *       description: 'Attachment filename',
 *       schema: new OasString({ example: 'attachment; filename="report.pdf"' })
 *     }),
 *     'Content-Length': new OasHeader({
 *       description: 'File size in bytes',
 *       schema: new OasInteger({ minimum: 0 })
 *     })
 *   },
 *   content: {
 *     'application/pdf': new OasMediaType({
 *       schema: new OasString({
 *         format: 'binary',
 *         description: 'PDF file content'
 *       })
 *     }),
 *     'application/octet-stream': new OasMediaType({
 *       schema: new OasString({
 *         format: 'binary',
 *         description: 'Generic binary content'
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example No content response
 * ```typescript
 * const noContentResponse = new OasResponse({
 *   description: 'Operation completed successfully, no content returned'
 *   // No content or headers - represents HTTP 204 No Content
 * });
 * ```
 * 
 * @example Using in operation definitions
 * ```typescript
 * const getUserOperation = new OasOperation({
 *   path: '/users/{id}',
 *   method: 'get',
 *   responses: {
 *     '200': successResponse,
 *     '404': new OasResponse({
 *       description: 'User not found',
 *       content: {
 *         'application/json': new OasMediaType({
 *           schema: new OasObject({
 *             properties: {
 *               error: new OasString({ example: 'User not found' }),
 *               code: new OasString({ example: 'USER_NOT_FOUND' })
 *             }
 *           })
 *         })
 *       }
 *     }),
 *     '500': new OasRef({ $ref: '#/components/responses/InternalServerError' })
 *   }
 * });
 * ```
 */
export class OasResponse {
  oasType: 'response' = 'response'
  description: string | undefined
  headers: Record<string, OasHeader | OasRef<'header'>> | undefined
  content: Record<string, OasMediaType> | undefined
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: ResponseFields) {
    this.description = fields.description
    this.headers = fields.headers
    this.content = fields.content
    this.extensionFields = fields.extensionFields
  }

  isRef(): this is OasRef<'response'> {
    return false
  }

  resolve(): OasResponse {
    return this
  }

  resolveOnce(): OasResponse {
    return this
  }

  toSchema(mediaType: string = 'application/json'): OasSchema | OasRef<'schema'> | undefined {
    return this.content?.[mediaType]?.schema
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ResponseObject {
    return {
      description: this.description ?? '',
      headers: this.headers
        ? Object.fromEntries(
            Object.entries(this.headers).map(([header, headerObject]) => [
              header,
              headerObject.toJsonSchema(options)
            ])
          )
        : undefined,
      content: this.content
        ? Object.fromEntries(
            Object.entries(this.content).map(([mediaType, mediaTypeObject]) => [
              mediaType,
              mediaTypeObject.toJsonSchema(options)
            ])
          )
        : undefined
    }
  }
}
