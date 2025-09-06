import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasServerVariable } from '../serverVariable/ServerVariable.ts'

export type ServerFields = {
  description?: string | undefined
  url: string
  variables?: Record<string, OasServerVariable> | undefined
  extensionFields?: Record<string, unknown>
}

export class OasServer {
  oasType: 'server' = 'server'
  description: string | undefined
  url: string
  variables: Record<string, OasServerVariable> | undefined
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: ServerFields) {
    this.description = fields.description
    this.url = fields.url
    this.variables = fields.variables
    this.extensionFields = fields.extensionFields
  }

  isRef(): boolean {
    return false
  }

  resolve(): OasServer {
    return this
  }

  resolveOnce(): OasServer {
    return this
  }

  toJsonSchema(_options: ToJsonSchemaOptions): OpenAPIV3.ServerObject {
    return {
      description: this.description,
      url: this.url,
      variables: this.variables
    }
  }
}
