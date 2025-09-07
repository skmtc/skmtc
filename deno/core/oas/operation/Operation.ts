import type { Method } from '../../types/Method.ts'
import type { OasPathItem } from '../pathItem/PathItem.ts'
import type { OasParameter } from '../parameter/Parameter.ts'
import type { OasRequestBody } from '../requestBody/RequestBody.ts'
import type { OasResponse } from '../response/Response.ts'
import type { OasParameterLocation } from '../parameter/parameter-types.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import { OasObject } from '../object/Object.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSecurityRequirement } from '../securityRequirement/SecurityRequirement.ts'
/**
 * Fields for configuring an OpenAPI operation object.
 * 
 * Contains all the properties needed to define a complete OpenAPI operation,
 * including path information, parameters, request/response specifications,
 * security requirements, and metadata.
 */
export type OperationFields = {
  /** The API path for this operation */
  path: string
  /** The HTTP method for this operation */
  method: Method
  /** The parent path item containing this operation */
  pathItem: OasPathItem | undefined
  /** Unique identifier for the operation */
  operationId?: string | undefined
  /** Brief summary of the operation */
  summary?: string | undefined
  /** Tags for organizing operations in documentation */
  tags?: string[] | undefined
  /** Detailed description of the operation */
  description?: string | undefined
  /** Parameters accepted by this operation */
  parameters?: (OasParameter | OasRef<'parameter'>)[] | undefined
  /** Request body specification for this operation */
  requestBody?: OasRequestBody | OasRef<'requestBody'> | undefined
  /** Response specifications mapped by status code */
  responses: Record<string, OasResponse | OasRef<'response'>>
  /** Security requirements for this operation */
  security?: OasSecurityRequirement[] | undefined
  /** Whether this operation is deprecated */
  deprecated?: boolean | undefined
  /** OpenAPI specification extensions */
  extensionFields?: Record<string, unknown>
}

type ToRequestBodyMapArgs = {
  schema: OasSchema | OasRef<'schema'>
  requestBody: OasRequestBody
}

/**
 * Represents an OpenAPI Operation Object in the SKMTC OAS processing system.
 * 
 * The `OasOperation` class encapsulates a single API operation (path + method combination)
 * with all its associated metadata, parameters, request/response specifications, and
 * security requirements. It provides utilities for extracting common operation data
 * like success responses and request bodies.
 * 
 * ## Key Features
 * 
 * - **Path and Method**: Unique combination identifying the operation
 * - **Metadata Access**: Operation ID, summary, description, tags, and deprecation status
 * - **Parameter Handling**: Query, path, header, and cookie parameters
 * - **Request/Response Specs**: Type-safe access to request body and response definitions
 * - **Security Context**: Operation-specific security requirements
 * - **Success Response Utils**: Helper methods to identify and extract successful responses
 * 
 * @example Basic operation properties
 * ```typescript
 * import { OasOperation } from '@skmtc/core';
 * 
 * // Typically created during document parsing
 * const getUserOp = new OasOperation({
 *   path: '/users/{id}',
 *   method: 'get',
 *   operationId: 'getUserById',
 *   summary: 'Get user by ID',
 *   description: 'Retrieves a single user by their unique identifier',
 *   parameters: [
 *     // Path parameter for user ID
 *     { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
 *   ],
 *   responses: {
 *     '200': { description: 'User found', content: { ... } },
 *     '404': { description: 'User not found' }
 *   }
 * });
 * 
 * console.log(getUserOp.path);        // '/users/{id}'
 * console.log(getUserOp.method);      // 'get'
 * console.log(getUserOp.operationId); // 'getUserById'
 * ```
 * 
 * @example Working with success responses
 * ```typescript
 * // Find the primary success response
 * const successResponse = operation.toSuccessResponse();
 * if (successResponse) {
 *   const resolved = successResponse.resolve();
 *   console.log('Success response:', resolved.description);
 * }
 * 
 * // Get the HTTP status code for success
 * const successCode = operation.toSuccessResponseCode();
 * console.log('Success status:', successCode); // '200', '201', 'default', etc.
 * ```
 * 
 * @example Extracting request body data
 * ```typescript
 * // Extract request body with custom transformation
 * const requestData = operation.toRequestBody(({ schema, requestBody }) => {
 *   return {
 *     schema: schema,
 *     contentType: 'application/json',
 *     required: requestBody.required ?? false,
 *     description: requestBody.description
 *   };
 * });
 * 
 * if (requestData) {
 *   console.log('Request schema:', requestData.schema);
 *   console.log('Required:', requestData.required);
 * }
 * ```
 * 
 * @example Parameter processing
 * ```typescript
 * // Process operation parameters by location
 * const pathParams = operation.parameters?.filter(param => {
 *   const resolved = param.resolve();
 *   return resolved.in === 'path';
 * });
 * 
 * const queryParams = operation.parameters?.filter(param => {
 *   const resolved = param.resolve();
 *   return resolved.in === 'query';
 * });
 * 
 * console.log('Path parameters:', pathParams?.length);
 * console.log('Query parameters:', queryParams?.length);
 * ```
 * 
 * @example Security requirements
 * ```typescript
 * if (operation.security) {
 *   console.log('Operation has specific security requirements');
 *   for (const requirement of operation.security) {
 *     // Process security schemes for this operation
 *     Object.keys(requirement.schemes).forEach(scheme => {
 *       console.log(`Security scheme: ${scheme}`);
 *     });
 *   }
 * } else {
 *   console.log('Operation uses default document security');
 * }
 * ```
 */
