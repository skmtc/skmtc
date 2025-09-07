import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

/**
 * Fields for configuring an OpenAPI server variable object.
 * 
 * Represents the configuration data needed to create a server variable,
 * including default values, enumeration constraints, and extensions.
 */
export type ServerVariableFields = {
  /** Human-readable description of the server variable */
  description?: string | undefined
  /** Default value for the server variable */
  default: string
  /** Array of allowed values for the server variable */
  enums?: string[] | undefined
  /** OpenAPI specification extensions */
  extensionFields?: Record<string, unknown>
}

/**
 * Represents an OpenAPI server variable object.
 * 
 * Server variables provide parameterization for server URLs,
 * allowing dynamic server configuration with default values
 * and enumeration constraints.
 * 
 * @example Basic server variable
 * ```typescript
 * const serverVar = new OasServerVariable({
 *   default: 'api',
 *   description: 'API version subdomain',
 *   enums: ['api', 'api-staging', 'api-dev']
 * });
 * 
 * console.log(serverVar.default); // 'api'
 * console.log(serverVar.enums);   // ['api', 'api-staging', 'api-dev']
 * ```
 */
export class OasServerVariable {
  /** Type identifier for OAS server variable objects */
  oasType: 'serverVariable' = 'serverVariable'
  /** Human-readable description of the server variable */
  description: string | undefined
  /** Default value for the server variable */
  default: string
  /** Array of allowed values for the server variable */
  enums?: string[] | undefined
  /** OpenAPI specification extensions */
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: ServerVariableFields) {
    this.description = fields.description
    this.default = fields.default
    this.enums = fields.enums
    this.extensionFields = fields.extensionFields
  }

  isRef(): boolean {
    return false
  }

  resolve(): OasServerVariable {
    return this
  }

  resolveOnce(): OasServerVariable {
    return this
  }

  toJsonSchema(_options: ToJsonSchemaOptions): OpenAPIV3.ServerVariableObject {
    return {
      description: this.description,
      default: this.default,
      enum: this.enums
    }
  }
}
