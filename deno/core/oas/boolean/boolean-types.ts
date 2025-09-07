import * as v from 'valibot'

/**
 * Valibot schema for validating OpenAPI boolean data objects.
 * 
 * This schema validates OpenAPI boolean schemas according to the OpenAPI v3 specification,
 * including optional properties like default values, enumeration constraints, title,
 * and description metadata. Boolean enums are commonly used to restrict values to
 * specific boolean constants (e.g., [true] for always-true flags).
 * 
 * @example Validating a basic boolean schema
 * ```typescript
 * import { oasBooleanData } from '@skmtc/core/oas/boolean';
 * import * as v from 'valibot';
 * 
 * const schema = {
 *   type: 'boolean',
 *   description: 'Whether the feature is enabled',
 *   default: false
 * };
 * 
 * const validated = v.parse(oasBooleanData, schema);
 * console.log(validated.default); // false
 * ```
 * 
 * @example Validating boolean with enumeration
 * ```typescript
 * const constrainedBoolean = {
 *   type: 'boolean',
 *   title: 'Admin Flag',
 *   description: 'User admin status',
 *   enum: [true] // Only true values allowed
 * };
 * 
 * const result = v.parse(oasBooleanData, constrainedBoolean);
 * console.log(result.enum); // [true]
 * ```
 */
export const oasBooleanData: v.GenericSchema<OasBooleanData> = v.object({
  type: v.literal('boolean'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.boolean()),
  enum: v.optional(v.array(v.boolean()))
})

/**
 * Data type for OpenAPI boolean schema objects.
 * 
 * Represents the structure of OpenAPI boolean schemas as processed by the SKMTC pipeline.
 * This type includes all standard OpenAPI boolean schema properties including metadata,
 * default values, and enumeration constraints. It's used throughout the boolean
 * processing pipeline for type-safe handling of boolean schema definitions.
 * 
 * ## Usage in SKMTC Pipeline
 * 
 * This type is used by:
 * - Schema parsers to validate incoming boolean schema data
 * - Boolean processors to transform OpenAPI schemas into OAS objects
 * - Code generators to access boolean schema metadata and constraints
 * - Validation systems to ensure schema compliance
 * 
 * @example Basic boolean schema
 * ```typescript
 * import type { OasBooleanData } from '@skmtc/core/oas/boolean';
 * 
 * const isActiveSchema: OasBooleanData = {
 *   type: 'boolean',
 *   title: 'Active Status',
 *   description: 'Whether the record is active',
 *   default: true
 * };
 * ```
 * 
 * @example Boolean with enumeration constraints
 * ```typescript
 * const adminFlagSchema: OasBooleanData = {
 *   type: 'boolean',
 *   description: 'Administrative privileges flag',
 *   enum: [false, true], // Allow both values
 *   default: false
 * };
 * ```
 * 
 * @example Read-only boolean flag
 * ```typescript
 * const systemFlagSchema: OasBooleanData = {
 *   type: 'boolean',
 *   title: 'System Generated',
 *   description: 'Indicates if the record was system-generated',
 *   enum: [true], // Always true
 *   default: true
 * };
 * ```
 */
export type OasBooleanData = {
  /** Type identifier (always 'boolean') */
  type: 'boolean'
  /** Human-readable title for the boolean schema */
  title?: string
  /** Detailed description explaining the boolean's purpose and usage */
  description?: string
  /** Default value used when no explicit value is provided */
  default?: boolean
  /** Array of valid boolean values for enumeration constraints */
  enum?: boolean[]
}
