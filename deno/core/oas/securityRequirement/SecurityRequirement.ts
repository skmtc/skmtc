import type { OpenAPIV3 } from 'openapi-types'
export type SecurityFields = {
  requirement: Record<string, string[]>
}

export class OasSecurityRequirement {
  oasType: 'securityRequirement' = 'securityRequirement'
  requirement: Record<string, string[]>

  constructor(fields: SecurityFields) {
    this.requirement = fields.requirement
  }

  toJsonSchema(): OpenAPIV3.SecurityRequirementObject {
    return {
      ...this.requirement
    }
  }
}
