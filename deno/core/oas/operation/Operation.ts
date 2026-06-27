import { traverseSchema } from '@/oas/schemaPath/traverseSchema.ts'
import type { SchemaPath } from '@/types/SchemaPath.ts'
import type { Method } from '../../types/Method.ts'
import type { OasPathItem } from '../pathItem/PathItem.ts'
import type { OasParameter } from '../parameter/Parameter.ts'
import type { OasRequestBody } from '../requestBody/RequestBody.ts'
import type { OasResponse } from '../response/Response.ts'
import type { OasParameterLocation } from '../parameter/parameter-types.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import { OasObject } from '../object/Object.ts'
import { toPrimaryResponseCode } from '../response/toPrimaryResponseCode.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasSecurityRequirement } from '../securityRequirement/SecurityRequirement.ts'
import type { OasExternalDocs } from '../externalDocs/ExternalDocs.ts'
import type { OasServer } from '../server/Server.ts'
import { OasBase } from '@/types/OasBase.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

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
  /** External documentation for this operation */
  externalDocs?: OasExternalDocs | undefined
  /** OpenAPI specification extensions */
  extensionFields?: Record<string, unknown>
  servers?: OasServer[] | undefined
}

/**
 * Arguments passed to request body mapping functions.
 */
export type ToRequestBodyMapArgs = {
  schema: OasSchema | OasRef<'schema'>
  requestBody: OasRequestBody
}

export class OasOperation extends OasBase {
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
  /** External documentation for this operation */
  externalDocs: OasExternalDocs | undefined
  /** OpenAPI specification extensions */
  extensionFields: Record<string, unknown> | undefined
  /** Servers for this operation */
  servers: OasServer[] | undefined
  /**
   * Creates a new OasOperation instance from operation field data.
   *
   * @param fields - Operation field data from OpenAPI specification
   */
  constructor(fields: OperationFields, context?: ParseContextType) {
    super(context)
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
    this.externalDocs = fields.externalDocs
    this.extensionFields = fields.extensionFields
    this.servers = fields.servers
  }

  /**
   * Returns the successful response definition for this operation.
   *
   * Looks for the lowest numbered 2xx response code and returns its response definition.
   *
   * @returns Success response object or undefined if none found
   */
  toSuccessResponse(): OasResponse | OasRef<'response'> | undefined {
    const successCode = this.toSuccessResponseCode()

    return successCode ? this.responses[successCode] : undefined
  }

  /**
   * Returns the HTTP status code for the primary success response.
   *
   * Finds the lowest numbered 2xx status code in the responses.
   *
   * @returns Success status code as string or undefined if none found
   */
  toSuccessResponseCode(): string | undefined {
    return toPrimaryResponseCode(this.responses)
  }

  /**
   * Maps the request body schema to a custom value using the provided mapping function.
   *
   * @param map - Function to transform the request body schema and metadata
   * @param mediaType - Media type to extract schema from (default: 'application/json')
   * @returns Mapped value or undefined if no request body schema found
   */
  toRequestBody<V>(
    map: ({ schema, requestBody }: ToRequestBodyMapArgs) => V,
    mediaType = 'application/json'
  ): V | undefined {
    const requestBody = this.requestBody?.resolve()
    const schema = requestBody?.content[mediaType]?.schema

    return schema ? map({ schema, requestBody }) : undefined
  }

  /**
   * Navigate into this operation's response or request body schema along an
   * {@link SchemaPath}. The first segment selects the entry point —
   * `'SuccessResponse'` (the 2xx response body schema) or `'RequestBody'` (the
   * request body schema) — and the rest descend through object properties,
   * array `items`, and union members, resolving `$ref`s on the way. See
   * {@link traverseSchema}.
   *
   * @param path - Schema path; `path[0]` must be `'SuccessResponse'` or `'RequestBody'`.
   * @param mediaType - Media type the body schema is read from (default `application/json`).
   * @returns The schema at the path (may be an unresolved `$ref`).
   * @throws Error on an unknown root, a missing response/request body, or a non-navigable segment.
   */
  traverse(path: SchemaPath, mediaType: string = 'application/json'): OasSchema | OasRef<'schema'> {
    const [root, ...rest] = path

    let rootSchema: OasSchema | OasRef<'schema'> | undefined
    switch (root) {
      case 'SuccessResponse':
        rootSchema = this.toSuccessResponse()?.resolve().toSchema(mediaType)
        break
      case 'RequestBody':
        rootSchema = this.toRequestBody(({ schema }) => schema, mediaType)
        break
      default:
        throw new Error(
          `Operation schema path must start with "SuccessResponse" or "RequestBody", got "${root}"`
        )
    }

    if (!rootSchema) {
      const label = root === 'SuccessResponse' ? 'success response' : 'request body'
      throw new Error(
        `Operation "${this.method} ${this.path}" has no ${label} schema for media type "${mediaType}"`
      )
    }

    return traverseSchema(rootSchema, rest)
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

  /**
   * Creates an OAS object representation of operation parameters.
   *
   * @param filter - Optional array of parameter locations to include
   * @returns OAS object with parameter properties
   */
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

  /**
   * Converts the operation to OpenAPI v3 JSON schema format.
   *
   * @param options - Conversion options for nested components
   * @returns OpenAPI v3 operation object
   */
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

  /**
   * Serializes the operation to a plain JavaScript object.
   *
   * @returns Plain object representation of the operation
   */
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
