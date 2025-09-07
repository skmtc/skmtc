/**
 * Type modifiers used throughout the SKMTC type system.
 * 
 * `Modifiers` represent additional metadata and constraints that can be
 * applied to type system values. These modifiers affect how types are
 * generated and used in the target language output.
 * 
 * @example Basic usage
 * ```typescript
 * import { Modifiers } from '@skmtc/core';
 * 
 * const stringModifiers: Modifiers = {
 *   required: true,
 *   nullable: false,
 *   description: 'User email address'
 * };
 * 
 * const optionalModifiers: Modifiers = {
 *   required: false,
 *   nullable: true,
 *   description: 'Optional user profile image URL'
 * };
 * ```
 * 
 * @example In type system values
 * ```typescript
 * const emailField: TypeSystemString = {
 *   type: 'string',
 *   format: 'email',
 *   enums: undefined,
 *   modifiers: {
 *     required: true,
 *     nullable: false,
 *     description: 'Valid email address for account registration'
 *   }
 * };
 * 
 * const optionalNote: TypeSystemString = {
 *   type: 'string',
 *   format: undefined,
 *   enums: undefined,
 *   modifiers: {
 *     required: false,
 *     nullable: true,
 *     description: 'Optional user note or comment'
 *   }
 * };
 * ```
 * 
 * @example TypeScript generation
 * ```typescript
 * function generateTypeScript(type: TypeSystemValue): string {
 *   const baseType = generateBaseType(type);
 *   const optional = !type.modifiers.required ? '?' : '';
 *   const nullable = type.modifiers.nullable ? ' | null' : '';
 *   
 *   return `${baseType}${nullable}${optional}`;
 * }
 * 
 * // Required non-null string: 'string'
 * // Optional non-null string: 'string?'  
 * // Required nullable string: 'string | null'
 * // Optional nullable string: 'string | null?'
 * ```
 */
export type Modifiers = {
  /** Whether the field is required (affects optional markers in generated types) */
  required?: boolean
  /** Human-readable description of the field (used in documentation) */
  description?: string
  /** Whether the field can be null (affects null union types) */
  nullable?: boolean
}
