import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { CustomValue } from '../../types/CustomValue.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { match, P } from 'ts-pattern'

export type OasObjectFields = {
  title?: string
  description?: string
  properties?: Record<string, OasSchema | OasRef<'schema'> | CustomValue> | undefined
  required?: string[] | undefined
  additionalProperties?: boolean | OasSchema | OasRef<'schema'> | undefined
  nullable?: boolean | undefined
  extensionFields?: Record<string, unknown>
  example?: Record<string, unknown>
}

export type AddPropertyArgs = {
  name: string
  schema: OasSchema | OasRef<'schema'> | CustomValue | undefined
  required?: boolean
}

/**
 * Object representing an object and/or a record in the OpenAPI Specification.
 *
 * Objects have fixed, named fields. Records have any number of fields that do not have predefined names.
 */
export class OasObject {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'object' useful for type narrowing and tagged unions.
   */
  type = 'object' as const
  /**
   * A short summary of the object.
   */
  title: string | undefined
  /**
   * A description of the object.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: boolean | undefined
  /**
   * A record which maps property names of the object to their schemas.
   */
  properties: Record<string, OasSchema | OasRef<'schema'> | CustomValue> | undefined
  /**
   * An array of required property names.
   */
  required: string[] | undefined
  /**
   * Indicates whether additional properties are allowed.
   *
   * This is equivalent to a Record type in TypeScript.
   */
  additionalProperties: boolean | OasSchema | OasRef<'schema'> | undefined

  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the object.
   */
  example: Record<string, unknown> | undefined

  constructor(fields: OasObjectFields) {
    this.title = fields.title
    this.description = fields.description
    this.properties = fields.properties
    this.required = fields.required
    this.additionalProperties = fields.additionalProperties
    this.nullable = fields.nullable
    this.extensionFields = fields.extensionFields
    this.example = fields.example
  }

  /** Creates new empty OasObject */
  static empty(): OasObject {
    return new OasObject({
      properties: {},
      required: []
    })
  }

  /**
   * Adds a new property to the object.
   *
   * @param {AddPropertyArgs} args - The arguments for adding a property.
   * @param {string} args.name - The name of the property to add.
   * @param {OasSchema | OasRef<'schema'> | CustomValue | undefined} args.schema - The schema of the property to add.
   * @param {boolean} args.required - Whether the property is required.
   * @returns {OasObject} A new OasObject with the added property.
   */
  addProperty({ name, schema, required }: AddPropertyArgs): OasObject {
    if (!schema) {
      return this
    }

    return new OasObject({
      title: this.title,
      description: this.description,
      properties: {
        ...this.properties,
        [name]: schema
      },
      required: required ? [...(this.required ?? []), name] : this.required,
      additionalProperties: this.additionalProperties,
      nullable: this.nullable,
      extensionFields: this.extensionFields
    })
  }

  /**
   * Removes a property from the object.
   *
   * @param {string} name - The name of the property to remove.
   * @returns {OasObject} A new OasObject with the removed property.
   */
  removeProperty(name: string): OasObject {
    if (!this.properties?.[name]) {
      return this
    }

    const { [name]: _removed, ...properties } = this.properties

    return new OasObject({
      title: this.title,
      description: this.description,
      properties,
      required: this.required?.filter(n => n !== name),
      additionalProperties: this.additionalProperties,
      nullable: this.nullable,
      extensionFields: this.extensionFields
    })
  }

  isRef(): this is OasRef<'schema'> {
    return false
  }

  resolve(): OasObject {
    return this
  }

  resolveOnce(): OasObject {
    return this
  }

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      type: 'object',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example,
      properties: this.properties
        ? Object.fromEntries(
            Object.entries(this.properties)
              .filter(([_key, value]) => value.type !== 'custom')
              .map(([key, value]) => [
                key,
                (value as OasRef<'schema'> | OasSchema).toJsonSchema(options)
              ])
          )
        : undefined,
      required: this.required,
      additionalProperties: match(this.additionalProperties)
        .with(P.nullish, () => false)
        .with(P.boolean, value => value)
        .otherwise(value => value.toJsonSchema(options))
    }
  }
}
