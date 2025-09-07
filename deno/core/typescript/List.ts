import type { Stringable } from '../dsl/Stringable.ts'
import { match } from 'ts-pattern'

/** Type alias for object-style lists with curly braces: `{item1, item2}` */
export type ListObject<V extends Stringable> = List<V[], ', ', '{}'>

/** Type alias for line-separated lists without bookends */
export type ListLines<V extends Stringable> = List<V[], '\n', 'none'>

/** Type alias for array-style lists with square brackets: `[item1, item2]` */
export type ListArray<V extends Stringable> = List<V[], ', ', '[]'>

/** Type alias for parameter-style lists with parentheses: `(param1, param2)` */
export type ListParams<V extends Stringable> = List<V[], ', ', '()'>

/** Options for controlling empty list behavior */
export type SkipEmptyOption = { skipEmpty?: boolean }

/**
 * Type alias for creating key-value pair lists.
 * 
 * Creates a List specialized for key-value pairs with colon separator
 * and no bookends (e.g., "key1: value1, key2: value2").
 * 
 * @template Key - Type of the keys (must be stringable)
 * @template Value - Type of the values (must be stringable)
 */
export type ListKeyValue<Key extends Stringable, Value extends Stringable> = List<
  [Key, Value],
  ': ',
  'none'
>

/**
 * Type representing the different bookend styles for lists.
 */
export type BookendsType = '[]' | '{}' | '()' | '<>' | 'none'

type ConstructorOptions<Separator extends string = ', ', Bookends extends BookendsType = 'none'> = {
  separator?: Separator
  bookends?: Bookends
  skipEmpty?: boolean
}

/**
 * Utility type to extract the item type from an array type.
 */
export type ExtractArrayItem<ArrayOf> = ArrayOf extends Array<infer Item> ? Item : never

type ToFilteredKeyValueReturn<Value extends undefined | Stringable | Stringable[] | List> =
  Value extends undefined
    ? undefined
    : List<[string, Stringable | Stringable[] | List], ': ', 'none'>

type ToConditionalReturn<
  Value extends Stringable,
  Condition extends boolean
> = Condition extends true ? List<[Value], ', ', 'none'> : List<never[], ', ', 'none'>

/**
 * A powerful utility class for building formatted lists of stringable items.
 * 
 * The `List` class is a core component of the SKMTC DSL system, providing type-safe
 * construction of formatted lists with customizable separators and bookends. It's
 * extensively used throughout the codebase for generating code constructs like
 * function parameters, object properties, array literals, and more.
 * 
 * ## Type Safety
 * 
 * The class uses TypeScript's generic system to provide compile-time guarantees
 * about the list structure, separator, and bookend styles. This enables rich
 * type inference and helps prevent formatting errors.
 * 
 * ## Common Patterns
 * 
 * - **Objects**: `List.toObject()` creates `{key: value, ...}` structures
 * - **Arrays**: `List.toArray()` creates `[item, item, ...]` structures  
 * - **Parameters**: `List.toParams()` creates `(param, param, ...)` structures
 * - **Lines**: `List.toLines()` creates newline-separated content
 * 
 * @template Values - Array of stringable values
 * @template Separator - String used to separate items
 * @template Bookends - Style of bookends ('[]', '{}', '()', '<>', 'none')
 * 
 * @example Basic usage
 * ```typescript
 * import { List } from '@skmtc/core';
 * 
 * // Create a comma-separated list
 * const items = new List(['apple', 'banana', 'cherry']);
 * console.log(items.toString()); // "apple, banana, cherry"
 * 
 * // Create an array-style list  
 * const array = new List(['a', 'b', 'c'], { bookends: '[]' });
 * console.log(array.toString()); // "[a, b, c]"
 * 
 * // Create an object-style list
 * const obj = new List(['x: 1', 'y: 2'], { bookends: '{}' });
 * console.log(obj.toString()); // "{x: 1, y: 2}"
 * ```
 * 
 * @example Using type aliases
 * ```typescript
 * // Type-safe array construction
 * const params: ListParams<string> = List.toParams(['id', 'name', 'email']);
 * console.log(params.toString()); // "(id, name, email)"
 * 
 * // Object properties with filtering
 * const props = List.toObject(['title', undefined, 'author'], { skipEmpty: true });
 * console.log(props.toString()); // "{title, author}"
 * 
 * // Line-separated content
 * const lines = List.toLines(['import React from "react"', 'import { useState } from "react"']);
 * console.log(lines.toString()); 
 * // import React from "react"
 * // import { useState } from "react"
 * ```
 * 
 * @example Advanced usage with builders
 * ```typescript
 * // Function signature generation
 * const signature = List.toParams([
 *   'id: string',
 *   'options?: RequestOptions',
 *   'callback?: (result: T) => void'
 * ]);
 * 
 * // Interface properties
 * const interfaceProps = List.toObject([
 *   'readonly id: string',
 *   'name: string', 
 *   'createdAt: Date',
 *   'updatedAt?: Date'
 * ]);
 * 
 * console.log(`interface User ${interfaceProps}`);
 * // interface User {readonly id: string, name: string, createdAt: Date, updatedAt?: Date}
 * ```
 */
