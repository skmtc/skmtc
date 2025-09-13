import type { OpenAPIV3 } from 'openapi-types'
import type { OasDocument } from '../document/Document.ts'
import type { OasSecurityScheme } from '../securitySchemes/SecurityScheme.ts'
export type SecurityFields = {
  requirement: Record<string, string[]>
}

export class OasSecurityRequirement {
  oasType: 'securityRequirement' = 'securityRequirement'
  requirement: Record<string, string[]>
  #oasDocument: OasDocument
  constructor(fields: SecurityFields, oasDocument: OasDocument) {
    this.requirement = fields.requirement
    this.#oasDocument = oasDocument
  }

  toSecurityScheme(): OasSecurityScheme[] {
    return Object.keys(this.requirement)
      .map(key => this.#oasDocument.components?.securitySchemes?.[key]?.resolve())
      .filter(securityScheme => securityScheme !== undefined)
  }

  toJsonSchema(): OpenAPIV3.SecurityRequirementObject {
    return {
      ...this.requirement
    }
  }
}
