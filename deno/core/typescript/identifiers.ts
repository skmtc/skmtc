// @deno-types="npm:@types/babel__helper-validator-identifier@7.15.2"
import { isIdentifierName } from 'npm:@babel/helper-validator-identifier@7.27.1'

/**
 * Safely formats a key for use in object literals, adding quotes if needed.
 * 
 * This function determines whether a property key needs to be quoted in JavaScript/TypeScript
 * object literals based on identifier naming rules. Valid identifiers are left unquoted,
 * while invalid identifiers (containing spaces, special characters, starting with numbers, etc.)
 * are wrapped in single quotes.
 * 
 * @param key - The property key to format
 * @returns The key as-is if it's a valid identifier, otherwise wrapped in quotes
 * 
 * @example Valid identifiers (no quotes needed)
 * ```typescript
 * import { handleKey } from '@skmtc/core';
 * 
 * console.log(handleKey('name'));      // 'name'
 * console.log(handleKey('userName'));  // 'userName'
 * console.log(handleKey('_private'));  // '_private'
 * console.log(handleKey('$special'));  // '$special'
 * ```
 * 
 * @example Invalid identifiers (quotes added)
 * ```typescript
 * console.log(handleKey('first-name'));  // "'first-name'"
 * console.log(handleKey('2nd-place'));   // "'2nd-place'"
 * console.log(handleKey('user name'));   // "'user name'"
 * console.log(handleKey('api-key'));     // "'api-key'"
 * console.log(handleKey('data.nested')); // "'data.nested'"
 * ```
 * 
 * @example Usage in object generation
 * ```typescript
 * class ObjectGenerator {
 *   generateObjectLiteral(properties: Record<string, string>) {
 *     const props = Object.entries(properties)
 *       .map(([key, value]) => `${handleKey(key)}: ${value}`)
 *       .join(', ');
 *     
 *     return `{ ${props} }`;
 *   }
 * }
 * 
 * const generator = new ObjectGenerator();
 * const result = generator.generateObjectLiteral({
 *   'name': 'string',
 *   'first-name': 'string',
 *   'age': 'number'
 * });
 * 
 * console.log(result);
 * // { name: string, 'first-name': string, age: number }
 * ```
 * 
 * @example TypeScript interface generation
 * ```typescript
 * function generateInterface(name: string, properties: Record<string, string>) {
 *   const props = Object.entries(properties)
 *     .map(([key, type]) => `  ${handleKey(key)}: ${type};`)
 *     .join('\n');
 *   
 *   return `interface ${name} {\n${props}\n}`;
 * }
 * 
 * const userInterface = generateInterface('User', {
 *   'id': 'string',
 *   'first-name': 'string',
 *   'last_name': 'string',
 *   '2fa-enabled': 'boolean'
 * });
 * 
 * console.log(userInterface);
 * // interface User {
 * //   id: string;
 * //   'first-name': string;
 * //   last_name: string;
 * //   '2fa-enabled': boolean;
 * // }
 * ```
 */
export const handleKey = (key: string): string => {
  return isIdentifierName(key) ? key : `'${key}'`
}

/**
 * Safely formats property access, using dot notation or bracket notation as appropriate.
 * 
 * This function generates the appropriate property access syntax for JavaScript/TypeScript
 * code. Valid identifiers use dot notation (`parent.property`), while invalid identifiers
 * use bracket notation (`parent['property']`).
 * 
 * @param name - The property name to access
 * @param parent - The parent object expression
 * @returns Properly formatted property access expression
 * 
 * @example Valid identifiers (dot notation)
 * ```typescript
 * import { handlePropertyName } from '@skmtc/core';
 * 
 * console.log(handlePropertyName('name', 'user'));      // 'user.name'
 * console.log(handlePropertyName('firstName', 'user')); // 'user.firstName'
 * console.log(handlePropertyName('_id', 'document'));   // 'document._id'
 * console.log(handlePropertyName('$meta', 'data'));     // 'data.$meta'
 * ```
 * 
 * @example Invalid identifiers (bracket notation)
 * ```typescript
 * console.log(handlePropertyName('first-name', 'user'));  // "user['first-name']"
 * console.log(handlePropertyName('2nd-place', 'result')); // "result['2nd-place']"
 * console.log(handlePropertyName('user name', 'form'));   // "form['user name']"
 * console.log(handlePropertyName('api-key', 'config'));   // "config['api-key']"
 * ```
 * 
 * @example Usage in accessor generation
 * ```typescript
 * class PropertyAccessor {
 *   generateGetter(objectName: string, propertyPath: string[]) {
 *     return propertyPath.reduce((acc, prop) => 
 *       handlePropertyName(prop, acc), objectName
 *     );
 *   }
 * }
 * 
 * const accessor = new PropertyAccessor();
 * const path1 = accessor.generateGetter('data', ['user', 'profile', 'firstName']);
 * const path2 = accessor.generateGetter('config', ['api-settings', 'retry-count']);
 * 
 * console.log(path1); // 'data.user.profile.firstName'
 * console.log(path2); // "config['api-settings']['retry-count']"
 * ```
 * 
 * @example Complex object navigation
 * ```typescript
 * function generateObjectAccess(base: string, properties: string[]) {
 *   let result = base;
 *   
 *   for (const prop of properties) {
 *     result = handlePropertyName(prop, result);
 *   }
 *   
 *   return result;
 * }
 * 
 * const access1 = generateObjectAccess('response', ['data', 'user-info', 'name']);
 * const access2 = generateObjectAccess('settings', ['ui', 'theme', 'darkMode']);
 * 
 * console.log(access1); // "response.data['user-info'].name"
 * console.log(access2); // "settings.ui.theme.darkMode"
 * ```
 * 
 * @example Function generation
 * ```typescript
 * function generatePropertyGetter(objName: string, propName: string) {
 *   const access = handlePropertyName(propName, objName);
 *   return `function get${propName.replace(/[^a-zA-Z0-9]/g, '')}() { return ${access}; }`;
 * }
 * 
 * const getter1 = generatePropertyGetter('user', 'firstName');
 * const getter2 = generatePropertyGetter('config', 'api-key');
 * 
 * console.log(getter1); // "function getfirstName() { return user.firstName; }"
 * console.log(getter2); // "function getapikey() { return config['api-key']; }"
 * ```
 */
export const handlePropertyName = (name: string, parent: string): string => {
  return isIdentifierName(name) ? `${parent}.${name}` : `${parent}['${name}']`
}
