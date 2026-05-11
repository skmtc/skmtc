import { List } from '@skmtc/core'
import type { EntityTypeValue } from '@/dsl/EntityType.ts'

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
      [this.module]: this.importNames.map(({ name, alias, type }) => {
        if (type === 'type') {
          // Aliased-record form can't carry the `type` discriminator, so
          // type imports always emit the explicit shape.
          return alias
            ? { name, alias, type: 'type' as const }
            : { name, type: 'type' as const }
        }
        return alias ? { [name]: alias } : name
      })
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
    const importAllAs = this.importNames.find(importName =>
      importName.name === '*'
    )

    const importNames = this.importNames.filter(importName =>
      importName.name !== '*'
    )

    // Statement-level `import type { … }` when there's no namespace
    // and every named import is type-only. Cleaner than `import {
    // type A, type B }`, but the per-name form is equally valid TS,
    // so the only reason to prefer this is readability of the
    // generated output. Mixed lists fall back to per-name `type`
    // prefixes (handled by `ImportName.toString()`).
    if (
      importNames.length > 0 &&
      !importAllAs &&
      importNames.every(n => n.type === 'type')
    ) {
      const namesWithoutTypePrefix = importNames.map(n =>
        n.alias ? `${n.name} as ${n.alias}` : n.name
      )
      // @TODO move syntax to typescript package to enable
      // language agnostic use
      return `import type {${namesWithoutTypePrefix.join(', ')}} from '${this.module}'`
    }

    // Only skip the braces if we have a namespace import and no named imports
    const importObject = importNames.length > 0 || !importAllAs
      ? List.toObject(importNames)
      : undefined
    const importItems = new List([importAllAs, importObject], { separator: ', ', skipEmpty: true })
    // @TODO move syntax to typescript package to enable
    // language agnostic use
    return `import ${importItems} from '${this.module}'`
  }
}

/**
 * Argument type for import names. Three accepted shapes:
 *
 *   1. Bare string — `'User'` → `User`
 *   2. Single-entry record — `{ 'User': 'IUser' }` → `User as IUser`,
 *      or `{ '*': 'React' }` → `* as React` (namespace import).
 *   3. Explicit object — `{ name, alias?, type? }`. Required when
 *      flagging a name as a type-only import, e.g.
 *      `{ name: 'UseMutationOptions', type: 'type' }` →
 *      `type UseMutationOptions`. Detected by the presence of the
 *      `type` (or `alias`) key, so legacy aliased-record callers are
 *      unaffected.
 *
 * The `type` field uses the same `'variable' | 'type'` discriminator
 * that {@link EntityType} carries, so an {@link Identifier} can hand
 * its `entityType.type` directly to `register({ imports })` via
 * {@link Identifier.toImport}. Omitting `type` (or passing
 * `'variable'`) emits a plain value import.
 *
 * The string form additionally re-parses a `'type '` prefix so that
 * import sets stored as `Set<string>` (the File-level dedup shape)
 * round-trip type-only flags without losing them. `'type Foo'` and
 * `'type Foo as Bar'` reconstruct an `ImportName` with the type
 * marker set.
 *
 * @example Type-only import
 * ```typescript
 * import type { ImportNameArg } from '@skmtc/core'
 *
 * const typeImport: ImportNameArg = {
 *   name: 'UseMutationOptions',
 *   type: 'type'
 * };
 * // → `type UseMutationOptions`
 * ```
 *
 * @example Type-only alias
 * ```typescript
 * const typeAlias: ImportNameArg = {
 *   name: 'User',
 *   alias: 'IUser',
 *   type: 'type'
 * };
 * // → `type User as IUser`
 * ```
 */
export type ImportNameArg =
  | string
  | { [name: string]: string }
  | { name: string; alias?: string; type?: EntityTypeValue }

/**
 * Maps an {@link ImportNameArg} to a discriminated kind so the
 * constructor can `switch` over it exhaustively. Three shapes go in,
 * three tagged variants come out — adding a fourth shape forces a new
 * case at compile time.
 *
 * Field extraction happens here so the tagged variants carry concrete
 * parsed values rather than the original union. That side-steps the
 * structural overlap between `{ [name: string]: string }` and
 * `{ name: string; alias?: string; type?: EntityType }` (which TS
 * can't narrow cleanly) without resorting to `as` casts.
 *
 * The legacy single-entry alias-record form like `{ 'User': 'IUser' }`
 * could in principle collide with the explicit form if a caller writes
 * `{ name: 'X' }` as a record — that'd be treated as alias-record
 * `name → 'X'`. The explicit form is selected only when at least one
 * of `alias` (string) or `type` (EntityTypeValue) is also present,
 * which is the case that actually motivates the explicit form.
 */
