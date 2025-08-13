import type { Stringable } from '../dsl/Stringable.ts'
import { match } from 'ts-pattern'

export type ListObject<V extends Stringable> = List<V[], ', ', '{}'>
export type ListLines<V extends Stringable> = List<V[], '\n', 'none'>
export type ListArray<V extends Stringable> = List<V[], ', ', '[]'>
export type ListParams<V extends Stringable> = List<V[], ', ', '()'>

export type SkipEmptyOption = { skipEmpty?: boolean }

export type ListKeyValue<Key extends Stringable, Value extends Stringable> = List<
  [Key, Value],
  ': ',
  'none'
>

type BookendsType = '[]' | '{}' | '()' | '<>' | 'none'

type ConstructorOptions<Separator extends string = ', ', Bookends extends BookendsType = 'none'> = {
  separator?: Separator
  bookends?: Bookends
  skipEmpty?: boolean
}

type ExtractArrayItem<ArrayOf> = ArrayOf extends Array<infer Item> ? Item : never

type ToFilteredKeyValueReturn<Value extends undefined | Stringable | Stringable[] | List> =
  Value extends undefined
    ? undefined
    : List<[string, Stringable | Stringable[] | List], ': ', 'none'>

type ToConditionalReturn<
  Value extends Stringable,
  Condition extends boolean
> = Condition extends true ? List<[Value], ', ', 'none'> : List<never[], ', ', 'none'>

export class List<
  Values extends Stringable[] = Stringable[],
  Separator extends string = string,
  Bookends extends BookendsType = BookendsType
> {
  values: ExtractArrayItem<Values>[]
  separator: Separator
  bookends: Bookends
  skipEmpty: boolean
  constructor(
    values: (ExtractArrayItem<Values> | undefined)[],
    { separator, bookends, skipEmpty }: ConstructorOptions<Separator, Bookends> = {}
  ) {
    this.values = values.filter(value => value !== undefined)

    this.separator = separator ?? (', ' as Separator)
    this.bookends = bookends ?? ('none' as Bookends)
    this.skipEmpty = skipEmpty ?? false
  }

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
  ) => {
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

type KeyMapFn<V extends Stringable> = (key: string, index: number) => V

export class KeyList {
  keys: string[]

  constructor(keys: string[]) {
    this.keys = keys
  }

  toObject<V extends Stringable>(
    mapFn: KeyMapFn<V>,
    { skipEmpty }: SkipEmptyOption = {}
  ): ListObject<V> {
    return List.toObject(
      this.keys.map((key, index) => mapFn(key, index)),
      { skipEmpty }
    )
  }

  toObjectPlain(): ListObject<string> {
    return List.toObject(this.keys)
  }

  toLines<V extends Stringable>(mapFn: KeyMapFn<V>): ListLines<V> {
    return List.toLines(this.keys.map((key, index) => mapFn(key, index)))
  }

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
