import type { OpenAPIV3 } from 'openapi-types'
import type { OasDiscriminator } from '../discriminator/Discriminator.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'

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

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      allOf: this.members.map(member => member.toJsonSchema(options)),
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example
    }
  }
}
