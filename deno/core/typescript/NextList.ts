import type { Stringable } from '../dsl/Stringable.ts'

/**
 * Internal cleanups (no call-site impact)
  - Single generic V extends Stringable instead of the Values / Separator / Bookends triple.
  Type aliases (NextListObject<V>, NextListArray<V>, etc.) remain for documentation at
  field-declaration sites but all resolve to NextList<V>.
  - toFilteredKeyValue returns an honest NextListKeyValue | undefined. toConditional returns
  NextList<V> either way. No more ToConditionalReturn / ToFilteredKeyValueReturn conditional
  types, no as casts. Complies with the no-as-in-production rule.
  - Exhaustive switch with never default in toString(), matching the codebase convention.

  New capabilities
  - prefix / suffix for asymmetric wrapping; itemPrefix / itemSuffix for per-item indent or
  trailing comma. Covers the gaps bookends couldn't.
  - NextKeyList and NextEntryList are now Stringable — ${keyList} / ${entryList} work directly
  in template literals (sensible defaults: line-separated keys for NextKeyList, key: value
  lines for NextEntryList).

  Safety
  - #values is a private field. Mutation goes through .add(value) / .addAll(iterable), both
  chainable, both filter undefined. The Table.ts:246 pattern (.values.push(...)) becomes
  .add(...) with the same ergonomics, and a future contributor can't quietly mutate from inside
   toString().
  - items() returns a snapshot copy, not the live array. Read-only by construction.
  - size and isEmpty getters for the common length/empty checks.

  Surface stability
  - All static builders kept under their original names (toObject, toArray, toParams, toLines,
  toKeyValue, toRecord, toFilteredRecord, fromKeys, fromEntries, toEmpty, toSingle,
  toConditional, toObjectKey, hasValue, toFilteredKeyValue). A migration from List to NextList
  is a name swap; no signature changes at the call sites.

  Path: /Users/dmitrigrabov/workspace/skmtc-root/skmtc/deno/core/typescript/NextList.ts:1. Not
  exported from mod.ts yet — let me know when you'd like me to wire that up or add tests.
 */

/**
 * Bookend styles supported by `NextList`. For asymmetric or custom wrapping,
 * use the `prefix` / `suffix` options instead.
 */
export type BookendsType = '[]' | '{}' | '()' | 'none'

/**
 * Options accepted by every `NextList` instance.
 *
 * - `separator`   — joins items (default `', '`).
 * - `bookends`    — symmetric wrappers (`[]`, `{}`, `()`, `none`). Default `'none'`.
 * - `prefix`      — inserted once, after the opening bookend and before all items.
 * - `suffix`      — inserted once, after all items and before the closing bookend.
 * - `itemPrefix`  — inserted before every rendered item (per-item indent).
 * - `itemSuffix`  — appended after every rendered item (per-item trailing comma).
 * - `skipEmpty`   — when the list is empty, render as `''` (skipping bookends and fixes).
 */
export type NextListOptions = {
  separator?: string
  bookends?: BookendsType
  prefix?: string
  suffix?: string
  itemPrefix?: string
  itemSuffix?: string
  skipEmpty?: boolean
}

export type SkipEmptyOption = { skipEmpty?: boolean }

/**
 * Convenience aliases. They all resolve to `NextList<V>` — the bookend style is
 * a runtime detail set at construction. Aliases exist only to document intent
 * at field-declaration sites.
 */
export type NextListObject<V extends Stringable = Stringable> = NextList<V>
export type NextListArray<V extends Stringable = Stringable> = NextList<V>
export type NextListParams<V extends Stringable = Stringable> = NextList<V>
export type NextListLines<V extends Stringable = Stringable> = NextList<V>
export type NextListKeyValue = NextList<Stringable>

/**
 * Stringable list builder. Defers `join(separator)` and bookend-wrapping until
 * `toString()` is called, so a `NextList` can be interpolated anywhere a
 * `Stringable` is accepted: `${list}`.
 *
 * Compared to `List`:
 *
 * - Single generic `V` (the item type). No more `Values` / `Separator` /
 *   `Bookends` triple generic.
 * - No conditional return types and no `as` casts in production code. Helpers
 *   that may or may not produce a value return `NextList<V> | undefined`.
 * - The item array is private. Mutation goes through `.add()` / `.addAll()`,
 *   so `toString()` purity can be reasoned about locally.
 * - Asymmetric and per-item fixes: `prefix`, `suffix`, `itemPrefix`,
 *   `itemSuffix`. Covers indented multiline output and trailing-comma styles
 *   that the bookends-only model couldn't reach.
 * - `NextKeyList` / `NextEntryList` implement `toString()`, so they can be
 *   interpolated directly without remembering a terminal method.
 */
export class NextList<V extends Stringable = Stringable> {
  readonly separator: string
  readonly bookends: BookendsType
  readonly prefix: string
  readonly suffix: string
  readonly itemPrefix: string
  readonly itemSuffix: string
  readonly skipEmpty: boolean

  #values: V[]

