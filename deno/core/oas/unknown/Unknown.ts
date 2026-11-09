import { traverseSchema } from '@/oas/schemaPath/traverseSchema.ts'
import { toSiblingAnnotations } from '@/oas/schema/siblings.ts'
import type { SchemaPath } from '@/types/SchemaPath.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import { OasBase } from '@/types/OasBase.ts'
import type { ParseContextType } from '@/context/parseTypes.ts'

export type UnknownFields = {
  title?: string
  description?: string
  extensionFields?: Record<string, unknown>
  example?: unknown
  nullable?: boolean
}

/**
 * Object representing an unknown type in the OpenAPI Specification.
 *
 * JSON schema treats a definition without any type information as 'any'.
 * Since this is not useful in an API context, we use OasUnknown to
 * represent types that are not specified.
 */
export class OasUnknown extends OasBase {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'unknown' useful for type narrowing and tagged unions.
   */
  type = 'unknown' as const
  /**
   * A short summary of the unknown type.
   */
  title: string | undefined
  /**
   * A description of the unknown type.
   */
  description: string | undefined

  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /** An example of the unknown type. */
  example: unknown | undefined
  /** Whether the unknown type is nullable */
  nullable: boolean | undefined
  constructor(fields: UnknownFields = {}, context?: ParseContextType) {
    super(context)
    this.title = fields.title
    this.description = fields.description
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.nullable = fields.nullable
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  /** Always `false`: this schema has no `readOnly`. */
  isReadOnly(): boolean {
    return false
  }

  /** Always `false`: this schema has no `writeOnly`. */
  isWriteOnly(): boolean {
    return false
  }

  /**
   * A copy of this schema with the keywords next to a reference to it
   * applied (`RefFields.siblings`), for `OasRef.resolve()`: a sibling's value wins. Annotations
   * apply from siblings of any type; the rest only from siblings of the
   * same type. This schema does not change.
   */
  withSiblings(siblings: OasSchema): OasUnknown {
    const copy = new OasUnknown({
      ...toSiblingAnnotations(this, siblings),
      example: siblings.example ?? this.example,
      nullable: this.nullable,
    })
    copy.stackTrail = this.stackTrail

    return copy
  }

  traverse(path: SchemaPath): OasSchema | OasRef<'schema'> {
    return traverseSchema(this, path)
  }

  resolve(): OasUnknown {
    return this
  }

  resolveOnce(): OasUnknown {
    return this
  }

  toJsonSchema(
    _options?: ToJsonSchemaOptions
  ): OpenAPIV3.NonArraySchemaObject | OpenAPIV3.ArraySchemaObject {
    return {
      title: this.title,
      description: this.description,
      example: this.example
    }
  }
}
