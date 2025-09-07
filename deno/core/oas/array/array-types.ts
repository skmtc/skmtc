import * as v from 'valibot'
import { type OasSchemaData, oasSchemaData } from '../schema/schema-types.ts'
import { type OasSchemaRefData, oasSchemaRefData } from '../ref/ref-types.ts'

/**
 * Valibot schema for validating OpenAPI array data objects.
 * 
 * This comprehensive schema validates OpenAPI array schemas according to the OpenAPI v3
 * specification, including item type definitions, length constraints, uniqueness requirements,
 * and enumeration values. It uses lazy evaluation to handle recursive schema references,
 * allowing for complex nested array structures and self-referential schemas.
 * 
 * The schema supports both direct schema definitions and reference objects for the items
 * property, enabling flexible array type definitions that can reference other schemas
 * in the document or define inline item types.
 * 
 * @example Validating a simple array schema
 * ```typescript
 * import { oasArrayData } from '@skmtc/core/oas/array';
 * import * as v from 'valibot';
 * 
 * const schema = {
 *   type: 'array',
 *   items: {
 *     type: 'string'
 *   },
 *   description: 'List of user names',
 *   minItems: 1,
 *   maxItems: 100
 * };
 * 
 * const validated = v.parse(oasArrayData, schema);
 * console.log(validated.minItems); // 1
 * ```
 * 
 * @example Validating array with reference items
 * ```typescript
 * const refArraySchema = {
 *   type: 'array',
 *   items: {
 *     $ref: '#/components/schemas/User'
 *   },
 *   title: 'User List',
 *   uniqueItems: true,
 *   default: []
 * };
 * 
 * const result = v.parse(oasArrayData, refArraySchema);
 * console.log(result.uniqueItems); // true
 * ```
 * 
 * @example Validating constrained arrays
 * ```typescript
 * const constrainedArray = {
 *   type: 'array',
 *   items: { type: 'number' },
 *   minItems: 2,
 *   maxItems: 10,
 *   uniqueItems: true,
 *   enums: [[1, 2, 3], [4, 5, 6]]
 * };
 * 
 * const validated = v.parse(oasArrayData, constrainedArray);
 * console.log(validated.maxItems); // 10
 * ```
 */
export const oasArrayData: v.GenericSchema<OasArrayData> = v.object({
  type: v.literal('array'),
  items: v.lazy(() => v.union([v.lazy(() => oasSchemaData), oasSchemaRefData])),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.array(v.unknown())),
  maxItems: v.optional(v.number()),
  minItems: v.optional(v.number()),
  uniqueItems: v.optional(v.boolean()),
  enums: v.optional(v.array(v.unknown()))
})

/**
 * Valibot schema for array data without the items property.
 * 
 * This specialized schema validates array schemas when the items property is processed
 * separately from the main array constraints. It's commonly used during schema parsing
 * and transformation processes where items need special handling, such as when resolving
 * references or applying schema merging operations.
 * 
 * This pattern is useful in multi-phase parsing where array constraints (like min/max
 * items, uniqueness) are validated independently from the item type definitions,
 * allowing for more flexible processing pipelines.
 * 
 * @example Validating array constraints without items
 * ```typescript
 * import { oasArrayDataWithoutItems } from '@skmtc/core/oas/array';
 * import * as v from 'valibot';
 * 
 * const constraintsOnly = {
 *   type: 'array',
 *   title: 'Validation Rules',
 *   minItems: 1,
 *   maxItems: 50,
 *   uniqueItems: true,
 *   default: []
 * };
 * 
 * const validated = v.parse(oasArrayDataWithoutItems, constraintsOnly);
 * console.log(validated.uniqueItems); // true
 * ```
 * 
 * @example Usage in two-phase parsing
 * ```typescript
 * function parseArraySchema(schema: unknown) {
 *   // Phase 1: Validate basic array structure
 *   const arrayConstraints = v.parse(oasArrayDataWithoutItems, schema);
 *   
 *   // Phase 2: Process items separately (not shown)
 *   const items = processItemsSchema((schema as any).items);
 *   
 *   return { ...arrayConstraints, items };
 * }
 * ```
 */
export const oasArrayDataWithoutItems: v.GenericSchema<OasArrayDataWithoutItems> = v.object({
  type: v.literal('array'),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  default: v.optional(v.array(v.unknown())),
  maxItems: v.optional(v.number()),
  minItems: v.optional(v.number()),
  uniqueItems: v.optional(v.boolean()),
  enums: v.optional(v.array(v.unknown()))
})

