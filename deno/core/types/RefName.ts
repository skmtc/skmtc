import type { Brand } from './Brand.ts'

/**
 * Branded type representing a reference name for OpenAPI schemas.
 *
 * `RefName` is a branded string type that ensures type safety when working
 * with schema reference names throughout the SKMTC system. It prevents
 * accidental mixing of regular strings with schema reference identifiers.
 *
 * Reference names typically correspond to keys in the OpenAPI `components.schemas`
 * section and are used to create cross-references between different parts
 * of the schema definition.
 *
 * @example
 * ```typescript
 * import { RefName } from '@skmtc/core';
 *
 * // RefName is extracted from OpenAPI schema references
 * const userRefName: RefName = 'User' as RefName;
 * const productRefName: RefName = 'Product' as RefName;
 *
 * // Used in schema references
 * const userRef = new OasRef({
 *   refName: userRefName, // Type-safe reference name
 *   ref: '#/components/schemas/User'
 * });
 * ```
 *
 * @example In generator contexts
 * ```typescript
 * class ModelGenerator extends ModelBase {
 *   constructor(args: { refName: RefName; ... }) {
 *     super(args);
 *     // this.refName is guaranteed to be a valid schema reference
 *   }
 *
 *   toDefinition(): Definition {
 *     // RefName ensures we're working with valid schema identifiers
 *     const schemaName = this.refName; // Type: RefName
 *     return new Definition({
 *       identifier: Identifier.createType(schemaName),
 *       // ...
 *     });
 *   }
 * }
 * ```
 *
 * @example Type safety benefits
 * ```typescript
 * function processSchema(refName: RefName) {
 *   // RefName brand ensures this is a valid schema reference
 *   console.log(`Processing schema: ${refName}`);
 * }
 *
 * const validRef: RefName = 'User' as RefName;
 * const regularString = 'just a string';
 *
 * processSchema(validRef);     // ✅ Works - RefName type
 * processSchema(regularString); // ❌ TypeScript error - string is not RefName
 * ```
 *
 * @see {@link Brand} for the underlying branding mechanism
 */
export type RefName = Brand<string, 'RefName'>
