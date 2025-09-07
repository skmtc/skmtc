import { EMPTY } from '../dsl/constants.ts'
import type { Stringable } from '../dsl/Stringable.ts'

/**
 * Converts a properties object into a formatted TypeScript object literal string.
 * 
 * This utility function takes a record of key-value pairs and generates a properly
 * formatted TypeScript object literal. It automatically filters out empty values
 * and handles proper spacing and comma placement. If all properties are empty,
 * it returns the EMPTY constant instead of an empty object.
 * 
 * The function is particularly useful for generating TypeScript interface properties,
 * object type definitions, and literal object expressions in code generation scenarios.
 * 
 * @param properties - Record of property names to their stringable values
 * @returns Formatted object literal string or EMPTY if no valid properties
 * 
 * @example Basic object generation
 * ```typescript
 * import { keyValues } from '@skmtc/core';
 * 
 * const props = {
 *   name: { toString: () => 'string' },
 *   age: { toString: () => 'number' },
 *   email: { toString: () => 'string' }
 * };
 * 
 * const result = keyValues(props);
 * console.log(result);
 * // {name: string,
 * // age: number,
 * // email: string}
 * ```
 * 
 * @example With empty values filtered
 * ```typescript
 * const propsWithEmpty = {
 *   name: { toString: () => 'string' },
 *   description: { toString: () => '' }, // Empty, will be filtered
 *   age: { toString: () => 'number' },
 *   notes: { toString: () => 'EMPTY' }   // EMPTY constant, will be filtered
 * };
 * 
 * const result = keyValues(propsWithEmpty);
 * console.log(result);
 * // {name: string,
 * // age: number}
 * ```
 * 
 * @example All empty properties
 * ```typescript
 * const emptyProps = {
 *   description: { toString: () => '' },
 *   notes: { toString: () => 'EMPTY' }
 * };
 * 
 * const result = keyValues(emptyProps);
 * console.log(result === EMPTY); // true
 * ```
 * 
 * @example TypeScript interface generation
 * ```typescript
 * class InterfaceGenerator {
 *   generateInterface(name: string, properties: Record<string, Stringable>) {
 *     const propsString = keyValues(properties);
 *     
 *     if (propsString === EMPTY) {
 *       return `interface ${name} {}`;
 *     }
 *     
 *     return `interface ${name} ${propsString}`;
 *   }
 * }
 * 
 * const generator = new InterfaceGenerator();
 * const userInterface = generator.generateInterface('User', {
 *   id: { toString: () => 'string' },
 *   name: { toString: () => 'string' },
 *   age: { toString: () => 'number' }
 * });
 * 
 * console.log(userInterface);
 * // interface User {id: string,
 * // name: string,
 * // age: number}
 * ```
 * 
 * @example Object literal generation
 * ```typescript
 * function generateObjectLiteral(values: Record<string, string>) {
 *   const stringableValues = Object.fromEntries(
 *     Object.entries(values).map(([k, v]) => [k, { toString: () => `'${v}'` }])
 *   );
 *   
 *   const result = keyValues(stringableValues);
 *   return result === EMPTY ? '{}' : result;
 * }
 * 
 * const config = generateObjectLiteral({
 *   apiUrl: 'https://api.example.com',
 *   timeout: '5000'
 * });
 * 
 * console.log(config);
 * // {apiUrl: 'https://api.example.com',
 * // timeout: '5000'}
 * ```
 * 
 * @example Conditional property inclusion
 * ```typescript
 * class ConditionalGenerator {
 *   generateObjectType(fields: Array<{name: string, type: string, optional?: boolean}>) {
 *     const properties: Record<string, Stringable> = {};
 *     
 *     fields.forEach(field => {
 *       if (field.type) { // Only include fields with types
 *         const optionalMarker = field.optional ? '?' : '';
 *         properties[field.name] = {
 *           toString: () => `${optionalMarker}: ${field.type}`
 *         };
 *       }
 *     });
 *     
 *     return keyValues(properties);
 *   }
 * }
 * ```
 */
export const keyValues = (properties: Record<string, Stringable>): string => {
  const filteredEntries = Object.entries(properties)
    .map(([key, value]) => {
      const renderedValue = value?.toString() || EMPTY

      return renderedValue === EMPTY ? EMPTY : `${key}: ${renderedValue}`
    })
    .filter(row => row !== EMPTY)

  return filteredEntries.length ? `{${filteredEntries.join(',\n')}}` : EMPTY
}
