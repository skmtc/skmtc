import type { GeneratedValue } from '../types/GeneratedValue.ts'
import { EMPTY } from './constants.ts'

/**
 * A utility class for managing lists of generated values with customizable separators.
 * 
 * `GeneratedValueList` provides a way to collect multiple generated values and combine
 * them into a single string with a specified separator. It automatically filters out
 * empty values to prevent generating unnecessary whitespace or malformed output.
 * 
 * This class is useful for building lists of code elements like function parameters,
 * import statements, or any other comma-separated (or otherwise separated) constructs
 * where individual items might sometimes be empty.
 * 
 * ## Key Features
 * 
 * - **Custom Separators**: Support for any string separator (commas, newlines, spaces, etc.)
 * - **Empty Filtering**: Automatically removes empty values from output
 * - **Type Safety**: Works with any GeneratedValue type
 * - **Incremental Building**: Values can be added one at a time
 * 
 * @example Basic usage with comma separation
 * ```typescript
 * import { GeneratedValueList } from '@skmtc/core';
 * 
 * const parameterList = new GeneratedValueList(', ');
 * parameterList.add({ toString: () => 'id: string' });
 * parameterList.add({ toString: () => 'name: string' });
 * parameterList.add({ toString: () => 'email?: string' });
 * 
 * console.log(parameterList.toString());
 * // 'id: string, name: string, email?: string'
 * ```
 * 
 * @example With newline separation for code blocks
 * ```typescript
 * const codeLines = new GeneratedValueList('\n');
 * codeLines.add({ toString: () => 'import { User } from "./types";' });
 * codeLines.add({ toString: () => 'import { validate } from "./utils";' });
 * codeLines.add({ toString: () => '' }); // Empty line will be filtered
 * codeLines.add({ toString: () => 'export class UserService {' });
 * codeLines.add({ toString: () => '  // Implementation' });
 * codeLines.add({ toString: () => '}' });
 * 
 * console.log(codeLines.toString());
 * // import { User } from "./types";
 * // import { validate } from "./utils";
 * // export class UserService {
 * //   // Implementation
 * // }
 * ```
 * 
 * @example Empty value filtering
 * ```typescript
 * const mixedList = new GeneratedValueList(' | ');
 * mixedList.add({ toString: () => "'active'" });
 * mixedList.add({ toString: () => '' }); // This will be filtered out
 * mixedList.add({ toString: () => "'inactive'" });
 * mixedList.add({ toString: () => "'pending'" });
 * 
 * console.log(mixedList.toString());
 * // "'active' | 'inactive' | 'pending'"
 * ```
 * 
 * @example Using in code generation
 * ```typescript
 * class InterfaceGenerator {
 *   generateInterface(name: string, properties: Array<{name: string, type: string}>) {
 *     const propertyList = new GeneratedValueList(';\n  ');
 *     
 *     properties.forEach(prop => {
 *       if (prop.type) { // Only add properties that have types
 *         propertyList.add({
 *           toString: () => `${prop.name}: ${prop.type}`
 *         });
 *       }
 *     });
 *     
 *     return `interface ${name} {\n  ${propertyList.toString()};\n}`;
 *   }
 * }
 * 
 * const generator = new InterfaceGenerator();
 * const userInterface = generator.generateInterface('User', [
 *   { name: 'id', type: 'string' },
 *   { name: 'name', type: 'string' },
 *   { name: 'invalid', type: '' }, // Will be filtered out
 *   { name: 'email', type: 'string | null' }
 * ]);
 * 
 * console.log(userInterface);
 * // interface User {
 * //   id: string;
 * //   name: string;
 * //   email: string | null;
 * // }
 * ```
 */
export class GeneratedValueList {
  /** The separator string used to join values */
  separator: string
  
  /** Internal array of generated values */
  private items: GeneratedValue[] = []

  /**
   * Creates a new GeneratedValueList with the specified separator.
   * 
   * @param separator - The string to use when joining values (e.g., ', ', '\n', ' | ')
   * 
   * @example
   * ```typescript
   * // For comma-separated lists
   * const commaList = new GeneratedValueList(', ');
   * 
   * // For line-separated content
   * const lineList = new GeneratedValueList('\n');
   * 
   * // For union types
   * const unionList = new GeneratedValueList(' | ');
   * ```
   */
  constructor(separator: string) {
    this.separator = separator
  }

  /**
   * Adds a generated value to the list.
   * 
   * The value will be included in the output string when `toString()` is called,
   * unless the value's `toString()` method returns an empty string, in which case
   * it will be automatically filtered out.
   * 
   * @param str - The generated value to add to the list
   * 
   * @example
   * ```typescript
   * const list = new GeneratedValueList(', ');
   * 
   * // Add simple values
   * list.add({ toString: () => 'value1' });
   * list.add({ toString: () => 'value2' });
   * 
   * // Add conditional values
   * const conditionalValue = shouldInclude ? 'conditional' : '';
   * list.add({ toString: () => conditionalValue });
   * 
   * console.log(list.toString()); // 'value1, value2' (conditional filtered if empty)
   * ```
   */
  add(str: GeneratedValue): void {
    this.items.push(str)
  }

  /**
   * Converts the list to a string representation with values joined by the separator.
   * 
   * This method processes all added values by calling their `toString()` methods,
   * filters out any empty strings (matching the {@link EMPTY} constant), and joins
   * the remaining values with the configured separator.
   * 
   * @returns The joined string representation of all non-empty values
   * 
   * @example
   * ```typescript
   * const list = new GeneratedValueList(' -> ');
   * list.add({ toString: () => 'start' });
   * list.add({ toString: () => '' }); // Will be filtered out
   * list.add({ toString: () => 'middle' });
   * list.add({ toString: () => 'end' });
   * 
   * console.log(list.toString()); // 'start -> middle -> end'
   * ```
   */
  toString(): string {
    return this.items
      .map(item => item.toString())
      .filter(item => item !== EMPTY)
      .join(this.separator)
  }
}
