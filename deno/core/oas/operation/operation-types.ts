import { markdown } from '../markdown/markdown-types.ts'
import { type OasParameterData, oasParameterData } from '../parameter/parameter-types.ts'
import { type OasPathItemData, oasPathItemData } from '../pathItem/pathItem-types.ts'
import {
  type OasParameterRefData,
  type OasRequestBodyRefData,
  type OasResponseRefData,
  oasParameterRefData,
  oasRequestBodyRefData,
  oasResponseRefData
} from '../ref/ref-types.ts'
import { type OasRequestBodyData, oasRequestBodyData } from '../requestBody/requestBody-types.ts'
import { type OasResponseData, oasResponseData } from '../response/response-types.ts'
import * as v from 'valibot'

/**
 * Data type for OpenAPI operation objects processed by the SKMTC pipeline.
 * 
 * This type represents a complete OpenAPI operation (API endpoint) including all
 * associated metadata, parameters, request body, responses, and path information.
 * It serves as the internal representation of OpenAPI operations during the
 * code generation process, combining operation data with its parent path item context.
 * 
 * ## Usage in SKMTC Pipeline
 * 
 * This type is used by:
 * - Operation parsers to validate and structure incoming OpenAPI operations
 * - Code generators to access operation metadata and generate client code
 * - Response processors to understand expected API responses
 * - Parameter handlers to generate request validation and typing
 * 
 * @example Basic GET operation
 * ```typescript
 * import type { OasOperationData } from '@skmtc/core/oas/operation';
 * 
 * const getUserOperation: OasOperationData = {
 *   oasType: 'operation',
 *   path: '/users/{id}',
 *   method: 'get',
 *   operationId: 'getUserById',
 *   summary: 'Get user by ID',
 *   description: 'Retrieves a specific user by their unique identifier',
 *   tags: ['users'],
 *   parameters: [
 *     {
 *       name: 'id',
 *       in: 'path',
 *       required: true,
 *       schema: { type: 'string' }
 *     }
 *   ],
 *   responses: {
 *     '200': {
 *       description: 'User found',
 *       content: {
 *         'application/json': {
 *           schema: { $ref: '#/components/schemas/User' }
 *         }
 *       }
 *     },
 *     '404': {
 *       description: 'User not found'
 *     }
 *   },
 *   pathItem: pathItemData
 * };
 * ```
 * 
 * @example POST operation with request body
 * ```typescript
 * const createUserOperation: OasOperationData = {
 *   oasType: 'operation',
 *   path: '/users',
 *   method: 'post',
 *   operationId: 'createUser',
 *   summary: 'Create new user',
 *   description: 'Creates a new user account',
 *   tags: ['users'],
 *   requestBody: {
 *     description: 'User data',
 *     required: true,
 *     content: {
 *       'application/json': {
 *         schema: { $ref: '#/components/schemas/CreateUserRequest' }
 *       }
 *     }
 *   },
 *   responses: {
 *     '201': {
 *       description: 'User created successfully',
 *       content: {
 *         'application/json': {
 *           schema: { $ref: '#/components/schemas/User' }
 *         }
 *       }
 *     },
 *     '400': {
 *       description: 'Invalid request data'
 *     }
 *   },
 *   pathItem: pathItemData
 * };
 * ```
 * 
 * @example Operation with query parameters
 * ```typescript
 * const listUsersOperation: OasOperationData = {
 *   oasType: 'operation',
 *   path: '/users',
 *   method: 'get',
 *   operationId: 'listUsers',
 *   summary: 'List users',
 *   description: 'Get paginated list of users',
 *   tags: ['users'],
 *   parameters: [
 *     {
 *       name: 'page',
 *       in: 'query',
 *       schema: { type: 'integer', minimum: 1, default: 1 }
 *     },
 *     {
 *       name: 'limit',
 *       in: 'query',
 *       schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
 *     },
 *     {
 *       name: 'status',
 *       in: 'query',
 *       schema: { type: 'string', enum: ['active', 'inactive'] }
 *     }
 *   ],
 *   responses: {
 *     '200': {
 *       description: 'List of users',
 *       content: {
 *         'application/json': {
 *           schema: {
 *             type: 'object',
 *             properties: {
 *               users: {
 *                 type: 'array',
 *                 items: { $ref: '#/components/schemas/User' }
 *               },
 *               totalCount: { type: 'integer' },
 *               page: { type: 'integer' },
 *               limit: { type: 'integer' }
 *             }
 *           }
 *         }
 *       }
 *     }
 *   },
 *   pathItem: pathItemData
 * };
 * ```
 */
