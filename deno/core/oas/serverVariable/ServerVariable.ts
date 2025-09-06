import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

export type ServerVariableFields = {
  description?: string | undefined
  default: string
  enums?: string[] | undefined
  extensionFields?: Record<string, unknown>
}

export class OasServerVariable {
  oasType: 'serverVariable' = 'serverVariable'
  description: string | undefined
  default: string
  enums?: string[] | undefined
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