type TaggedImportNameArg =
  | { kind: 'string'; value: string }
  | { kind: 'explicit'; name: string; alias: string | undefined; type: EntityTypeValue | undefined }
  | { kind: 'aliasRecord'; name: string; alias: string }

const isEntityTypeValue = (v: unknown): v is EntityTypeValue =>
  v === 'variable' || v === 'type'

const tagImportNameArg = (arg: ImportNameArg): TaggedImportNameArg => {
  if (typeof arg === 'string') {
    return { kind: 'string', value: arg }
  }
  // The remaining ImportNameArg branches share an object shape with
  // structural overlap. Detection works by reading individual fields
  // and narrowing each value with a runtime guard rather than trying
  // to narrow the whole arg.
  const nameField = 'name' in arg ? arg.name : undefined
  const aliasField = 'alias' in arg ? arg.alias : undefined
  const typeField = 'type' in arg ? arg.type : undefined
  const alias = typeof aliasField === 'string' ? aliasField : undefined
  const type = isEntityTypeValue(typeField) ? typeField : undefined
  if (typeof nameField === 'string' && (alias !== undefined || type !== undefined)) {
    return { kind: 'explicit', name: nameField, alias, type }
  }
  // Alias-record fallback: `{ [name]: alias }` is documented as a
  // single-entry record; read the first entry. The value type
  // unions across ImportNameArg branches — narrow with a runtime check.
  const entry = Object.entries(arg)[0]
  if (entry === undefined || typeof entry[1] !== 'string') {
    throw new Error(`Invalid ImportNameArg: ${JSON.stringify(arg)}`)
  }
  return { kind: 'aliasRecord', name: entry[0], alias: entry[1] }
}

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
   * The entity type of the imported symbol, if known. When the discriminator
   * is `'type'` the rendered import gets a `type ` prefix (`type Foo`,
   * `type Foo as Bar`) — valid TS in any named-import list regardless of
   * whether sibling names are values. This avoids TS1484 under
   * `verbatimModuleSyntax: true`.
   *
   * `undefined` (the default for bare-string and alias-record forms)
   * means "no entity-type signal" — rendered as a plain value import.
   * `'variable'` and `undefined` produce identical output; the former
   * is useful when threading {@link Identifier.entityType.type} through
   * without branching at the call site.
   */
  type?: EntityTypeValue

  /**
   * Creates a new ImportName instance.
   *
   * Accepts the three forms documented on {@link ImportNameArg}. The
   * string form re-parses a `'type '` prefix so set-encoded import
   * lists (e.g. `Set<string>` in {@link File.imports}) round-trip the
   * type flag without losing it.
   */
  constructor(name: ImportNameArg) {
    const tagged = tagImportNameArg(name)
    switch (tagged.kind) {
      case 'string': {
        // Bare string is stored verbatim. A round-tripped value like
        // `'type Foo'` (produced by `toString()` when type is 'type')
        // is stored as a single-name literal — it still renders as
        // `import { type Foo }` because that's valid TS syntax. The
        // `type` discriminator is therefore only meaningful on the
        // in-memory ImportName produced by the explicit form; after a
        // `Set<string>` round-trip the cosmetic statement-level
        // `import type { … }` form degrades to per-name `type` keywords.
        this.name = tagged.value
        this.type = undefined
        break
      }
      case 'explicit': {
        // Explicit form. The presence of `type` (or `alias`) is the
        // discriminator from the legacy alias-record form. Callers
        // wanting type-only imports must pass this shape.
        this.name = tagged.name
        this.alias = tagged.alias
        this.type = tagged.type
        break
      }
      case 'aliasRecord': {
        this.name = tagged.name
        this.alias = tagged.alias
        this.type = undefined
        break
      }
      default: {
        const _exhaustive: never = tagged
        throw new Error(`Unhandled ImportNameArg kind: ${JSON.stringify(_exhaustive)}`)
      }
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
    const base = this.alias ? `${this.name} as ${this.alias}` : this.name
    return this.type === 'type' ? `type ${base}` : base
  }
}
