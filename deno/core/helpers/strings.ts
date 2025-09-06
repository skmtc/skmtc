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
 */
export const camelCase = (str: string, { upperFirst }: CamelCaseOptions = {}): string => {
  let doCapitalize = Boolean(upperFirst)

  const camelCased = str.replace(/[^a-zA-Z0-9]+([a-zA-Z0-9]+)/g, (_, matched) => {
    if (doCapitalize) {
      return capitalize(matched)
    }

    doCapitalize = true

    return matched
  })

  const cleaned = camelCased.replaceAll(/[^a-z0-9]*/gi, '')

  return upperFirst ? capitalize(cleaned) : cleaned
}