export class List<
  Values extends Stringable[] = Stringable[],
  Separator extends string = string,
  Bookends extends BookendsType = BookendsType
> {
  /** The array of values in this list */
  values: ExtractArrayItem<Values>[]
  
  /** The separator string used between items */
  separator: Separator
  
  /** The bookend style for wrapping the list */
  bookends: Bookends
  
  /** Whether to skip rendering when the list is empty */
  skipEmpty: boolean
  
  /**
   * Creates a new List instance.
   * 
   * @param values - Array of values (undefined values are automatically filtered out)
   * @param options - Configuration options
   * @param options.separator - String to use between items (default: ', ')
   * @param options.bookends - Style of bookends to wrap the list (default: 'none')  
   * @param options.skipEmpty - Whether to return empty string for empty lists (default: false)
   * 
   * @example
   * ```typescript
   * // Basic list with default comma separator
   * const basic = new List(['a', 'b', 'c']);
   * 
   * // Custom separator and bookends
   * const custom = new List(['x', 'y', 'z'], {
   *   separator: ' | ',
   *   bookends: '[]',
   *   skipEmpty: true
   * });
   * ```
   */
  constructor(
    values: (ExtractArrayItem<Values> | undefined)[],
    { separator, bookends, skipEmpty }: ConstructorOptions<Separator, Bookends> = {}
  ) {
    this.values = values.filter(value => value !== undefined)

    this.separator = separator ?? (', ' as Separator)
    this.bookends = bookends ?? ('none' as Bookends)
    this.skipEmpty = skipEmpty ?? false
  }

  /**
   * Converts the list to its string representation.
   * 
   * Joins all values with the configured separator and wraps with bookends.
   * Returns empty string if skipEmpty is enabled and list is empty.
   * 
   * @returns Formatted string representation of the list
   */
  toString(): string {
    if (this.skipEmpty && this.values.length === 0) {
      return ''
    }

    const joined = this.values.map(value => value.toString()).join(this.separator)

    return match(this.bookends satisfies BookendsType)
      .with('[]', () => `[${joined}]`)
      .with('{}', () => `{${joined}}`)
      .with('()', () => `(${joined})`)
      .with('<>', () => `<${joined}>`)
      .with('none', () => joined)
      .exhaustive()
  }

  /**
   * Create an empty List that will render as an empty string ''
   * @returns List
   */
  static toEmpty = (): List<never, ', ', 'none'> => {
    return new List([], { bookends: 'none' })
  }

  /**
   * Create a List with a single value that will render as `value`
   * @param value
   * @returns List
   */
  static toSingle = (value: Stringable): List<[Stringable], ', ', 'none'> => {
    return new List([value], { bookends: 'none' })
  }

  /**
   * If condition is true, return a List with a single value that will render as `value`.
   * Otherwise, return an empty List that will render as an empty string ''.
   *
   * Useful for conditional rendering. For example, rendering a function arg object when
   * it has at least one property.
   * @param value
   * @param condition
   * @returns List
   */
  static toConditional = <Value extends Stringable, Condition extends boolean>(
    value: Value,
    condition: Condition
  ): ToConditionalReturn<List<[Value], ', ', 'none'>, Condition> => {
    const out = new List([condition ? value : undefined], { bookends: 'none' })

    return out as ToConditionalReturn<List<[Value], ', ', 'none'>, Condition>
  }

  /**
   * Create a record with Stringable values. KeyValue pairs will be joined with `: ` as separator
   * and the resulting List will be wrapped with `{}`
   * @param record
   * @returns `record` with `Stringable` values
   */
  static toRecord = (
    record: Record<string, Stringable | Stringable[] | List>
  ): List<Stringable[], ', ', '{}'> => {
    const entries = Object.entries(record).map(([key, value]) => {
      return List.toKeyValue(key, value)
    })

    return List.toObject(entries)
  }

  /**
   * Create a record with `undefined` or empty array or List values filtered out.
   * @param record
   * @returns `record` with `undefined` values filtered out
   */
  static toFilteredRecord = (
    record: Record<string, undefined | Stringable | Stringable[] | List>
  ): List<Stringable[], ', ', '{}'> => {
    const entries = Object.entries(record).map(([key, value]) => {
      return List.toFilteredKeyValue(key, value)
    })

    return List.toObject(entries)
  }

  /**
   * Join `key` and `value` using `: ` as separator
   * @param key
   * @param value
   * @returns `key` and `value` joined with `: ` as separator
   */
  static toKeyValue = <Value extends Stringable | Stringable[] | List>(
    key: string,
    value: Value
  ): List<[string, Value], ': ', 'none'> => {
    return new List([key, value], { separator: ': ' })
  }

  /**
   * Join `key` and `value` using `.` as separator
   * @param key
   * @param value
   * @returns `key` and `value` joined with `.` as separator
   */
  static toObjectKey = <Value extends Stringable>(
    key: string,
    value: Value
  ): List<[string, Value], '.', 'none'> => {
    return new List<[string, Value], '.', 'none'>([key, value], {
      separator: '.'
    })
  }

  /**
   * Join `values` using `, ` as separator and wrap in `{` and `}`
   * @param values
   * @returns `values` joined with `, ` as separator and wrapped in `{` and `}`
   */
  static toObject = <V extends Stringable>(
    values: (V | undefined)[],
    { skipEmpty }: SkipEmptyOption = {}
  ): ListObject<V> => {
    return new List(values, { bookends: '{}', skipEmpty })
  }

  /**
   * Join `values` using `, ` as separator and wrap in `[` and `]`
   * @param values
   * @returns `values` joined with `, ` as separator and wrapped in `{` and `}`
   */
  static toArray = <V extends Stringable>(values: (V | undefined)[]): ListArray<V> => {
    return new List(values, { bookends: '[]' })
  }

  /**
   * Join `values` using `, ` as separator and wrap in `(` and `)`
   * @param values
   * @returns `values` joined with `, ` as separator and wrapped in `(` and `)`
   */
  static toParams = <V extends Stringable>(values: (V | undefined)[]): ListParams<V> => {
    return new List(values, { bookends: '()' })
  }

  /**
   * Join `values` using `\n` as separator without a wrapper
   * @param values
   * @returns `values` joined with `\n` as separator without a wrapper
   */
  static toLines = <V extends Stringable>(values: (V | undefined)[]): ListLines<V> => {
    return new List(values, { separator: '\n' })
  }

  /**
   * Create a KeyList using the keys of @param record
   * @afdafg
   * @param record
   * @returns KeyList
   */
  static fromKeys = (record: Record<string, Stringable> | undefined): KeyList => {
    return new KeyList(Object.keys(record ?? {}))
  }

  /**
   * Create a EntryList using the entries of @param record
   * @afdafg
   * @param record
   * @returns EntryList
   */
  static fromEntries = <T extends Stringable>(
    record: Record<string, T> | undefined
  ): EntryList<T> => {
    return new EntryList(Object.entries(record ?? {}))
  }

  /**
   * Create a keyValue pair if `value` is not undefined and is not an empty array or List.
   * Return `undefined` otherwise.
   *
   * Useful for filtering out `undefined values from a record.
   * @param key
   * @param value
   * @returns `key` and `value` joined with `: ` as separator if `value` is not undefined and is not an empty array or List. `undefined` otherwise.
   */
  static toFilteredKeyValue = <Value extends undefined | Stringable | Stringable[] | List>(
    key: string,
    value: Value
  ): ToFilteredKeyValueReturn<Value> => {
    const out = List.hasValue(value) ? List.toKeyValue(key, value) : undefined

    return out as ToFilteredKeyValueReturn<Value>
  }

  /**
   * Check if `value` is not undefined and is not an empty array or List.
   * @param value
   * @returns `true` if `value` is not undefined and is not an empty array or List. `false` otherwise.
   */
  static hasValue = (
    value: undefined | Stringable | Stringable[] | List
  ): value is Stringable | Stringable[] | List => {
    if (value === undefined) {
      return false
    }

    if (Array.isArray(value)) {
      return value.length > 0
    }

    if (value instanceof List) {
      return List.hasValue(value.values)
    }

    return true
  }
}

