import type { OasDiscriminator } from '../discriminator/Discriminator.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

export type UnionFields = {
  title?: string
  description?: string
  nullable?: boolean
  discriminator?: OasDiscriminator
  example?: unknown
  members: (OasSchema | OasRef<'schema'>)[]
  extensionFields?: Record<string, unknown>
}

/**
 * Object representing a 'oneOf' or 'anyOf' in the OpenAPI Specification.
 *
 * In the context of TypeScript 'anyOf' is not helpful since it implies
 * a union that consists of all possible combinations of member types.
 *
 * Generating such combination types would not be useful and we map both
 * 'oneOf' and 'anyOf' to a TypeScript union type.
 */
export class OasUnion {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'union' useful for type narrowing and tagged unions.
   */
  type = 'union' as const
  /**
   * A short summary of the union.
   */
  title: string | undefined
  /**
   * A description of the union.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: boolean | undefined
  /**
   * Discriminator object used to tag member types and make the union a tagged union.
   */
  discriminator: OasDiscriminator | undefined
  /**
   * Array of schemas or references to schemas that are part of the union.
   */
  members: (OasSchema | OasRef<'schema'>)[]

  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the union type.
   */
  example?: unknown

  constructor(fields: UnionFields) {
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

  resolve(): OasUnion {
    return this
  }

  resolveOnce(): OasUnion {
    return this
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example,
      oneOf: this.members.map(member => member.toJsonSchema(options))
    }
  }
}
