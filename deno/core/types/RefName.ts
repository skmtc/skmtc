/**
 * @fileoverview Reference Name System for SKMTC Core
 * 
 * This module provides a type-safe reference name system for identifying
 * OpenAPI schema components throughout the SKMTC pipeline. Reference names
 * are branded types that ensure schema identifiers are handled safely and
 * prevent accidental mixing with regular strings.
 * 
 * The reference name system is crucial for maintaining type safety when
 * working with OpenAPI component references, schema lookups, and cross-references
 * between different parts of the generated code.
 * 
 * ## Key Features
 * 
 * - **Type Safety**: Branded types prevent string confusion and improve code reliability
 * - **Schema Integration**: Direct mapping to OpenAPI components.schemas keys
 * - **Reference Tracking**: Safe handling of schema references throughout generation
 * - **IDE Support**: Enhanced IntelliSense and error detection in development
 * - **Validation**: Compile-time validation of schema reference usage
 * 
 * @example Basic reference name usage
 * ```typescript
 * import type { RefName } from '@skmtc/core/RefName';
 * 
 * // Create a reference name (typically done by the parser)
 * const userRef: RefName = 'User' as RefName;
 * const productRef: RefName = 'Product' as RefName;
 * 
 * // TypeScript prevents mixing with regular strings
 * const regularString = 'User';
 * // const invalid: RefName = regularString; // Type error!
 * ```
 * 
 * @example Using reference names in generators
 * ```typescript
 * import type { RefName } from '@skmtc/core/RefName';
 * 
 * function generateModelImport(refName: RefName): string {
 *   return `import type { ${refName} } from './models/${refName}';`;
 * }
 * 
 * function generateModelReference(refName: RefName): string {
 *   return `#/components/schemas/${refName}`;
 * }
 * 
 * // Usage with type safety
 * const userRef: RefName = 'User' as RefName;
 * const importStatement = generateModelImport(userRef);
 * const schemaRef = generateModelReference(userRef);
 * ```
 * 
 * @example Reference name validation
 * ```typescript
 * import type { RefName } from '@skmtc/core/RefName';
 * 
 * function isValidRefName(value: string): value is RefName {
 *   // Validate that the string is a valid schema reference name
 *   return /^[A-Za-z][A-Za-z0-9_]*$/.test(value) && value.length > 0;
 * }
 * 
 * function safeCreateRefName(value: string): RefName | null {
 *   if (isValidRefName(value)) {
 *     return value as RefName;
 *   }
 *   return null;
 * }
 * ```
 * 
 * @module RefName
 */

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
