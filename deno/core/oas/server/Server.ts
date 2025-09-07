import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasServerVariable } from '../serverVariable/ServerVariable.ts'

/**
 * Constructor fields for {@link OasServer}.
 * 
 * Defines the configuration options available when creating server instances,
 * including URL, description, variables, and extension fields.
 */
export type ServerFields = {
  description?: string | undefined
  url: string
  variables?: Record<string, OasServerVariable> | undefined
  extensionFields?: Record<string, unknown>
}

/**
 * Represents a Server Object in the OpenAPI Specification.
 * 
 * The `OasServer` class encapsulates server connectivity information, including
 * the server URL, optional description, and variable definitions for URL templating.
 * Servers are used to specify different environments (development, staging, production)
 * or different API versions that clients can connect to.
 * 
 * @example Basic server
 * ```typescript
 * const server = new OasServer({
 *   url: 'https://api.example.com/v1',
 *   description: 'Production API server'
 * });
 * ```
 * 
 * @example Server with variables
 * ```typescript
 * const server = new OasServer({
 *   url: 'https://{environment}.example.com/{version}',
 *   description: 'Configurable API server',
 *   variables: {
 *     environment: new OasServerVariable({
 *       enum: ['api', 'staging', 'dev'],
 *       default: 'api',
 *       description: 'API environment'
 *     }),
 *     version: new OasServerVariable({
 *       default: 'v1',
 *       description: 'API version'
 *     })
 *   }
 * });
 * ```
 */
export class OasServer {
  /** Type identifier for this OAS server */
  oasType: 'server' = 'server'
  /** Human-readable description of the server */
  description: string | undefined
  /** Server URL with optional variable templating */
  url: string
  /** Variable definitions for URL templating */
  variables: Record<string, OasServerVariable> | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields: Record<string, unknown> | undefined
  /**
   * Creates a new OasServer instance.
   * 
   * @param fields - Server configuration including URL, description, and variables
   */
  constructor(fields: ServerFields) {
    this.description = fields.description
    this.url = fields.url
    this.variables = fields.variables
    this.extensionFields = fields.extensionFields
  }

  /**
   * Determines if this server is a reference object.
   * 
   * @returns Always false since servers are not reference objects in OpenAPI
   */
  isRef(): boolean {
    return false
  }

  /**
   * Resolves this server object.
   * 
   * @returns The server instance itself since it's already a concrete object
   */
  resolve(): OasServer {
    return this
  }

  /**
   * Resolves this server object one level.
   * 
   * @returns The server instance itself since it's already a concrete object
   */
  resolveOnce(): OasServer {
    return this
  }

  /**
   * Converts this OAS server to an OpenAPI v3 JSON schema representation.
   * 
   * @param _options - Conversion options (currently unused for server objects)
   * @returns OpenAPI v3 server object with URL, description, and variables
   */
  toJsonSchema(_options: ToJsonSchemaOptions): OpenAPIV3.ServerObject {
    return {
      description: this.description,
      url: this.url,
      variables: this.variables
    }
  }
}
