import type { Modifiers, Stringable } from '@skmtc/core'

/**
 * Kotlin collapses OpenAPI's two axes into one: a property that is
 * optional (absent from the parent's `required`) OR nullable is declared
 * `Type? = null`. This predicate is the single decision point, read by
 * {@link applyModifiers} for the `?` and by the data-class property loop
 * for the ` = null` default — so the two halves cannot drift apart.
 */
export const isNullish = ({ required, nullable }: Modifiers): boolean => {
  return !required || nullable === true
}

/**
 * SLOT(modifiers): the TYPE EXPRESSION is the single owner of Kotlin's
 * `?`. Applied ONCE, at each leaf's render — never while building stored
 * fields, and no other owner: `KtParameterList` has a `nullable` flag
 * that would append a second `?`, so this generator leaves it unset and
 * passes the rendered type through instead. Two owners is how `String??`
 * happens.
 */
export const applyModifiers = (
  value: Stringable,
  modifiers: Modifiers,
): string => {
  return isNullish(modifiers) ? `${value}?` : `${value}`
}
