import * as v from 'valibot'

/**
 * Valibot schema for validating OpenAPI void data objects.
 * 
 * Not an actual OpenAPI type, but used internally by SKMTC to represent
 * void/empty types during schema transformation. Useful for operations
 * that return no content (e.g., DELETE operations with 204 responses).
 */
export const oasVoidData = v.object({
  oasType: v.literal('schema'),
  description: v.optional(v.string()),
  type: v.literal('void')
})

/**
 * Data type for OpenAPI void schema objects.
 * 
 * Represents void/empty types used internally by SKMTC for operations
 * that return no content. This is not a standard OpenAPI type but is
 * useful for code generation where explicit void types are needed.
 */
export type OasVoidData = {
  /** Type category identifier for schema objects */
  oasType: 'schema'
  /** Optional description of the void schema */
  description?: string
  /** Type identifier (always 'void') */
  type: 'void'
}