/**
 * Data type for OpenAPI array schema objects.
 * 
 * Represents the complete structure of OpenAPI array schemas as processed by the SKMTC
 * pipeline. This type includes all standard OpenAPI array schema properties including
 * item type specifications, length constraints, uniqueness requirements, and metadata
 * fields. It's used throughout the array processing pipeline for type-safe handling
 * of array schema definitions.
 * 
 * ## Usage in SKMTC Pipeline
 * 
 * This type is used by:
 * - Schema parsers to validate incoming array schema data
 * - Array processors to transform OpenAPI schemas into OAS objects
 * - Code generators to access array constraints and generate validation code
 * - Type generators to create appropriate array type definitions
 * 
 * @example Basic string array schema
 * ```typescript
 * import type { OasArrayData } from '@skmtc/core/oas/array';
 * 
 * const tagListSchema: OasArrayData = {
 *   type: 'array',
 *   items: {
 *     type: 'string',
 *     minLength: 1,
 *     maxLength: 50
 *   },
 *   title: 'Tag List',
 *   description: 'Collection of tags for categorization',
 *   minItems: 0,
 *   maxItems: 20,
 *   uniqueItems: true,
 *   default: []
 * };
 * ```
 * 
 * @example Array of referenced objects
 * ```typescript
 * const userListSchema: OasArrayData = {
 *   type: 'array',
 *   items: {
 *     $ref: '#/components/schemas/User'
 *   },
 *   title: 'User Collection',
 *   description: 'List of user objects',
 *   minItems: 1,
 *   default: []
 * };
 * ```
 * 
 * @example Complex nested array schema
 * ```typescript
 * const matrixSchema: OasArrayData = {
 *   type: 'array',
 *   items: {
 *     type: 'array',
 *     items: {
 *       type: 'number'
 *     },
 *     minItems: 3,
 *     maxItems: 3
 *   },
 *   title: '3x3 Matrix',
 *   description: 'Two-dimensional number array representing a 3x3 matrix',
 *   minItems: 3,
 *   maxItems: 3
 * };
 * ```
 * 
 * @example Enum array with constraints
 * ```typescript
 * const statusListSchema: OasArrayData = {
 *   type: 'array',
 *   items: {
 *     type: 'string',
 *     enum: ['active', 'inactive', 'pending']
 *   },
 *   title: 'Status List',
 *   description: 'Multiple status values',
 *   uniqueItems: true,
 *   enums: [
 *     ['active'],
 *     ['active', 'pending'],
 *     ['inactive', 'pending']
 *   ]
 * };
 * ```
 */
export type OasArrayData = {
  /** Type identifier (always 'array') */
  type: 'array'
  /** Schema definition for array items (can be direct schema or reference) */
  items: OasSchemaData | OasSchemaRefData
  /** Human-readable title for the array schema */
  title?: string
  /** Detailed description explaining the array's purpose and contents */
  description?: string
  /** Default value used when no explicit array is provided */
  default?: unknown[]
  /** Maximum number of items allowed in the array */
  maxItems?: number
  /** Minimum number of items required in the array */
  minItems?: number
  /** Whether all items in the array must be unique */
  uniqueItems?: boolean
  /** Array of valid enumeration values for the entire array */
  enums?: unknown[]
}

/**
 * Array schema data without the items property.
 * 
 * Represents an array schema with all standard properties except the items definition.
 * This type is used during parsing phases where item schemas are processed separately
 * from array constraints, enabling more flexible processing pipelines and better
 * separation of concerns in complex schema transformation operations.
 * 
 * ## Common Use Cases
 * 
 * - **Two-phase parsing**: Validate array structure first, then process items
 * - **Schema merging**: Combine array constraints from multiple sources
 * - **Constraint extraction**: Extract array rules for validation generation
 * - **Reference resolution**: Process items after resolving schema references
 * 
 * @example Array constraints for validation
 * ```typescript
 * import type { OasArrayDataWithoutItems } from '@skmtc/core/oas/array';
 * 
 * const constraintsSchema: OasArrayDataWithoutItems = {
 *   type: 'array',
 *   title: 'Validation Rules',
 *   description: 'Array with length and uniqueness constraints',
 *   minItems: 1,
 *   maxItems: 100,
 *   uniqueItems: true,
 *   default: []
 * };
 * ```
 * 
 * @example Enum constraints without item types
 * ```typescript
 * const enumArrayConstraints: OasArrayDataWithoutItems = {
 *   type: 'array',
 *   title: 'Option Groups',
 *   description: 'Predefined option combinations',
 *   enums: [
 *     ['option1', 'option2'],
 *     ['option3', 'option4'],
 *     ['option1', 'option3', 'option4']
 *   ],
 *   uniqueItems: true
 * };
 * ```
 */
export type OasArrayDataWithoutItems = {
  /** Type identifier (always 'array') */
  type: 'array'
  /** Human-readable title for the array schema */
  title?: string
  /** Detailed description explaining the array's purpose and contents */
  description?: string
  /** Default value used when no explicit array is provided */
  default?: unknown[]
  /** Maximum number of items allowed in the array */
  maxItems?: number
  /** Minimum number of items required in the array */
  minItems?: number
  /** Whether all items in the array must be unique */
  uniqueItems?: boolean
  /** Array of valid enumeration values for the entire array */
  enums?: unknown[]
}
