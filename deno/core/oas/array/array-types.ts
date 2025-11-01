import * as v from 'valibot'

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
