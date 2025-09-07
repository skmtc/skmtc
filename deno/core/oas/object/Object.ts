import type { OasRef } from '../ref/Ref.ts'
import type { OasSchema, ToJsonSchemaOptions } from '../schema/Schema.ts'
import type { CustomValue } from '../../types/CustomValue.ts'
import type { OpenAPIV3 } from 'openapi-types'
import { match, P } from 'ts-pattern'

/**
 * Constructor fields for {@link OasObject}.
 * 
 * @template Nullable - Whether the object can be null (affects type unions)
 */
export type OasObjectFields<Nullable extends boolean | undefined> = {
  /** A short summary of the object */
  title?: string
  /** A description of the object */
  description?: string
  /** Record mapping property names to their schemas */
  properties?: Record<string, OasSchema | OasRef<'schema'> | CustomValue> | undefined
  /** Array of required property names */
  required?: string[] | undefined
  /** Default value for the object (null allowed if Nullable is true) */
  default?: Nullable extends true
    ? Record<string, unknown> | null | undefined
    : Record<string, unknown> | undefined
  /** Whether additional properties are allowed (true/false/schema) */
  additionalProperties?: boolean | OasSchema | OasRef<'schema'> | undefined
  /** Whether the object value can be null */
  nullable?: Nullable
  /** Maximum number of properties allowed */
  maxProperties?: number
  /** Minimum number of properties required */
  minProperties?: number
  /** Array of valid enum values for the object */
  enums?: Nullable extends true
    ? (Record<string, unknown> | null)[] | undefined
    : Record<string, unknown>[] | undefined
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
  /** Example value for the object (null allowed if Nullable is true) */
  example?: Nullable extends true
    ? Record<string, unknown> | null | undefined
    : Record<string, unknown> | undefined
  /** Whether the object is read-only */
  readOnly?: boolean
  /** Whether the object is write-only */
  writeOnly?: boolean
  /** Whether the object is deprecated */
  deprecated?: boolean
}

/**
 * Arguments for the {@link OasObject.addProperty} method.
 */
export type AddPropertyArgs = {
  /** The name of the property to add */
  name: string
  /** The schema definition for the property */
  schema: OasSchema | OasRef<'schema'> | CustomValue | undefined
  /** Whether the property should be required */
  required?: boolean
}

/**
 * Represents an object schema in the OpenAPI Specification.
 * 
 * `OasObject` handles both:
 * - **Objects**: Types with fixed, named properties (like TypeScript interfaces)
 * - **Records**: Types with dynamic keys and consistent value types (like TypeScript Record<string, T>)
 * 
 * This class provides comprehensive support for object validation constraints,
 * property management, and JSON Schema conversion. It supports nullable types
 * through generic type parameters and handles complex property relationships.
 * 
 * ## Key Features
 * 
 * - **Property Management**: Add/remove properties with automatic required field handling
 * - **Type Safety**: Generic nullable type support with proper TypeScript inference
 * - **Validation**: Min/max properties, additional properties, and enum constraints
 * - **JSON Schema**: Convert to standard JSON Schema format for validation
 * - **Immutability**: All mutations return new instances (functional style)
 * 
 * @template Nullable - Whether the object value itself can be null
 * 
 * @example Basic object schema
 * ```typescript
 * import { OasObject } from '@skmtc/core';
 * 
 * const userObject = new OasObject({
 *   title: 'User',
 *   description: 'A user in the system',
 *   properties: {
 *     id: new OasString({ title: 'User ID' }),
 *     name: new OasString({ title: 'Full Name' }),
 *     email: new OasString({ format: 'email' })
 *   },
 *   required: ['id', 'name'],
 *   additionalProperties: false
 * });
 * ```
 * 
 * @example Dynamic property management
 * ```typescript
 * // Start with empty object
 * let schema = OasObject.empty();
 * 
 * // Add properties dynamically
 * schema = schema.addProperty({
 *   name: 'id',
 *   schema: new OasString(),
 *   required: true
 * });
 * 
 * schema = schema.addProperty({
 *   name: 'metadata',
 *   schema: new OasObject({ additionalProperties: true }),
 *   required: false
 * });
 * 
 * // Remove a property
 * schema = schema.removeProperty('metadata');
 * ```
 * 
 * @example Record-style object (additional properties)
 * ```typescript
 * const recordObject = new OasObject({
 *   title: 'StringMap',
 *   description: 'A map of string keys to string values',
 *   additionalProperties: new OasString(), // Any string key -> string value
 *   minProperties: 1 // At least one property required
 * });
 * 
 * // This allows: { [key: string]: string }
 * ```
 * 
 * @example Nullable object support
 * ```typescript
 * const nullableUser = new OasObject<true>({
 *   nullable: true,
 *   properties: {
 *     name: new OasString()
 *   },
 *   default: null // Can have null default when nullable
 * });
 * 
 * // This represents: { name: string } | null
 * ```
 */
