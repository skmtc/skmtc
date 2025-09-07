/**
 * Checks whether a record/object is empty (has no enumerable properties).
 * 
 * This utility function determines if an object contains any enumerable properties
 * by checking the length of its keys array. It's commonly used throughout the
 * SKMTC codebase to validate whether generated objects, configurations, or
 * other data structures contain meaningful content.
 * 
 * @param value - The record/object to check for emptiness
 * @returns `true` if the object has no enumerable properties, `false` otherwise
 * 
 * @example Basic usage
 * ```typescript
 * import { isEmpty } from '@skmtc/core';
 * 
 * console.log(isEmpty({})); // true
 * console.log(isEmpty({ name: 'John' })); // false
 * console.log(isEmpty({ a: undefined })); // false (undefined is still a property)
 * ```
 * 
 * @example In conditional logic
 * ```typescript
 * const userPreferences = loadUserPreferences();
 * 
 * if (isEmpty(userPreferences)) {
 *   // Apply default settings
 *   applyDefaults();
 * } else {
 *   // Use user's custom settings
 *   applyUserSettings(userPreferences);
 * }
 * ```
 * 
 * @example Filtering collections
 * ```typescript
 * const configurations = [
 *   { api: 'v1', settings: {} },
 *   { api: 'v2', settings: { timeout: 5000 } },
 *   { api: 'v3', settings: {} }
 * ];
 * 
 * const validConfigs = configurations.filter(config => !isEmpty(config.settings));
 * console.log(validConfigs); // [{ api: 'v2', settings: { timeout: 5000 } }]
 * ```
 * 
 * @example Code generation usage
 * ```typescript
 * class Generator {
 *   generateInterface(properties: Record<string, string>) {
 *     if (isEmpty(properties)) {
 *       return 'interface EmptyInterface {}';
 *     }
 * 
 *     const props = Object.entries(properties)
 *       .map(([name, type]) => `  ${name}: ${type};`)
 *       .join('\n');
 * 
 *     return `interface GeneratedInterface {\n${props}\n}`;
 *   }
 * }
 * ```
 */
export const isEmpty = (value: Record<string, any>): boolean => {
  return Object.keys(value).length === 0
}
