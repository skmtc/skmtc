import type { ToJsonSchemaOptions } from '../schema/Schema.js'
import type { OpenAPIV3 } from 'openapi-types'

export type ServerFields = {
  description?: string | undefined
  url: string
  extensionFields?: Record<string, unknown>
}

export class OasServer {
  oasType: 'server' = 'server'
  description: string | undefined
  url: string
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: ServerFields) {
    this.description = fields.description
    this.url = fields.url
    this.extensionFields = fields.extensionFields
  }

  isRef() {
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
      url: this.url
    }
  }
}
