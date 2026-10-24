/**
 * Prototype of the composable rendering classes proposed in
 * `notes/maybe/README.md`. Standalone so the types can be checked and the
 * behaviour tested before anything lands in `@skmtc/core`.
 *
 * Absence follows fp-ts, which keeps three ideas apart:
 *
 * - A missing value is `undefined` or `null`, and nothing else
 *   (`O.fromNullable`). `''`, `false`, `0` and `[]` are values and render.
 * - A condition is a boolean you test (`boolean.match`): `Maybe.when`.
 * - An empty value is a Monoid's empty: `[]` for lists (`NEA.fromArray`) and
 *   `''` for text. Asking for a non-empty one is explicit: `Maybe.nonEmpty`
 *   and `Maybe.nonEmptyText`.
 *
 * Presence is decided when a `Maybe` is constructed, except for a `Loop` or
 * `Group` subject, whose emptiness is read at render from its structure.
 * Instances can change until render; during render they are stable. Nothing
 * here renders a child to find out whether it is empty: any other instance is
 * present.
 */

/** Same shape as `Stringable` in `@skmtc/core/dsl/Stringable.ts`. */
export type Stringable = {
  toString: () => string
}

/** A list with at least one item, as fp-ts `NonEmptyArray`. */
export type NonEmpty<T> = readonly [T, ...T[]]

/** Renders `''`. The empty value every other class collapses to. */
export class Nothing implements Stringable {
  toString(): string {
    return ''
  }
}

const isNonEmpty = <T>(items: readonly T[]): items is NonEmpty<T> => items.length > 0

/**
 * Structural emptiness of the composition classes, read at render time from
 * current state. Never calls `toString()` on the value it inspects.
 */
const isEmpty = (value: unknown): boolean =>
  value instanceof Nothing ||
  (value instanceof Maybe && value.isNothing()) ||
  (value instanceof Loop && value.isEmpty()) ||
  (value instanceof Group && isEmpty(value.parts))

/** What `Loop` keeps, as fp-ts `A.compact`: everything except absent items. */
const isPresent = <T>(item: T | undefined | null): item is NonNullable<T> =>
  item !== undefined && item !== null && !isEmpty(item)

/**
 * Renders `value` when `subject` is present, the `otherwise` value when it is
 * absent, and `''` when it is absent with no `otherwise`.
 *
 * - `new Maybe(t)` renders `t` unless it is `undefined` or `null`.
 * - `new Maybe(t, title => new Wrap([...]))` builds the value only when `t`
 *   is present, so an absent value never constructs (and never registers
 *   imports from) the Snippets that would render it.
 * - `new Maybe(anchor, a => link(a), () => plain)` is the two-way form
 *   (fp-ts `O.match`). Only the branch that is needed is built.
 * - The subject can be any type, `unknown` included: once `undefined` and
 *   `null` are removed, every value renders.
 * - A `Loop` or `Group` subject is never absent at construction (the object
 *   exists), so `build` always runs, and `otherwise` runs too because the
 *   subject may still be empty at render. Neither may register anything.
 *
 * `build` and `otherwise` run here, in the constructor, never during render.
 */