/**
 * Mapping function type for transforming keys into values.
 */
export type KeyMapFn<V extends Stringable> = (key: string, index: number) => V

/**
 * Utility class for working with arrays of string keys.
 * 
 * Provides methods for transforming key arrays into objects and lists
 * with custom mapping functions.
 */
export class KeyList {
  /** Array of string keys */
  keys: string[]

  /**
   * Creates a new KeyList instance.
   * 
   * @param keys - Array of string keys to work with
   */
  constructor(keys: string[]) {
    this.keys = keys
  }

  /**
   * Transforms keys into an object using a mapping function.
   * 
   * @param mapFn - Function to transform each key into a value
   * @param options - Options for handling empty values
   * @returns Object with keys mapped to transformed values
   */
  toObject<V extends Stringable>(
    mapFn: KeyMapFn<V>,
    { skipEmpty }: SkipEmptyOption = {}
  ): ListObject<V> {
    return List.toObject(
      this.keys.map((key, index) => mapFn(key, index)),
      { skipEmpty }
    )
  }

  /**
   * Creates a plain object with keys as both keys and values.
   * 
   * @returns Object where each key maps to itself
   */
  toObjectPlain(): ListObject<string> {
    return List.toObject(this.keys)
  }

  /**
   * Transforms keys into a List using a mapping function.
   * 
   * @param mapFn - Function to transform each key into a value
   * @returns List containing the transformed values
   */
  toLines<V extends Stringable>(mapFn: KeyMapFn<V>): ListLines<V> {
    return List.toLines(this.keys.map((key, index) => mapFn(key, index)))
  }

  /**
   * Creates a List with keys as the values.
   * 
   * @returns List containing the original keys
   */
  toLinesPlain(): ListLines<string> {
    return List.toLines(this.keys)
  }
}

type Entry<T extends Stringable> = [key: string, value: T]

type EntryMapFn<T extends Stringable, V extends Stringable> = (
  entry: Entry<T>,
  index: number
) => V | undefined

export class EntryList<T extends Stringable> {
  entries: Entry<T>[]

  constructor(entries: Entry<T>[]) {
    this.entries = entries
  }

  toObject<V extends Stringable>(mapFn: EntryMapFn<T, V>): ListObject<V> {
    return List.toObject(this.entries.map((entry, index) => mapFn(entry, index)))
  }

  toLines<V extends Stringable>(mapFn: EntryMapFn<T, V>): ListLines<V> {
    return List.toLines(this.entries.map((key, index) => mapFn(key, index)))
  }

  toArray<V extends Stringable>(mapFn: EntryMapFn<T, V>): ListArray<V> {
    return List.toArray(this.entries.map((entry, index) => mapFn(entry, index)))
  }
}
