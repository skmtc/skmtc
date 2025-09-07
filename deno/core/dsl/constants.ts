/**
 * Marker constant representing an empty or unset value in the SKMTC DSL system.
 * 
 * This constant is used throughout the DSL to represent placeholders, empty
 * templates, or uninitialized content. It provides a consistent way to identify
 * empty states that need to be handled during code generation.
 * 
 * @example Usage in templates
 * ```typescript
 * import { EMPTY } from '@skmtc/core';
 * 
 * const template = someCondition ? 'actual content' : EMPTY;
 * 
 * if (template === EMPTY) {
 *   // Handle empty state
 *   console.log('No content to generate');
 * }
 * ```
 * 
 * @example DSL content generation
 * ```typescript
 * const content = new List([
 *   'import { User } from "./types";',
 *   someFeature ? 'import { Admin } from "./admin";' : EMPTY,
 *   'export { User };'
 * ]).filter(line => line !== EMPTY);
 * ```
 */
export const EMPTY = '__EMPTY__'
