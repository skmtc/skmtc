/**
 * Represents any object that can be converted to a string representation.
 *
 * The `Stringable` interface is a fundamental type used throughout the SKMTC DSL
 * system to ensure that objects can be converted to strings for code generation.
 * This interface matches JavaScript's built-in `toString()` contract and is used
 * extensively by the {@link List} class and other string-building utilities.
 */
export type Stringable = {
  /** Converts the object to its string representation */
  toString: () => string
}