  constructor(values: (V | undefined)[] = [], options: NextListOptions = {}) {
    this.#values = values.filter((value): value is V => value !== undefined)
    this.separator = options.separator ?? ', '
    this.bookends = options.bookends ?? 'none'
    this.prefix = options.prefix ?? ''
    this.suffix = options.suffix ?? ''
    this.itemPrefix = options.itemPrefix ?? ''
    this.itemSuffix = options.itemSuffix ?? ''
    this.skipEmpty = options.skipEmpty ?? false
  }

  /** Number of items currently in the list. */
  get size(): number {
    return this.#values.length
  }

  /** True when the list has no items. */
  get isEmpty(): boolean {
    return this.#values.length === 0
  }

  /** Snapshot copy of the current items. Read-only — callers must use `.add()` to mutate. */
  items(): ReadonlyArray<V> {
    return [...this.#values]
  }

  /** Append a value if defined. Chainable. */
  add(value: V | undefined): this {
    if (value !== undefined) {
      this.#values.push(value)
    }
    return this
  }

  /** Append all defined values from the given iterable. Chainable. */
  addAll(values: Iterable<V | undefined>): this {
    for (const value of values) {
      if (value !== undefined) {
        this.#values.push(value)
      }
    }
    return this
  }

  /**
   * Render the list. Pure function of the fields set during construction —
   * call as many times as you like, you always get the same string.
   */
  toString(): string {
    if (this.skipEmpty && this.#values.length === 0) {
      return ''
    }

    const wrapped = this.#values.map(
      value => `${this.itemPrefix}${value.toString()}${this.itemSuffix}`
    )
    const body = `${this.prefix}${wrapped.join(this.separator)}${this.suffix}`

    switch (this.bookends) {
      case '[]':
        return `[${body}]`
      case '{}':
        return `{${body}}`
      case '()':
        return `(${body})`
      case 'none':
        return body
      default: {
        const _exhaustive: never = this.bookends
        throw new Error(`Unhandled bookends type: ${String(_exhaustive)}`)
      }
    }
  }

  // ===========================================================================
  // Static builders
  // ===========================================================================

  /** Empty list that renders as `''`. */
  static toEmpty(): NextList {
    return new NextList()
  }

  /** Single-value list that renders as its value. */
  static toSingle<V extends Stringable>(value: V): NextList<V> {
    return new NextList<V>([value])
  }

  /**
   * If `condition` is true, a single-value list. Otherwise an empty list.
   * Both branches return the same type — no conditional types, no casts.
   */
  static toConditional<V extends Stringable>(value: V, condition: boolean): NextList<V> {
    return new NextList<V>(condition ? [value] : [])
  }

  /** `{a, b, c}` */
  static toObject<V extends Stringable>(
    values: (V | undefined)[],
    { skipEmpty }: SkipEmptyOption = {}
  ): NextListObject<V> {
    return new NextList<V>(values, { bookends: '{}', skipEmpty })
  }

  /** `[a, b, c]` */
  static toArray<V extends Stringable>(values: (V | undefined)[]): NextListArray<V> {
    return new NextList<V>(values, { bookends: '[]' })
  }

  /** `(a, b, c)` */
  static toParams<V extends Stringable>(values: (V | undefined)[]): NextListParams<V> {
    return new NextList<V>(values, { bookends: '()' })
  }

  /** `a\nb\nc` */
  static toLines<V extends Stringable>(values: (V | undefined)[]): NextListLines<V> {
    return new NextList<V>(values, { separator: '\n' })
  }

  /** `key: value` */
  static toKeyValue<V extends Stringable>(key: string, value: V): NextListKeyValue {
    return new NextList<Stringable>([key, value], { separator: ': ' })
  }

  /** `key.value` (a dotted member path) */
  static toObjectKey<V extends Stringable>(key: string, value: V): NextListKeyValue {
    return new NextList<Stringable>([key, value], { separator: '.' })
  }

  /** `{k1: v1, k2: v2}` */
  static toRecord(
    record: Record<string, Stringable | Stringable[] | NextList>
  ): NextListObject<NextListKeyValue> {
    const entries = Object.entries(record).map(([key, value]) => toKeyValueOfAny(key, value))
    return NextList.toObject(entries)
  }

  /** `{k1: v1, k2: v2}` with undefined / empty-array / empty-list values dropped. */
  static toFilteredRecord(
    record: Record<string, undefined | Stringable | Stringable[] | NextList>
  ): NextListObject<NextListKeyValue> {
    const entries: NextListKeyValue[] = []
    for (const [key, value] of Object.entries(record)) {
      const entry = NextList.toFilteredKeyValue(key, value)
      if (entry !== undefined) {
        entries.push(entry)
      }
    }
    return NextList.toObject(entries)
  }

  /**
   * Key-value entry when the value is present; `undefined` otherwise.
   *
   * Compared to `List.toFilteredKeyValue`, the return type is an honest
   * union — no conditional types, no `as` cast escape hatch.
   */
  static toFilteredKeyValue(
    key: string,
    value: undefined | Stringable | Stringable[] | NextList
  ): NextListKeyValue | undefined {
    if (!NextList.hasValue(value)) {
      return undefined
    }
    return toKeyValueOfAny(key, value)
  }

