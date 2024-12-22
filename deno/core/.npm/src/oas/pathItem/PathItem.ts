import type { OasParameter } from '../parameter/Parameter.js'
import type { OasRef } from '../ref/Ref.js'

export type PathItemFields = {
  summary?: string | undefined
  description?: string | undefined
  parameters?: (OasParameter | OasRef<'parameter'>)[] | undefined
  extensionFields?: Record<string, unknown>
}

export class OasPathItem {
  oasType: 'pathItem' = 'pathItem'
  summary: string | undefined
  description: string | undefined
  parameters: (OasParameter | OasRef<'parameter'>)[] | undefined
  extensionFields: Record<string, unknown> | undefined

  constructor(fields: PathItemFields = {}) {
    this.summary = fields.summary
    this.description = fields.description
    this.parameters = fields.parameters
    this.extensionFields = fields.extensionFields
  }
}
