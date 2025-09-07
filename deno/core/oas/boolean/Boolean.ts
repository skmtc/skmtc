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
}

/**
 * Represents a boolean schema in the OpenAPI Specification.
 * 
 * The `OasBoolean` class handles boolean data types in OpenAPI schemas, supporting
 * both simple true/false values and more complex boolean schemas with constraints,
 * enumerations, and nullable types. This class provides type-safe boolean handling
 * with optional null value support through generic typing.
 * 
 * ## Key Features
 * 
 * - **Type Safety**: Generic nullable type support with proper TypeScript inference
 * - **Enum Support**: Constrain boolean values to specific true/false combinations
 * - **Null Handling**: Optional null value support for nullable boolean types
 * - **Validation**: Default values and example validation
 * - **JSON Schema**: Converts to standard JSON Schema format for validation
 * - **Documentation**: Rich metadata support for API documentation
 * 
 * @template Nullable - Whether the boolean value itself can be null
 * 
 * @example Basic boolean schema
 * ```typescript
 * import { OasBoolean } from '@skmtc/core';
 * 
 * const isActiveSchema = new OasBoolean({
 *   title: 'Active Status',
 *   description: 'Whether the user account is active',
 *   default: true,
 *   example: true
 * });
 * 
 * // This represents: boolean with default true
 * ```
 * 
 * @example Nullable boolean schema
 * ```typescript
 * const nullableFlag = new OasBoolean<true>({
 *   title: 'Optional Flag',
 *   description: 'An optional boolean flag that can be null',
 *   nullable: true,
 *   default: null,
 *   example: true
 * });
 * 
 * // This represents: boolean | null
 * ```
 * 
 * @example Boolean with enum constraints
 * ```typescript
 * const strictBoolean = new OasBoolean({
 *   title: 'Confirmation',
 *   description: 'Must explicitly be true to confirm action',
 *   enums: [true], // Only true is allowed
 *   example: true
 * });
 * 
 * // This only accepts true, effectively making it required
 * ```
 * 
 * @example Boolean with null in enum
 * ```typescript
 * const triStateBoolean = new OasBoolean<true>({
 *   title: 'Approval Status',
 *   description: 'Approval can be true (approved), false (denied), or null (pending)',
 *   nullable: true,
 *   enums: [true, false, null],
 *   default: null,
 *   example: null
 * });
 * 
 * // This represents: true | false | null (tri-state logic)
 * ```
 * 
 * @example Feature flag schema
 * ```typescript
 * const featureFlag = new OasBoolean({
 *   title: 'Feature Enabled',
 *   description: 'Whether the new feature is enabled for this user',
 *   default: false,
 *   example: false
 * });
 * 
 * // Used in configuration objects
 * const userConfig = new OasObject({
 *   properties: {
 *     darkMode: featureFlag,
 *     notifications: featureFlag,
 *     betaFeatures: featureFlag
 *   }
 * });
 * ```
 * 
 * @example Consent and agreement booleans
 * ```typescript
 * const consentSchema = new OasBoolean({
 *   title: 'Terms Accepted',
 *   description: 'User has accepted the terms and conditions',
 *   enums: [true], // Must be true to be valid
 *   example: true
 * });
 * 
 * const privacyConsent = new OasBoolean({
 *   title: 'Privacy Policy Accepted',
 *   description: 'User has accepted the privacy policy',
 *   default: false,
 *   example: true
 * });
 * 
 * // Used in registration forms where consent is required
 * ```
 * 
 * @example Optional settings with nullable booleans
 * ```typescript
 * const userPreferences = new OasObject({
 *   properties: {
 *     emailNotifications: new OasBoolean<true>({
 *       title: 'Email Notifications',
 *       description: 'Enable email notifications (null means use default)',
 *       nullable: true,
 *       default: null
 *     }),
 *     smsNotifications: new OasBoolean<true>({
 *       title: 'SMS Notifications', 
 *       description: 'Enable SMS notifications (null means not set)',
 *       nullable: true,
 *       default: null
 *     })
 *   }
 * });
 * 
 * // Allows: { emailNotifications: true, smsNotifications: null }
 * ```
 */
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
      default: this.default
    }
  }
}
