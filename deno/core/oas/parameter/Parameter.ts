import type { OasParameterLocation, OasParameterStyle } from './parameter-types.ts'
import type { OasMediaType } from '../mediaType/MediaType.ts'
import type { OasRef } from '../ref/Ref.ts'
import type { OasExample } from '../example/Example.ts'
import type { OasSchema } from '../schema/Schema.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { OpenAPIV3 } from 'openapi-types'

// @TODO It might be a good idea to set up separate classes for
// path, query, header, and cookie parameters

export type ParameterFields = {
  name: string
  location: OasParameterLocation
  description?: string | undefined
  required?: boolean | undefined
  deprecated?: boolean | undefined
  allowEmptyValue?: boolean | undefined
  allowReserved?: boolean | undefined
  schema?: OasSchema | OasRef<'schema'> | undefined
  examples?: Record<string, OasExample | OasRef<'example'>> | undefined
  content?: Record<string, OasMediaType> | undefined
  style: OasParameterStyle
  explode: boolean
  extensionFields?: Record<string, unknown>
}

export class OasParameter {
  oasType: 'parameter' = 'parameter'
  name: string
  location: OasParameterLocation
  description?: string | undefined
  required?: boolean | undefined
  deprecated?: boolean | undefined
  allowEmptyValue?: boolean | undefined
  allowReserved?: boolean | undefined
  schema?: OasSchema | OasRef<'schema'> | undefined
  examples?: Record<string, OasExample | OasRef<'example'>> | undefined
  content?: Record<string, OasMediaType> | undefined
  style: OasParameterStyle
  explode: boolean
  extensionFields: Record<string, unknown> | undefined
  constructor(fields: ParameterFields) {
    this.name = fields.name
    this.location = fields.location
    this.style = fields.style
    this.explode = fields.explode
    this.description = fields.description
    this.required = fields.required
    this.deprecated = fields.deprecated
    this.allowEmptyValue = fields.allowEmptyValue
    this.allowReserved = fields.allowReserved
    this.schema = fields.schema
    this.examples = fields.examples
    this.content = fields.content
    this.style = fields.style
    this.explode = fields.explode
    this.extensionFields = fields.extensionFields
  }

  isRef(): this is OasRef<'parameter'> {
    return false
  }

  resolve(): OasParameter {
    return this
  }

  resolveOnce(): OasParameter {
    return this
  }

  toSchema(mediaType: string = 'application/json'): OasSchema | OasRef<'schema'> {
    if (this.schema) {
      return this.schema
    }

    const schema = this.content?.[mediaType]?.schema

    if (!schema) {
      throw new Error(`Schema not found for media type ${mediaType}`)
    }

    return schema
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ParameterObject {
    return {
      name: this.name,
      in: this.location,
      description: this.description,
      required: this.required,
      deprecated: this.deprecated,
      allowEmptyValue: this.allowEmptyValue,
      allowReserved: this.allowReserved,
      schema: this.schema?.toJsonSchema(options),
      examples: this.examples,
      content: Object.fromEntries(
        Object.entries(this.content ?? {}).map(([mediaType, mediaTypeObject]) => [
          mediaType,
          mediaTypeObject.toJsonSchema(options)
        ])
      ),
      style: this.style,
      explode: this.explode
    }
  }
}