export class OasObject<Nullable extends boolean | undefined = boolean | undefined> {
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
  nullable: Nullable | undefined
  /**
   * A record which maps property names of the object to their schemas.
   */
  properties: Nullable extends true
    ? Record<string, OasSchema | OasRef<'schema'> | CustomValue> | null | undefined
    : Record<string, OasSchema | OasRef<'schema'> | CustomValue> | undefined
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
  example: Nullable extends true
    ? Record<string, unknown> | null | undefined
    : Record<string, unknown> | undefined
  /**
   * The default value of the object.
   */
  default: Nullable extends true
    ? Record<string, unknown> | null | undefined
    : Record<string, unknown> | undefined
  /** Maximum number of properties allowed in the object */
  maxProperties?: number
  /** Minimum number of properties required in the object */
  minProperties?: number
  /** Whether the object is read-only */
  readOnly?: boolean
  /** Whether the object is write-only */
  writeOnly?: boolean
  /** Whether the object schema is deprecated */
  deprecated?: boolean
  /** Array of valid enum values for the object */
  enums?: Nullable extends true
    ? (Record<string, unknown> | null)[] | undefined
    : Record<string, unknown>[] | undefined
  /**
   * Creates a new OasObject instance.
   * 
   * @param fields - Object configuration fields
   * 
   * @example
   * ```typescript
   * const userSchema = new OasObject({
   *   title: 'User',
   *   properties: {
   *     id: new OasString({ title: 'ID' }),
   *     name: new OasString({ title: 'Name' })
   *   },
   *   required: ['id'],
   *   additionalProperties: false
   * });
   * ```
   */
  constructor(fields: OasObjectFields<Nullable> = {}) {
    this.title = fields.title
    this.description = fields.description
    this.properties = fields.properties
    this.required = fields.required
    this.additionalProperties = fields.additionalProperties
    this.nullable = fields.nullable
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.default = fields.default
    this.maxProperties = fields.maxProperties
    this.minProperties = fields.minProperties
    this.readOnly = fields.readOnly
    this.deprecated = fields.deprecated
    this.enums = fields.enums
  }

  /**
   * Creates a new empty OasObject with no properties.
   * 
   * This factory method creates a non-nullable object with empty properties
   * and required arrays, useful as a starting point for dynamic object building.
   * 
   * @returns A new empty OasObject instance
   * 
   * @example
   * ```typescript
   * // Start with empty object and build up
   * let schema = OasObject.empty();
   * 
   * schema = schema.addProperty({
   *   name: 'id',
   *   schema: new OasString(),
   *   required: true
   * });
   * 
   * schema = schema.addProperty({
   *   name: 'name', 
   *   schema: new OasString(),
   *   required: true
   * });
   * ```
   */
  static empty(): OasObject<false> {
    return new OasObject({
      nullable: false,
      properties: {},
      required: []
    })
  }

  /**
   * Adds a new property to the object.
   * 
   * This method returns a new OasObject instance with the added property,
   * following an immutable pattern. If the property is marked as required,
   * it will be added to the required array.
   * 
   * @param args - Property addition arguments
   * @param args.name - The name of the property to add
   * @param args.schema - The schema definition for the property
   * @param args.required - Whether the property should be required (default: false)
   * @returns A new OasObject with the added property
   * 
   * @example Adding a simple property
   * ```typescript
   * const original = OasObject.empty();
   * const withName = original.addProperty({
   *   name: 'username',
   *   schema: new OasString({ minLength: 3 }),
   *   required: true
   * });
   * 
   * console.log(withName.required); // ['username']
   * ```
   * 
   * @example Chaining property additions
   * ```typescript
   * const userSchema = OasObject.empty()
   *   .addProperty({
   *     name: 'id', 
   *     schema: new OasInteger(),
   *     required: true
   *   })
   *   .addProperty({
   *     name: 'email',
   *     schema: new OasString({ format: 'email' }),
   *     required: true
   *   })
   *   .addProperty({
   *     name: 'age',
   *     schema: new OasInteger({ minimum: 0 }),
   *     required: false
   *   });
   * ```
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
   * This method returns a new OasObject instance with the specified property
   * removed. If the property was required, it will also be removed from the
   * required array. If the property doesn't exist, returns the same instance.
   * 
   * @param name - The name of the property to remove
   * @returns A new OasObject with the property removed, or the same instance if property doesn't exist
   * 
   * @example
   * ```typescript
   * const userSchema = new OasObject({
   *   properties: {
   *     id: new OasString(),
   *     name: new OasString(),
   *     email: new OasString(),
   *     temporaryField: new OasString()
   *   },
   *   required: ['id', 'name', 'temporaryField']
   * });
   * 
   * // Remove temporary field
   * const cleanedSchema = userSchema.removeProperty('temporaryField');
   * 
   * console.log(cleanedSchema.required); // ['id', 'name']
   * console.log('temporaryField' in cleanedSchema.properties); // false
   * ```
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

  /**
   * Converts the OasObject to a standard JSON Schema object.
   * 
   * This method serializes the object to the JSON Schema format used in
   * OpenAPI specifications. It handles property conversion, additional
   * properties rules, and validation constraints.
   * 
   * @param options - Conversion options for handling references and context
   * @returns A JSON Schema representation of the object
   * 
   * @example
   * ```typescript
   * const userObject = new OasObject({
   *   title: 'User',
   *   properties: {
   *     id: new OasString(),
   *     name: new OasString()
   *   },
   *   required: ['id'],
   *   additionalProperties: false
   * });
   * 
   * const jsonSchema = userObject.toJsonSchema({ refContext: new Map() });
   * 
   * console.log(jsonSchema);
   * // {
   * //   type: 'object',
   * //   title: 'User', 
   * //   properties: {
   * //     id: { type: 'string' },
   * //     name: { type: 'string' }
   * //   },
   * //   required: ['id'],
   * //   additionalProperties: false
   * // }
   * ```
   */
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
      maxProperties: this.maxProperties,
      minProperties: this.minProperties,
      enum: this.enums,
      additionalProperties: match(this.additionalProperties)
        .with(P.nullish, () => false)
        .with(P.boolean, value => value)
        .otherwise(value => value.toJsonSchema(options)),
      readOnly: this.readOnly,
      writeOnly: this.writeOnly,
      deprecated: this.deprecated
    }
  }
}