export type OasOperationData = {
  /** Type identifier for SKMTC internal processing */
  oasType: 'operation'
  /** Parent path item containing this operation */
  pathItem: OasPathItemData
  /** The API path template (e.g., '/users/{id}') */
  path: string
  /** HTTP method for this operation */
  method: 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'
  /** Unique identifier for this operation (used for client method names) */
  operationId?: string
  /** Tags for grouping operations (used for code organization) */
  tags?: string[]
  /** Brief summary of what the operation does */
  summary?: string
  /** Detailed description of the operation behavior */
  description?: string
  // externalDocs?: ExternalDocs
  // operationId?: string
  /** List of parameters (path, query, header, cookie) */
  parameters?: (OasParameterData | OasParameterRefData)[]
  /** Request body specification for operations that accept data */
  requestBody?: OasRequestBodyData | OasRequestBodyRefData
  /** Map of status codes to response specifications */
  responses: Record<string, OasResponseData | OasResponseRefData>
  // callbacks: never
  /** Whether this operation is deprecated */
  deprecated?: boolean
  // security: never
  // servers?: Server[]
}

/**
 * Valibot schema for validating OpenAPI operation data objects.
 * 
 * This comprehensive schema validates OpenAPI operations according to the OpenAPI v3
 * specification, including all standard properties like HTTP methods, parameters,
 * request bodies, responses, and metadata. It uses lazy evaluation and unions to
 * handle complex nested structures and reference objects.
 * 
 * The schema ensures that operation data conforms to OpenAPI standards while also
 * including SKMTC-specific metadata (like `oasType` and `pathItem`) needed for
 * the code generation pipeline.
 * 
 * @example Validating a GET operation
 * ```typescript
 * import { oasOperationData } from '@skmtc/core/oas/operation';
 * import * as v from 'valibot';
 * 
 * const operation = {
 *   oasType: 'operation',
 *   path: '/api/users/{id}',
 *   method: 'get',
 *   operationId: 'getUserById',
 *   summary: 'Get user by ID',
 *   parameters: [
 *     {
 *       name: 'id',
 *       in: 'path',
 *       required: true,
 *       schema: { type: 'string' }
 *     }
 *   ],
 *   responses: {
 *     '200': {
 *       description: 'Success',
 *       content: {
 *         'application/json': {
 *           schema: { $ref: '#/components/schemas/User' }
 *         }
 *       }
 *     }
 *   },
 *   pathItem: validPathItem
 * };
 * 
 * const validated = v.parse(oasOperationData, operation);
 * console.log(validated.operationId); // 'getUserById'
 * ```
 * 
 * @example Validating a POST operation with request body
 * ```typescript
 * const postOperation = {
 *   oasType: 'operation',
 *   path: '/api/users',
 *   method: 'post',
 *   operationId: 'createUser',
 *   requestBody: {
 *     description: 'User data',
 *     required: true,
 *     content: {
 *       'application/json': {
 *         schema: { $ref: '#/components/schemas/CreateUserRequest' }
 *       }
 *     }
 *   },
 *   responses: {
 *     '201': {
 *       description: 'User created',
 *       content: {
 *         'application/json': {
 *           schema: { $ref: '#/components/schemas/User' }
 *         }
 *       }
 *     }
 *   },
 *   pathItem: validPathItem
 * };
 * 
 * const validated = v.parse(oasOperationData, postOperation);
 * console.log(validated.method); // 'post'
 * ```
 * 
 * @example Validation error handling
 * ```typescript
 * const invalidOperation = {
 *   oasType: 'operation',
 *   path: '/api/users',
 *   method: 'invalid', // Invalid HTTP method
 *   responses: {} // Missing required responses
 * };
 * 
 * try {
 *   v.parse(oasOperationData, invalidOperation);
 * } catch (error) {
 *   console.error('Validation failed:', error.message);
 *   // Handle validation errors
 * }
 * ```
 */
export const oasOperationData: v.GenericSchema<OasOperationData> = v.object({
  oasType: v.literal('operation'),
  pathItem: oasPathItemData,
  path: v.string(),
  method: v.enum({
    get: 'get',
    put: 'put',
    post: 'post',
    delete: 'delete',
    options: 'options',
    head: 'head',
    patch: 'patch',
    trace: 'trace'
  }),
  operationId: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  summary: v.optional(v.string()),
  description: v.optional(markdown),
  // externalDocs: externalDocs.optional(),
  // operationId: z.string().optional(),
  parameters: v.optional(v.array(v.union([oasParameterData, oasParameterRefData]))),
  requestBody: v.optional(v.union([oasRequestBodyData, oasRequestBodyRefData])),
  responses: v.record(v.string(), v.union([oasResponseData, oasResponseRefData])),
  // callbacks: z.never(),
  deprecated: v.optional(v.boolean())
  // security: z.never(),
  // servers: z.array(server).optional()
})
