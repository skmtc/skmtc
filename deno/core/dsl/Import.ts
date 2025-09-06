/**
 * Constructor arguments for {@link Import}.
 */
type ConstructorArgs = {
  /** The module path to import from */
  module: string
  /** Array of import names (can be strings or alias objects) */
  importNames: ImportNameArg[]
}

/**
 * Represents a TypeScript import statement in the SKMTC DSL system.
 * 
 * The `Import` class generates properly formatted import statements for TypeScript
 * files, handling named imports with optional aliases. It's used throughout the
 * code generation pipeline to manage module dependencies.
 * 
 * This class supports both simple string imports and aliased imports, making it
 * easy to avoid naming conflicts and provide cleaner import statements.
 * 
 * @example Basic named imports
 * ```typescript
 * import { Import } from '@skmtc/core';
 * 
 * const basicImport = new Import({
 *   module: './types',
 *   importNames: ['User', 'Product', 'Order']
 * });
 * 
 * console.log(basicImport.toString());
 * // import { User, Product, Order } from './types'
 * ```
 * 
 * @example Imports with aliases
 * ```typescript
 * const aliasedImport = new Import({
 *   module: 'react',
 *   importNames: [
 *     'useState',
 *     'useEffect',
 *     { 'default': 'React' } // Import default as React
 *   ]
 * });
 * 
 * console.log(aliasedImport.toString());
 * // import { useState, useEffect, default as React } from 'react'
 * ```
 * 
 * @example Mixed imports
 * ```typescript
 * const mixedImport = new Import({
 *   module: './api/client',
 *   importNames: [
 *     'ApiClient',
 *     { 'RequestOptions': 'Options' }, // Alias to avoid conflicts
 *     'ResponseType'
 *   ]
 * });
 * 
 * console.log(mixedImport.toString());
 * // import { ApiClient, RequestOptions as Options, ResponseType } from './api/client'
 * ```
 * 
 * @example Using in File generation
 * ```typescript
 * import { File, Import } from '@skmtc/core';
 * 
 * const file = new File({ path: './generated.ts', settings: undefined });
 * 
 * // Add import to file
 * file.imports.set('./types', new Set(['User', 'Product']));
 * 
 * // Or create Import directly for more control
 * const customImport = new Import({
 *   module: './helpers',
 *   importNames: [{ 'validateEmail': 'emailValidator' }]
 * });
 * ```
 */
export class Import {
  /** The module path to import from */
  module: string
  
  /** Array of parsed import names with potential aliases */
  importNames: ImportName[]

  /**
   * Creates a new Import instance.
   * 
   * @param args - Import configuration
   * @param args.module - The module path to import from (e.g., './types', 'react')
   * @param args.importNames - Array of import names, can be strings or alias objects
   * 
   * @example
   * ```typescript
   * const importStatement = new Import({
   *   module: './models/User',
   *   importNames: [
   *     'User',                           // Simple import
   *     { 'UserType': 'IUser' },         // Aliased import 
   *     'createUser'                     // Another simple import
   *   ]
   * });
   * ```
   */
  constructor({ module, importNames }: ConstructorArgs) {
    this.module = module
    this.importNames = importNames.map(importName => new ImportName(importName))
  }

  /**
   * Converts the import to a record format.
   * 
   * This method creates a record representation where the module path is the key
   * and the import names are the value. Useful for serialization or when working
   * with import maps.
   * 
   * @returns A record with module as key and import names as value
   * 
   * @example
   * ```typescript
   * const importStatement = new Import({
   *   module: './types',
   *   importNames: ['User', { 'Product': 'IProduct' }]
   * });
   * 
   * const record = importStatement.toRecord();
   * console.log(record);
   * // {
   * //   './types': ['User', { 'Product': 'IProduct' }]
   * // }
   * ```
   */
  toRecord(): Record<string, ImportNameArg[]> {
    return {
      [this.module]: this.importNames.map(({ name, alias }) =>
        alias ? { [name]: alias } : name
      )
    }
  }

  /**
   * Generates the TypeScript import statement string.
   * 
   * This method produces a properly formatted ES6 import statement that can be
   * written directly to a TypeScript file. It handles both simple and aliased
   * imports correctly.
   * 
   * @returns The formatted import statement string
   * 
   * @example
   * ```typescript
   * const basicImport = new Import({
   *   module: './utils',
   *   importNames: ['formatDate', 'parseJson']
   * });
   * 
   * console.log(basicImport.toString());
   * // import { formatDate, parseJson } from './utils'
   * 
   * const aliasedImport = new Import({
   *   module: 'lodash',
   *   importNames: [{ 'isEqual': 'deepEqual' }, 'cloneDeep']
   * });
   * 
   * console.log(aliasedImport.toString());
   * // import { isEqual as deepEqual, cloneDeep } from 'lodash'
   * ```
   * 
   * @todo Move syntax to typescript package to enable language-agnostic use
   */
  toString(): string {
    // @TODO move syntax to typescript package to enable
    // language agnostic use
    return `import { ${this.importNames.join(', ')} } from '${this.module}'`
  }
}

/**
 * Argument type for import names - can be a simple string or an alias object.
 * 
 * @example String import
 * ```typescript
 * const simpleImport: ImportNameArg = 'User';
 * ```
 * 
 * @example Aliased import
 * ```typescript
 * const aliasedImport: ImportNameArg = { 'User': 'IUser' };
 * // This creates: User as IUser
 * ```
 */
export type ImportNameArg = string | { [name: string]: string }

/**
 * Represents a single import name with optional aliasing.
 * 
 * This class handles the parsing and formatting of individual import specifiers,
 * supporting both simple imports and aliased imports. It's used internally by
 * the {@link Import} class to manage import statement components.
 * 
 * @example Simple import name
 * ```typescript
 * const simple = new ImportName('useState');
 * console.log(simple.toString()); // 'useState'
 * ```
 * 
 * @example Aliased import name
 * ```typescript
 * const aliased = new ImportName({ 'React': 'ReactLib' });
 * console.log(aliased.toString()); // 'React as ReactLib'
 * ```
 */
export class ImportName {
  /** The original name being imported */
  name: string
  
  /** The alias to use (if any) */
  alias?: string

  /**
   * Creates a new ImportName instance.
   * 
   * @param name - Either a string for simple imports or an object for aliased imports
   * 
   * @example Simple import
   * ```typescript
   * const importName = new ImportName('User');
   * // Results in: User
   * ```
   * 
   * @example Aliased import
   * ```typescript
   * const importName = new ImportName({ 'UserInterface': 'IUser' });
   * // Results in: UserInterface as IUser
   * ```
   */
  constructor(name: ImportNameArg) {
    if (typeof name === 'string') {
      this.name = name
    } else {
      const [n, alias] = Object.entries(name)[0]

      this.name = n
      this.alias = alias
    }
  }

  /**
   * Generates the string representation of the import name.
   * 
   * This method creates the appropriate import specifier syntax,
   * either a simple name or an aliased import using TypeScript's
   * 'as' keyword.
   * 
   * @returns The formatted import specifier string
   * 
   * @example Simple import
   * ```typescript
   * const simple = new ImportName('useState');
   * console.log(simple.toString()); // 'useState'
   * ```
   * 
   * @example Aliased import
   * ```typescript
   * const aliased = new ImportName({ 'Component': 'ReactComponent' });
   * console.log(aliased.toString()); // 'Component as ReactComponent'
   * ```
   */
  toString(): string {
    return this.alias ? `${this.name} as ${this.alias}` : this.name
  }
}
