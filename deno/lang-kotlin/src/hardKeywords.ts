/**
 * Kotlin's hard keywords — names that can never be used as identifiers
 * without backtick escaping. Soft keywords (`value`, `data`, `field`,
 * `import`, …) and modifier keywords (`sealed`, `internal`, …) are NOT
 * in this set: they are legal identifiers in Kotlin and need no escape.
 *
 * Source: the Kotlin language spec's "hard keywords" list (pinned in
 * `notes/lang/19-kotlin-architecture.md`).
 */
export const ktHardKeywords: ReadonlySet<string> = new Set([
  'as',
  'break',
  'class',
  'continue',
  'do',
  'else',
  'false',
  'for',
  'fun',
  'if',
  'in',
  'interface',
  'is',
  'null',
  'object',
  'package',
  'return',
  'super',
  'this',
  'throw',
  'true',
  'try',
  'typealias',
  'typeof',
  'val',
  'var',
  'when',
  'while'
])

const ktIdentifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/

/**
 * Whether `name` is a plain (unescaped) Kotlin identifier: a letter or
 * underscore followed by letters, digits, or underscores. Deliberately
 * ASCII-conservative — Kotlin permits unicode letters, but anything
 * outside ASCII gets the backtick treatment from
 * {@link import('./sanitizePropertyName.ts').sanitizePropertyName},
 * which is always safe.
 *
 * Note this is a SYNTAX check only — a hard keyword like `object`
 * matches the regex but still needs escaping. Callers check
 * {@link ktHardKeywords} separately.
 */
export const isKtIdentifierName = (name: string): boolean => {
  return ktIdentifierRegex.test(name)
}
