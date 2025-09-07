/**
 * @fileoverview Brand Type System for SKMTC Core
 * 
 * This module provides TypeScript branded types for creating type-safe identifiers
 * and values that are structurally identical but nominally distinct. Branded types
 * help prevent mixing up similar primitive types and provide better type safety
 * across the SKMTC codebase.
 * 
 * ## Key Features
 * 
 * - **Type Safety**: Prevents accidental mixing of similar primitive types
 * - **Nominal Typing**: Creates distinct types from the same underlying type
 * - **Zero Runtime Cost**: Pure TypeScript compile-time construct
 * - **Developer Experience**: Better IntelliSense and error messages
 * 
 * @example Creating branded types
 * ```typescript
 * import type { Brand } from '@skmtc/core/Brand';
 * 
 * type UserId = Brand<string, 'UserId'>;
 * type ProductId = Brand<string, 'ProductId'>;
 * 
 * const userId: UserId = 'user-123' as UserId;
 * const productId: ProductId = 'prod-456' as ProductId;
 * 
 * // TypeScript will prevent this error:
 * // const wrong: UserId = productId; // Type error!
 * ```
 * 
 * @example Using with numbers
 * ```typescript
 * type Score = Brand<number, 'Score'>;
 * type Percentage = Brand<number, 'Percentage'>;
 * 
 * function calculateGrade(score: Score, total: Score): Percentage {
 *   return ((score / total) * 100) as Percentage;
 * }
 * ```
 * 
 * @module Brand
 */

/**
 * Unique symbol used for branding types.
 * 
 * This symbol is used internally by the {@link Brand} type to create
 * unique branded types that are structurally identical but nominally
 * distinct from their base types.
 * 
 * @internal
 */
declare const brand: unique symbol

/**
 * Creates a branded type from a base type.
 * 
 * Brand types (also known as nominal types or opaque types) are TypeScript
 * types that are structurally identical to their base type but are treated
 * as distinct types by the type system. This prevents accidental mixing of
 * values that should be kept separate.
 * 
 * The SKMTC system uses branded types extensively to ensure type safety
 * when working with identifiers, keys, and other string-based values that
 * have specific semantic meaning.
 * 
 * @template T - The base type to brand
 * @template TBrand - The brand identifier (usually a string literal)
 * 
 * @example Basic branded type usage
 * ```typescript
 * import { Brand } from '@skmtc/core';
 * 
 * type UserId = Brand<string, 'UserId'>;
 * type ProductId = Brand<string, 'ProductId'>;
 * 
 * const userId: UserId = 'user-123' as UserId;
 * const productId: ProductId = 'prod-456' as ProductId;
 * 
 * function getUser(id: UserId) {
 *   // Function expects a UserId, not just any string
 *   return `User with ID: ${id}`;
 * }
 * 
 * getUser(userId);    // ✅ Works - correct type
 * getUser(productId); // ❌ TypeScript error - ProductId is not UserId
 * getUser('user-789'); // ❌ TypeScript error - string is not UserId
 * ```
 * 
 * @example SKMTC branded types
 * ```typescript
 * // RefName ensures schema reference safety
 * type RefName = Brand<string, 'RefName'>;
 * const schemaRef: RefName = 'User' as RefName;
 * 
 * // GeneratorKey ensures generator identification safety
 * type OperationGeneratorKey = Brand<string, 'OperationGeneratorKey'>;
 * const opKey: OperationGeneratorKey = 'api-client|/users|get' as OperationGeneratorKey;
 * ```
 * 
 * @example Runtime behavior
 * ```typescript
 * type EmailAddress = Brand<string, 'EmailAddress'>;
 * 
 * const email: EmailAddress = 'user@example.com' as EmailAddress;
 * 
 * // At runtime, branded types are just their base type
 * console.log(typeof email); // 'string'
 * console.log(email);        // 'user@example.com'
 * 
 * // But TypeScript enforces the brand at compile time
 * function sendEmail(to: EmailAddress) {
 *   // Implementation
 * }
 * 
 * sendEmail(email);               // ✅ Works
 * sendEmail('test@example.com');  // ❌ Error - needs EmailAddress brand
 * ```
 */
export type Brand<T, TBrand> = T & { [brand]: TBrand }