export class Maybe<T, U extends Stringable = NonNullable<T>, V extends Stringable = Nothing>
  implements Stringable
{
  subject: T | undefined | null
  value: U | NonNullable<T> | undefined
  fallback: V | undefined

  constructor(
    subject: T | undefined | null,
    build?: (present: NonNullable<T>) => U,
    otherwise?: () => V
  ) {
    this.subject = subject

    if (subject === undefined || subject === null) {
      this.value = undefined
      this.fallback = otherwise?.()
      return
    }

    this.value = build === undefined ? subject : build(subject)
    this.fallback = subject instanceof Loop || subject instanceof Group ? otherwise?.() : undefined
  }

  /** fp-ts `boolean.match`: builds the value when `condition` is true. */
  static when<U extends Stringable, V extends Stringable = Nothing>(
    condition: boolean,
    build: () => U,
    otherwise?: () => V
  ): Maybe<true, U, V> {
    return new Maybe(condition ? true : undefined, build, otherwise)
  }

  /**
   * fp-ts `O.fromPredicate`: builds the value when `value` is present and
   * `predicate` holds. `build` receives the value with `undefined` and `null`
   * removed, which `Maybe.when` cannot do.
   */
  static fromPredicate<T extends Stringable, U extends Stringable, V extends Stringable = Nothing>(
    value: T | undefined | null,
    predicate: (present: T) => boolean,
    build: (present: T) => U,
    otherwise?: () => V
  ): Maybe<T, U, V> {
    return value !== undefined && value !== null && predicate(value)
      ? new Maybe(value, build, otherwise)
      : new Maybe<T, U, V>(undefined, undefined, otherwise)
  }

  /**
   * fp-ts `NEA.fromArray`: builds the value when `items` has at least one
   * item. `build` receives the list typed as non-empty. Without `build`,
   * renders the list itself.
   */
  static nonEmpty<T extends Stringable>(items: readonly T[] | undefined | null): Maybe<NonEmpty<T>>
  static nonEmpty<T, U extends Stringable, V extends Stringable = Nothing>(
    items: readonly T[] | undefined | null,
    build: (present: NonEmpty<T>) => U,
    otherwise?: () => V
  ): Maybe<true, U, V>
  static nonEmpty<T, U extends Stringable, V extends Stringable = Nothing>(
    items: readonly T[] | undefined | null,
    build?: (present: NonEmpty<T>) => U,
    otherwise?: () => V
  ): Maybe<true, U, V> | Maybe<NonEmpty<T>> {
    const present = items !== undefined && items !== null && isNonEmpty(items) ? items : undefined
    if (build === undefined) return new Maybe<NonEmpty<T>>(present)
    return present === undefined
      ? new Maybe<true, U, V>(undefined, undefined, otherwise)
      : new Maybe<true, U, V>(true, () => build(present), otherwise)
  }

  /**
   * Builds the value when `text` is a string other than `''`. Without
   * `build`, renders the text itself.
   */
  static nonEmptyText(text: string | undefined | null): Maybe<string>
  static nonEmptyText<U extends Stringable, V extends Stringable = Nothing>(
    text: string | undefined | null,
    build: (present: string) => U,
    otherwise?: () => V
  ): Maybe<true, U, V>
  static nonEmptyText<U extends Stringable, V extends Stringable = Nothing>(
    text: string | undefined | null,
    build?: (present: string) => U,
    otherwise?: () => V
  ): Maybe<true, U, V> | Maybe<string> {
    const present = text === undefined || text === null || text === '' ? undefined : text
    if (build === undefined) return new Maybe<string>(present)
    return present === undefined
      ? new Maybe<true, U, V>(undefined, undefined, otherwise)
      : new Maybe<true, U, V>(true, () => build(present), otherwise)
  }

  /** True when the present branch does not render. */
  isAbsent(): boolean {
    return this.value === undefined || isEmpty(this.subject) || isEmpty(this.value)
  }

  /** True when nothing renders at all: absent, and no fallback that renders. */
  isNothing(): boolean {
    return this.isAbsent() && (this.fallback === undefined || isEmpty(this.fallback))
  }

  toString(): string {
    return this.isAbsent() ? `${this.fallback ?? ''}` : `${this.value}`
  }
}

export type LoopOptions = {
  separator?: Stringable
}

/**
 * A list: items joined by a separator. Absent items (`undefined`, `null`,
 * `Nothing`, empty `Loop`s, `Maybe`s that are Nothing) are skipped at render.
 * `''` is a value and keeps its separator. No bookends: use `Wrap`. To make an
 * empty list disappear, use it as the subject of a `Maybe`.
 */
export class Loop<T extends Stringable = Stringable> implements Stringable {
  items: (T | undefined | null)[]
  separator: Stringable

  constructor(items: (T | undefined | null)[] = [], { separator = ', ' }: LoopOptions = {}) {
    this.items = items
    this.separator = separator
  }

  /** Adds an item after construction, e.g. from an accumulator. */
  add(item: T | undefined | null): this {
    this.items.push(item)
    return this
  }

  isEmpty(): boolean {
    return !this.items.some(isPresent)
  }

  toString(): string {
    return this.items.filter(isPresent).join(`${this.separator}`)
  }
}

/**
 * Concatenates its parts in order, with no separator. Always renders every
 * part: whether a wrapped value appears at all is `Maybe`'s decision.
 */
export class Wrap implements Stringable {
  parts: Stringable[]

  constructor(parts: Stringable[]) {
    this.parts = parts
  }

  toString(): string {
    return this.parts.join('')
  }
}

/**
 * Base for a data class made of optional parts. The subclass keeps its data as
 * named fields (`minLength: Maybe<number, Constraint>`) and lists the ones it
 * renders in `parts`, once, at the end of its constructor. Rendering
 * interpolates `parts`. The framework reads `parts` to tell whether the
 * instance is empty; parents never do. In core this is a slot on `SnippetBase`.
 */
export class Group implements Stringable {
  parts: Stringable = new Nothing()

  toString(): string {
    return `${this.parts}`
  }
}
