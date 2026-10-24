/**
 * Prototype of the four composable rendering classes proposed in
 * `notes/maybe/README.md`. Standalone so the types can be checked and the
 * behaviour tested before anything lands in `@skmtc/core`.
 *
 * Two kinds of absence, checked at different times:
 *
 * - Value absence (`undefined`, `null`, `''`, `false`, `[]`) is checked when
 *   a `Maybe` is constructed. It decides whether `build` or `otherwise` runs.
 * - Structural emptiness (`Nothing`, an empty `Loop`, a `Maybe` that is
 *   Nothing) is checked during render, from each instance's current state.
 *   Instances can change until render; during render they are stable.
 *
 * Nothing here renders a child to find out whether it is empty.
 */

/** Same shape as `Stringable` in `@skmtc/core/dsl/Stringable.ts`. */
export type Stringable = {
  toString: () => string
}

/** Renders `''`. The empty value every other class collapses to. */
export class Nothing implements Stringable {
  toString(): string {
    return ''
  }
}

/** Value absence: decides at construction whether `Maybe` builds its value. */
const isBlank = (value: unknown): boolean =>
  value === '' || value === false || (Array.isArray(value) && value.length === 0)

/**
 * Structural emptiness: read at render time from current state. Never calls
 * `toString()` on the value it inspects.
 */
const isEmpty = (value: unknown): boolean =>
  value instanceof Nothing ||
  (value instanceof Maybe && value.isNothing()) ||
  (value instanceof Loop && value.isEmpty())

const isPresent = <T>(item: T | undefined | null): item is NonNullable<T> =>
  item !== undefined && item !== null && !isBlank(item) && !isEmpty(item)

const isAbsentValue = (value: unknown): value is undefined | null =>
  value === undefined || value === null || isBlank(value)

/**
 * Renders `value` when `subject` is present, the `otherwise` value when it is
 * absent, and `''` when it is absent and there is no `otherwise`.
 *
 * - `new Maybe(t)` renders `t` when present.
 * - `new Maybe(t, title => new Wrap([...]))` builds the value only when `t`
 *   is present, so an absent value never constructs (and never registers
 *   imports from) the Snippets that would render it.
 * - `new Maybe(anchor, a => link(a), () => plain)` is the two-way form
 *   (fp-ts `fold`). Only the branch that is needed is built.
 * - A `Loop` subject is never absent at construction (the object exists), so
 *   `build` always runs, and `otherwise` runs too because the Loop may still
 *   be empty at render. Neither may register anything.
 *
 * `build` and `otherwise` run here, in the constructor, never during render.
 */
export class Maybe<
  T extends Stringable,
  U extends Stringable = NonNullable<T>,
  V extends Stringable = Nothing
> implements Stringable
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

    if (isAbsentValue(subject)) {
      this.value = undefined
      this.fallback = otherwise?.()
      return
    }

    this.value = build === undefined ? subject : build(subject)
    this.fallback = subject instanceof Loop ? otherwise?.() : undefined
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
 * `''`, `false`, `Nothing`, empty `Loop`s, `Maybe`s that are Nothing) are
 * skipped at render. No bookends and no `skipEmpty`: wrap it in `Wrap` for
 * bookends and in `Maybe` to make an empty list disappear.
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
