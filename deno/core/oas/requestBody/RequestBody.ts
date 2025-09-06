import type { OasMediaType } from '../mediaType/MediaType.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Constructor fields for {@link OasRequestBody}.
 */
export type RequestBodyFields = {
  /** A description of the request body */
  description?: string | undefined
  /** Request content for different media types */
  content: Record<string, OasMediaType>
  /** Whether the request body is required */
  required?: boolean | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents a Request Body Object in the OpenAPI Specification.
 * 
 * The `OasRequestBody` class encapsulates the definition of a request body that
 * can be sent with HTTP operations. It supports multiple content types, schema
 * validation, and can be marked as required or optional. Request bodies are
 * commonly used with POST, PUT, PATCH, and sometimes DELETE operations.
 * 
 * This class provides comprehensive support for request body definitions with
 * typed content, multiple media type representations, and proper validation.
 * 
 * ## Key Features
 * 
 * - **Multiple Content Types**: Support for JSON, XML, form data, binary, and more
 * - **Schema Validation**: Typed request bodies through schema definitions
 * - **Required/Optional**: Control whether the request body is mandatory
 * - **Reference Support**: Can reference reusable request body components
 * - **Documentation**: Rich description support for API documentation
 * - **Media Type Flexibility**: Different schemas for different content types
 * 
 * @example Basic JSON request body
 * ```typescript
 * import { OasRequestBody, OasMediaType, OasObject, OasString } from '@skmtc/core';
 * 
 * const createUserRequest = new OasRequestBody({
 *   description: 'User data for creating a new user account',
 *   required: true,
 *   content: {
 *     'application/json': new OasMediaType({
 *       schema: new OasObject({
 *         properties: {
 *           name: new OasString({ 
 *             description: 'Full name',
 *             minLength: 1,
 *             maxLength: 100 
 *           }),
 *           email: new OasString({ 
 *             format: 'email',
 *             description: 'Email address' 
 *           }),
 *           password: new OasString({ 
 *             minLength: 8,
 *             description: 'Account password' 
 *           })
 *         },
 *         required: ['name', 'email', 'password']
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example Multiple content types
 * ```typescript
 * const multiFormatRequest = new OasRequestBody({
 *   description: 'Product data in multiple formats',
 *   required: true,
 *   content: {
 *     'application/json': new OasMediaType({
 *       schema: new OasRef({ $ref: '#/components/schemas/Product' })
 *     }),
 *     'application/xml': new OasMediaType({
 *       schema: new OasObject({
 *         properties: {
 *           product: new OasRef({ $ref: '#/components/schemas/Product' })
 *         }
 *       })
 *     }),
 *     'application/x-www-form-urlencoded': new OasMediaType({
 *       schema: new OasObject({
 *         properties: {
 *           name: new OasString(),
 *           price: new OasNumber({ format: 'double' }),
 *           category_id: new OasInteger()
 *         }
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example File upload request body
 * ```typescript
 * const fileUploadRequest = new OasRequestBody({
 *   description: 'File upload with metadata',
 *   required: true,
 *   content: {
 *     'multipart/form-data': new OasMediaType({
 *       schema: new OasObject({
 *         properties: {
 *           file: new OasString({
 *             format: 'binary',
 *             description: 'The file to upload'
 *           }),
 *           filename: new OasString({
 *             description: 'Original filename'
 *           }),
 *           description: new OasString({
 *             description: 'File description',
 *             required: false
 *           }),
 *           tags: new OasArray({
 *             items: new OasString(),
 *             description: 'File tags'
 *           })
 *         },
 *         required: ['file', 'filename']
 *       })
 *     }),
 *     'application/octet-stream': new OasMediaType({
 *       schema: new OasString({
 *         format: 'binary',
 *         description: 'Raw binary file content'
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example Optional request body for updates
 * ```typescript
 * const updateUserRequest = new OasRequestBody({
 *   description: 'Partial user data for updates (all fields optional)',
 *   required: false, // Request body itself is optional
 *   content: {
 *     'application/json': new OasMediaType({
 *       schema: new OasObject({
 *         properties: {
 *           name: new OasString({ description: 'Updated name' }),
 *           email: new OasString({ 
 *             format: 'email',
 *             description: 'Updated email' 
 *           }),
 *           bio: new OasString({ description: 'User biography' }),
 *           preferences: new OasObject({
 *             properties: {
 *               notifications: new OasBoolean(),
 *               theme: new OasString({ enum: ['light', 'dark'] })
 *             }
 *           })
 *         }
 *         // No required fields - all updates are optional
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example Complex nested data structures
 * ```typescript
 * const orderRequest = new OasRequestBody({
 *   description: 'Complete order with items and shipping',
 *   required: true,
 *   content: {
 *     'application/json': new OasMediaType({
 *       schema: new OasObject({
 *         properties: {
 *           customer: new OasObject({
 *             properties: {
 *               id: new OasString(),
 *               email: new OasString({ format: 'email' })
 *             },
 *             required: ['id']
 *           }),
 *           items: new OasArray({
 *             items: new OasObject({
 *               properties: {
 *                 productId: new OasString(),
 *                 quantity: new OasInteger({ minimum: 1 }),
 *                 customizations: new OasArray({
 *                   items: new OasString()
 *                 })
 *               },
 *               required: ['productId', 'quantity']
 *             }),
 *             minItems: 1
 *           }),
 *           shipping: new OasObject({
 *             properties: {
 *               address: new OasRef({ $ref: '#/components/schemas/Address' }),
 *               method: new OasString({ enum: ['standard', 'express', 'overnight'] }),
 *               instructions: new OasString()
 *             },
 *             required: ['address', 'method']
 *           }),
 *           couponCode: new OasString({ description: 'Optional discount code' })
 *         },
 *         required: ['customer', 'items', 'shipping']
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example Form data with validation
 * ```typescript
 * const registrationForm = new OasRequestBody({
 *   description: 'User registration form data',
 *   required: true,
 *   content: {
 *     'application/x-www-form-urlencoded': new OasMediaType({
 *       schema: new OasObject({
 *         properties: {
 *           username: new OasString({
 *             pattern: '^[a-zA-Z0-9_]{3,20}$',
 *             description: 'Alphanumeric username, 3-20 characters'
 *           }),
 *           email: new OasString({
 *             format: 'email',
 *             description: 'Valid email address'
 *           }),
 *           password: new OasString({
 *             minLength: 8,
 *             description: 'Password, minimum 8 characters'
 *           }),
 *           confirmPassword: new OasString({
 *             description: 'Password confirmation'
 *           }),
 *           agreeToTerms: new OasBoolean({
 *             enum: [true],
 *             description: 'Must accept terms of service'
 *           })
 *         },
 *         required: ['username', 'email', 'password', 'confirmPassword', 'agreeToTerms']
 *       })
 *     })
 *   }
 * });
 * ```
 * 
 * @example Using in operation definitions
 * ```typescript
 * const createProductOperation = new OasOperation({
 *   path: '/products',
 *   method: 'post',
 *   requestBody: createUserRequest,
 *   responses: {
 *     '201': new OasResponse({
 *       description: 'Product created successfully',
 *       content: {
 *         'application/json': new OasMediaType({
 *           schema: new OasRef({ $ref: '#/components/schemas/Product' })
 *         })
 *       }
 *     }),
 *     '400': new OasResponse({
 *       description: 'Invalid request data',
 *       content: {
 *         'application/json': new OasMediaType({
 *           schema: new OasRef({ $ref: '#/components/schemas/ValidationError' })
 *         })
 *       }
 *     })
 *   }
 * });
 * ```
 */
export class OasRequestBody {
  oasType: 'requestBody' = 'requestBody'
  description: string | undefined
  content: Record<string, OasMediaType>
  required: boolean | undefined
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: RequestBodyFields) {
    this.description = fields.description
    this.content = fields.content
    this.required = fields.required
    this.extensionFields = fields.extensionFields
  }

  isRef(): this is OasRef<'requestBody'> {
    return false
  }

  resolve(): OasRequestBody {
    return this
  }

  resolveOnce(): OasRequestBody {
    return this
  }

  toSchema(mediaType: string = 'application/json'): OasSchema | OasRef<'schema'> | undefined {
    return this.content?.[mediaType]?.schema
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.RequestBodyObject {
    return {
      description: this.description,
      content: Object.fromEntries(
        Object.entries(this.content).map(([mediaType, mediaTypeObject]) => [
          mediaType,
          mediaTypeObject.toJsonSchema(options)
        ])
      ),
      required: this.required
    }
  }
}
