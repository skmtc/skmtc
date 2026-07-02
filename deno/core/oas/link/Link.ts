import type { OasServer } from '../server/Server.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Constructor fields for {@link OasLink}.
 */
export type LinkFields = {
  /** A relative or absolute URI reference to an OAS operation (mutually exclusive with `operationId`) */
  operationRef?: string
  /** The name of an existing, resolvable OAS operation */
  operationId?: string
  /** A map of parameter names to values or runtime expressions passed to the linked operation */
  parameters?: Record<string, unknown>
  /** A value or runtime expression to use as the request body when calling the linked operation */
  requestBody?: unknown
  /** A description of the link */
  description?: string
  /** A server to use for the linked operation */
  server?: OasServer
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents a Link Object in the OpenAPI Specification.
 *
 * A link describes a possible design-time relationship from a response to another
 * operation — for example, how the `id` in a create response can be used as the
 * path parameter of a subsequent fetch. It names the target operation (by
 * `operationId` or `operationRef`) and how to populate its parameters and request
 * body from the current response.
 *
 * @example
 * ```typescript
 * import { OasLink } from '@skmtc/core';
 *
 * const getUserByUserId = new OasLink({
 *   operationId: 'getUser',
 *   parameters: { userId: '$response.body#/id' },
 *   description: 'The `id` of the created user is the `userId` of GET /users/{userId}'
 * });
 * ```
 */
export class OasLink {
  oasType: 'link' = 'link'
  /** A URI reference to a target operation */
  operationRef: string | undefined
  /** The `operationId` of a target operation */
  operationId: string | undefined
  /** Parameter values or runtime expressions for the target operation */
  parameters: Record<string, unknown> | undefined
  /** The request body value or runtime expression for the target operation */
  requestBody: unknown
  /** A description of the link */
  description: string | undefined
  /** A server to use for the target operation */
  server: OasServer | undefined
  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined

  constructor(fields: LinkFields) {
    this.operationRef = fields.operationRef
    this.operationId = fields.operationId
    this.parameters = fields.parameters
    this.requestBody = fields.requestBody
    this.description = fields.description
    this.server = fields.server
    this.extensionFields = fields.extensionFields
  }

  /** Returns true if object is a reference */
  isRef(): this is OasRef<'link'> {
    return false
  }

  /** Returns itself */
  resolve(): OasLink {
    return this
  }

  resolveOnce(): OasLink {
    return this
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.LinkObject {
    return {
      operationRef: this.operationRef,
      operationId: this.operationId,
      parameters: this.parameters,
      requestBody: this.requestBody,
      description: this.description,
      server: this.server?.toJsonSchema(options)
    }
  }
}
