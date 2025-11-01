import type { OpenAPIV3 } from 'openapi-types'
import type { OasRef } from '../ref/Ref.ts'
import type { ToJsonSchemaOptions } from '../schema/Schema.ts'

/**
 * Constructor fields for {@link OasBoolean}.
 *
 * @template Nullable - Whether the boolean can be null (affects type unions)
 */
export type BooleanFields<Nullable extends boolean | undefined> = {
  /** A short summary of the boolean schema */
  title?: string
  /** A description of the boolean schema */
  description?: string
  /** Whether the boolean value can be null */
  nullable?: Nullable
  /** Custom extension fields (x-* properties) */
  extensionFields?: Record<string, unknown>
  /** Example value for the boolean (null allowed if Nullable is true) */
  example?: Nullable extends true ? boolean | null | undefined : boolean | undefined
  /** Array of valid enum values for the boolean (null allowed if Nullable is true) */
  enums?: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined
  /** Default value for the boolean (null allowed if Nullable is true) */
  default?: Nullable extends true ? boolean | null | undefined : boolean | undefined
  /** Whether the boolean is read-only */
  readOnly?: boolean
  /** Whether the boolean is write-only */
  writeOnly?: boolean
  /** Whether the boolean is deprecated */
  deprecated?: boolean
}
export class OasBoolean<Nullable extends boolean | undefined = boolean | undefined> {
  /**
   * Object is part the 'schema' set which is used
   * to define data types in an OpenAPI document.
   */
  oasType = 'schema' as const
  /**
   * Constant value 'boolean' useful for type narrowing and tagged unions.
   */
  type = 'boolean' as const
  /**
   * A short summary of the boolean.
   */
  title: string | undefined
  /**
   * A description of the boolean.
   */
  description: string | undefined
  /**
   * Indicates whether value can be null.
   */
  nullable: Nullable | undefined

  /** Specification Extension fields */
  extensionFields: Record<string, unknown> | undefined
  /**
   * An example of the boolean.
   */
  example: Nullable extends true ? boolean | null | undefined : boolean | undefined

  /**
   * Possible values the boolean can have
   */
  enums: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined
  /**
   * The default value of the boolean.
   */
  default: Nullable extends true ? boolean | null | undefined : boolean | undefined

  /** Whether the boolean is read-only */
  readOnly: boolean | undefined
  /** Whether the boolean is write-only */
  writeOnly: boolean | undefined
  /** Whether the boolean is deprecated */
  deprecated: boolean | undefined
  /**
   * Creates a new OasBoolean instance.
   *
   * @param fields - Boolean configuration fields including validation constraints and metadata
   */
  constructor(fields: BooleanFields<Nullable> = {}) {
    this.title = fields.title
    this.description = fields.description
    this.nullable = fields.nullable
    this.extensionFields = fields.extensionFields
    this.example = fields.example
    this.enums = fields.enums
    this.default = fields.default
    this.readOnly = fields.readOnly
    this.writeOnly = fields.writeOnly
    this.deprecated = fields.deprecated
  }

  /**
   * Determines if this boolean is a reference object.
   *
   * @returns Always returns false since this is a concrete boolean instance, not a reference
   */
  isRef(): this is OasRef<'schema'> {
    return false
  }

  /**
   * Resolves this boolean object.
   *
   * @returns The boolean instance itself since it's already a concrete object, not a reference
   */
  resolve(): OasBoolean<Nullable> {
    return this
  }

  /**
   * Resolves this boolean object one level.
   *
   * @returns The boolean instance itself since it's already a concrete object, not a reference
   */
  resolveOnce(): OasBoolean<Nullable> {
    return this
  }

  /**
   * Converts this OAS boolean to an OpenAPI v3 JSON schema representation.
   *
   * @param options - Conversion options (currently unused for boolean schemas)
   * @returns OpenAPI v3 boolean schema object with type and all validation constraints
   */
  // deno-lint-ignore no-unused-vars
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject {
    return {
      type: 'boolean',
      title: this.title,
      description: this.description,
      nullable: this.nullable,
      example: this.example,
      enum: this.enums,
      default: this.default,
      readOnly: this.readOnly,
      writeOnly: this.writeOnly,
      deprecated: this.deprecated
    }
  }
}