  /** True when value is defined and not an empty array / empty NextList. */
  static hasValue(
    value: undefined | Stringable | Stringable[] | NextList
  ): value is Stringable | Stringable[] | NextList {
    if (value === undefined) {
      return false
    }
    if (Array.isArray(value)) {
      return value.length > 0
    }
    if (value instanceof NextList) {
      return value.size > 0
    }
    return true
  }

  /** Wrap the keys of a record for chainable mapping. */
  static fromKeys(record: Record<string, Stringable> | undefined): NextKeyList {
    return new NextKeyList(Object.keys(record ?? {}))
  }

  /** Wrap the entries of a record for chainable mapping. */
  static fromEntries<T extends Stringable>(
    record: Record<string, T> | undefined
  ): NextEntryList<T> {
    return new NextEntryList<T>(Object.entries(record ?? {}))
  }
}

const toKeyValueOfAny = (
  key: string,
  value: Stringable | Stringable[] | NextList
): NextListKeyValue => {
  if (Array.isArray(value)) {
    return NextList.toKeyValue(key, NextList.toArray<Stringable>(value))
  }
  return NextList.toKeyValue(key, value)
}

/**
 * Mapping function for `NextKeyList` — may return `undefined` to drop a key.
 */
export type KeyMapFn<V extends Stringable> = (key: string, index: number) => V | undefined

/**
 * Chainable wrapper around `string[]`. Used to bridge OAS-style
 * `Record<string, _>` shapes into renderable Lists.
 *
 * Itself a `Stringable`: `${keyList}` renders the keys line-by-line.
 */
export class NextKeyList {
  readonly keys: ReadonlyArray<string>

  constructor(keys: ReadonlyArray<string>) {
    this.keys = keys
  }

  get size(): number {
    return this.keys.length
  }

  get isEmpty(): boolean {
    return this.keys.length === 0
  }

  /** Transform keys into a `{k1, k2, …}` list via `mapFn`. */
  toObject<V extends Stringable>(
    mapFn: KeyMapFn<V>,
    { skipEmpty }: SkipEmptyOption = {}
  ): NextListObject<V> {
    return NextList.toObject(
      this.keys.map((key, index) => mapFn(key, index)),
      { skipEmpty }
    )
  }

  /** `{key1, key2, …}` */
  toObjectPlain(): NextListObject<string> {
    return NextList.toObject([...this.keys])
  }

  /** Transform keys into a newline-separated list via `mapFn`. */
  toLines<V extends Stringable>(mapFn: KeyMapFn<V>): NextListLines<V> {
    return NextList.toLines(this.keys.map((key, index) => mapFn(key, index)))
  }

  /** `key1\nkey2\n…` */
  toLinesPlain(): NextListLines<string> {
    return NextList.toLines([...this.keys])
  }

  /**
   * Default Stringable rendering: line-separated keys. Means `${keyList}` works
   * directly in a template literal — no need to remember a terminal method.
   */
  toString(): string {
    return this.toLinesPlain().toString()
  }
}

/** A `[key, value]` pair. */
export type Entry<T extends Stringable> = readonly [key: string, value: T]

/**
 * Mapping function for `NextEntryList` — may return `undefined` to drop an entry.
 */
export type EntryMapFn<T extends Stringable, V extends Stringable> = (
  entry: Entry<T>,
  index: number
) => V | undefined

/**
 * Chainable wrapper around `[key, value][]`. Used to bridge OAS-style
 * `Record<string, OasSchema>` shapes into renderable Lists.
 *
 * Itself a `Stringable`: `${entryList}` renders entries as
 * `key1: value1\nkey2: value2`.
 */
export class NextEntryList<T extends Stringable> {
  readonly entries: ReadonlyArray<Entry<T>>

  constructor(entries: ReadonlyArray<Entry<T>>) {
    this.entries = entries
  }

  get size(): number {
    return this.entries.length
  }

  get isEmpty(): boolean {
    return this.entries.length === 0
  }

  /** `{f(k1, v1), f(k2, v2), …}` */
  toObject<V extends Stringable>(mapFn: EntryMapFn<T, V>): NextListObject<V> {
    return NextList.toObject(this.entries.map((entry, index) => mapFn(entry, index)))
  }

  /** `f(k1, v1)\nf(k2, v2)\n…` */
  toLines<V extends Stringable>(mapFn: EntryMapFn<T, V>): NextListLines<V> {
    return NextList.toLines(this.entries.map((entry, index) => mapFn(entry, index)))
  }

  /** `[f(k1, v1), f(k2, v2), …]` */
  toArray<V extends Stringable>(mapFn: EntryMapFn<T, V>): NextListArray<V> {
    return NextList.toArray(this.entries.map((entry, index) => mapFn(entry, index)))
  }

  /**
   * Default Stringable rendering: each entry as `key: value`, newline-separated.
   * Means `${entryList}` works directly in a template literal.
   */
  toString(): string {
    return NextList.toLines(
      this.entries.map(([key, value]) => NextList.toKeyValue(key, value))
    ).toString()
  }
}