export class OasOperation {
  /** Type identifier for OAS operation objects */
  oasType: 'operation' = 'operation'

  /** The API path for this operation */
  path: string
  /** The HTTP method for this operation */
  method: Method
  /** The parent path item containing this operation */
  pathItem: OasPathItem | undefined
  /** Unique identifier for the operation */
  operationId: string | undefined
  /** Brief summary of the operation */
  summary: string | undefined
  /** Tags for organizing operations in documentation */
  tags: string[] | undefined
  /** Detailed description of the operation */
  description: string | undefined
  /** Parameters accepted by this operation */
  parameters: (OasParameter | OasRef<'parameter'>)[] | undefined
  /** Request body specification for this operation */
  requestBody: OasRequestBody | OasRef<'requestBody'> | undefined
  /** Response specifications mapped by status code */
  responses: Record<string, OasResponse | OasRef<'response'>>
  /** Security requirements for this operation */
  security: OasSecurityRequirement[] | undefined
  /** Whether this operation is deprecated */
  deprecated: boolean | undefined
  /** OpenAPI specification extensions */
  extensionFields: Record<string, unknown> | undefined

  constructor(fields: OperationFields) {
    this.path = fields.path
    this.method = fields.method
    this.pathItem = fields.pathItem
    this.operationId = fields.operationId
    this.summary = fields.summary
    this.tags = fields.tags
    this.description = fields.description
    this.parameters = fields.parameters
    this.requestBody = fields.requestBody
    this.responses = fields.responses
    this.security = fields.security
    this.deprecated = fields.deprecated
    this.extensionFields = fields.extensionFields
  }

  toSuccessResponse(): OasResponse | OasRef<'response'> | undefined {
    const successCode = this.toSuccessResponseCode()

    return successCode ? this.responses[successCode] : undefined
  }

  toSuccessResponseCode(): string | undefined {
    const successCode = Object.keys(this.responses)
      .map(httpCode => parseInt(httpCode))
      .sort((a, b) => a - b)
      .find(httpCode => httpCode >= 200 && httpCode < 300)

    if (successCode) {
      return successCode.toString()
    }

    if (this.responses.default) {
      return 'default'
    }

    return undefined
  }

  toRequestBody<V>(
    map: ({ schema, requestBody }: ToRequestBodyMapArgs) => V,
    mediaType = 'application/json'
  ): V | undefined {
    const requestBody = this.requestBody?.resolve()
    const schema = requestBody?.content[mediaType]?.schema

    return schema ? map({ schema, requestBody }) : undefined
  }

  /**
   * Resolve all parameters and optionally filter by location
   *
   * @param filter - only include parameters from specified locations
   * @returns
   */
  toParams(filter?: OasParameterLocation[]): OasParameter[] {
    return (
      this.parameters
        ?.map(param => param.resolve())
        .filter(param => (filter?.length ? filter.includes(param.location) : true)) ?? []
    )
  }

  toParametersObject(filter?: OasParameterLocation[]): OasObject {
    const parameters = this.toParams(filter)

    return parameters.reduce<OasObject>((acc, parameter) => {
      return acc.addProperty({
        name: parameter.name,
        schema: parameter.toSchema(),
        required: parameter.required
      })
    }, OasObject.empty())
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.OperationObject {
    return {
      tags: this.tags,
      summary: this.summary,
      description: this.description,
      operationId: this.operationId,
      parameters: this.parameters?.map(param => param.toJsonSchema(options)),
      requestBody: this.requestBody?.toJsonSchema(options),
      responses: Object.fromEntries(
        Object.entries(this.responses).map(([key, value]) => [key, value.toJsonSchema(options)])
      ),
      security: this.security?.map(security => security.toJsonSchema()),
      deprecated: this.deprecated,
      ...this.extensionFields
    }
  }

  toJSON(): object {
    return {
      tags: this.tags,
      summary: this.summary,
      description: this.description,
      operationId: this.operationId,
      parameters: this.parameters,
      requestBody: this.requestBody,
      responses: this.responses,
      security: this.security,
      deprecated: this.deprecated,
      ...this.extensionFields
    }
  }
}
