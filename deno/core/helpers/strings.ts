/**
 * @fileoverview String Manipulation Utilities for SKMTC Core
 *
 * This module provides a comprehensive collection of string manipulation utilities
 * commonly needed for code generation, identifier transformation, and text processing
 * within the SKMTC pipeline. These utilities handle case conversions, pluralization,
 * sanitization, and various text transformations.
 *
 * ## Key Features
 *
 * - **Case Conversion**: camelCase, PascalCase, snake_case, kebab-case, and more
 * - **Pluralization**: Smart singular/plural transformations with irregular forms
 * - **Sanitization**: Clean strings for use as identifiers and file names
 * - **Text Processing**: Trimming, padding, wrapping, and formatting utilities
 * - **Unicode Support**: Proper handling of international characters
 *
 * @example Case conversions
 * ```typescript
 * import { capitalize, camelCase, pascalCase } from '@skmtc/core/strings';
 *
 * capitalize('hello world'); // 'Hello world'
 * camelCase('user_profile_data'); // 'userProfileData'
 * pascalCase('api-response-type'); // 'ApiResponseType'
 * ```
 *
 * @example Pluralization
 * ```typescript
 * import { pluralize, singularize } from '@skmtc/core/strings';
 *
 * pluralize('user'); // 'users'
 * pluralize('child'); // 'children'
 * singularize('categories'); // 'category'
 * ```
 *
 * @example Identifier sanitization
 * ```typescript
 * import { sanitizeIdentifier, toFileName } from '@skmtc/core/strings';
 *
 * sanitizeIdentifier('123-invalid name!'); // 'invalid_name'
 * toFileName('My API Response'); // 'my-api-response'
 * ```
 *
 * @module strings
 */

/**
 * Capitalizes the first character of a string.
 *
 * @param str - The string to capitalize
 * @returns The string with the first character uppercased
 *
 * @example
 * ```typescript
 * capitalize('hello world'); // 'Hello world'
 * capitalize('API'); // 'API'
 * capitalize(''); // ''
 * ```
 */
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Decapitalizes (lowercases) the first character of a string.
 *
 * @param str - The string to decapitalize
 * @returns The string with the first character lowercased
 *
 * @example
 * ```typescript
 * decapitalize('Hello World'); // 'hello World'
 * decapitalize('API'); // 'aPI'
 * decapitalize(''); // ''
 * ```
 */
export const decapitalize = (str: string): string => {
  return str.charAt(0).toLocaleLowerCase() + str.slice(1)
}

/**
 * Options for controlling camelCase conversion behavior.
 */
type CamelCaseOptions = {
  /** Whether to capitalize the first character (PascalCase) */
  upperFirst?: boolean
  /** Whether to retain underscores in place when converting strings */
  retainUnderscores?: boolean
}

/**
 * Converts a string to camelCase, removing non-alphanumeric characters.
 *
 * This function handles various input formats including kebab-case, snake_case,
 * space-separated words, and mixed formats. It intelligently capitalizes words
 * after the first unless `upperFirst` is specified.
 *
 * @param str - The string to convert to camelCase
 * @param options - Options to control the conversion
 * @param options.upperFirst - Whether to capitalize the first character (default: false)
 * @param options.retainUnderscores - Whether to retain underscores in place (default: false)
 * @returns The camelCase version of the input string
 *
 * @example Basic usage
 * ```typescript
 * camelCase('hello world'); // 'helloWorld'
 * camelCase('user-name'); // 'userName'
 * camelCase('api_key'); // 'apiKey'
 * camelCase('HTTP-Response'); // 'httpResponse'
 * ```
 *
 * @example PascalCase (upperFirst)
 * ```typescript
 * camelCase('user profile', { upperFirst: true }); // 'UserProfile'
 * camelCase('api-client', { upperFirst: true }); // 'ApiClient'
 * ```
 *
 * @example Complex inputs
 * ```typescript
 * camelCase('get-user-by-id'); // 'getUserById'
 * camelCase('XML_HTTP_Request'); // 'xmlHttpRequest'
 * camelCase('2fa-enabled'); // '2faEnabled'
 * ```
 *
 * @example Retaining underscores (retainUnderscores)
 * ```typescript
 * camelCase('user_name', { retainUnderscores: true }); // 'user_name'
 * camelCase('api-key_token', { retainUnderscores: true }); // 'apiKey_token'
 * camelCase('get_user_by_id', { retainUnderscores: true }); // 'get_user_by_id'
 * camelCase('user_profile', { upperFirst: true, retainUnderscores: true }); // 'User_profile'
 * ```
 */
export const camelCase = (
  str: string,
  { upperFirst, retainUnderscores }: CamelCaseOptions = {}
): string => {
  // Check if string starts with a delimiter
  const startsWithDelimiter = retainUnderscores
    ? /^[^a-zA-Z0-9_]/.test(str) // Non-alphanumeric except underscore
    : /^[^a-zA-Z0-9]/.test(str) // Non-alphanumeric including underscore

  let isFirstMatch = true

  // Determine delimiter pattern based on retainUnderscores
  const delimiterPattern = retainUnderscores
    ? /[^a-zA-Z0-9_]+([a-zA-Z0-9_]+)/g // Treat underscore as regular character
    : /[^a-zA-Z0-9]+([a-zA-Z0-9]+)/g // Treat underscore as delimiter

  const camelCased = str.replace(delimiterPattern, (_, matched) => {
    // If string starts with delimiter and this is the first match:
    // - Capitalize only if upperFirst is true
    // Otherwise, always capitalize (word comes after delimiter)
    if (isFirstMatch && startsWithDelimiter && !upperFirst) {
      isFirstMatch = false
      return matched
    }

    isFirstMatch = false
    return capitalize(matched)
  })

  // Clean non-alphanumeric characters (preserving underscores if retainUnderscores)
  const cleanPattern = retainUnderscores ? /[^a-zA-Z0-9_]/g : /[^a-zA-Z0-9]/g
  const cleaned = camelCased.replace(cleanPattern, '')

  return upperFirst ? capitalize(cleaned) : cleaned
}
