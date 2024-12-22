import type { OasDiscriminator } from '../discriminator/Discriminator.js'
import type { OasRef } from '../ref/Ref.js'
import type { OasSchema } from '../schema/Schema.js'

export type IntersectionFields = {
  title?: string
  description?: string
  nullable?: boolean
  discriminator?: OasDiscriminator
  members: (OasSchema | OasRef<'schema'>)[]
  extensionFields?: Record<string, unknown>
  example?: unknown
}

export class OasIntersection {
  oasType: 'schema' = 'schema'
  type: 'intersection' = 'intersection'
  title: string | undefined
  description: string | undefined
  nullable: boolean | undefined
  discriminator: OasDiscriminator | undefined
  members: (OasSchema | OasRef<'schema'>)[]
  extensionFields: Record<string, unknown> | undefined
  example: unknown | undefined

  constructor(fields: IntersectionFields) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.discriminator = fields.discriminator
    this.members = fields.members
    this.extensionFields = fields.extensionFields
    this.example = fields.example
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasIntersection {
    return this
  }

  resolveOnce(): OasIntersection {
    return this
  }
}
