/**
 * Regular expressions built from schema strings, for generated TypeScript.
 *
 * A schema string can hold any character: a property name such as `a.b` or
 * `count()`, or a `pattern` written for another engine's tests. Two separate
 * questions apply, and each has one function:
 *
 * - {@link escapeRegExpText}: turn literal text into a pattern that matches
 *   exactly that text (`a.b` must not match `aXb`).
 * - {@link toRegExpLiteral}: write a pattern into generated code as a
 *   `/…/` literal that the file can parse (a `/` or a line break must not
 *   end it).
 *
 * {@link toAnyStringExceptPattern} builds on the first for "any key except
 * the named ones", which a record beside named properties needs.
 */

/** Characters a pattern reads as syntax; each is escaped with `\`. */
const SYNTAX_CHARACTERS = new Set(['\\', '^', '$', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|', '/'])

/**
 * Line terminators as escapes: a regex literal cannot hold one as is. Each
 * escape matches the same character, with or without the `u` flag.
 */
const LINE_TERMINATOR_ESCAPES = new Map<string, string>([
  ['\n', '\\n'],
  ['\r', '\\r'],
  [String.fromCharCode(0x2028), '\\u2028'],
  [String.fromCharCode(0x2029), '\\u2029']
])

/**
 * A pattern that matches exactly `text`: each syntax character is escaped
 * (`a.b` → `a\.b`), and each line terminator becomes its escape. Only
 * characters that may be escaped under the `u` and `v` flags are escaped, so
 * the result is valid with any flags.
 *
 * @example
 * ```typescript
 * escapeRegExpText('a.b')     // 'a\\.b'
 * escapeRegExpText('count()') // 'count\\(\\)'
 * escapeRegExpText('id')      // 'id'
 * ```
 */
export const escapeRegExpText = (text: string): string =>
  Array.from(text, character => {
    return LINE_TERMINATOR_ESCAPES.get(character) ?? (SYNTAX_CHARACTERS.has(character) ? `\\${character}` : character)
  }).join('')

/** Arguments for {@link toAnyStringExceptPattern}. */
export type ToAnyStringExceptPatternArgs = {
  /** The strings the pattern must not match, as written (they are escaped here). */
  names: string[]
}

/**
 * A pattern that matches any string except the given names, each matched
 * exactly. A record beside named properties uses it as its key: the record
 * then checks only the keys the properties do not name.
 *
 * With no names, every string matches, and the pattern is empty.
 *
 * @example
 * ```typescript
 * toAnyStringExceptPattern({ names: ['id', 'a.b'] }) // '^(?!(?:id|a\\.b)$)'
 * toAnyStringExceptPattern({ names: [] })            // ''
 * ```
 */
export const toAnyStringExceptPattern = ({ names }: ToAnyStringExceptPatternArgs): string =>
  names.length === 0 ? '' : `^(?!(?:${names.map(escapeRegExpText).join('|')})$)`

/**
 * A pattern as a regex literal in generated code: `/source/flags`.
 *
 * The pattern keeps its meaning. Only what would break the literal changes:
 * a `/` outside a character class gains a `\`, and a line terminator becomes
 * its escape (`\n`, `\r`, `\u2028`, `\u2029`). An escaped `\/` stays as it
 * is. An empty pattern renders as `/(?:)/`, since `//` starts a comment.
 *
 * It does not check that the pattern is valid: a pattern written for another
 * engine (`(?i)`) renders, and the generated file then fails to compile.
 * Check patterns where they are read.
 *
 * @example
 * ```typescript
 * toRegExpLiteral('^a/b$')        // '/^a\\/b$/'
 * toRegExpLiteral('^[/]$')        // '/^[/]$/'
 * toRegExpLiteral('^x-', 'u')     // '/^x-/u'
 * toRegExpLiteral('')             // '/(?:)/'
 * ```
 */
export const toRegExpLiteral = (source: string, flags = ''): string => {
  let body = ''
  let inClass = false
  let escaped = false

  for (const character of source) {
    const lineTerminator = LINE_TERMINATOR_ESCAPES.get(character)

    if (lineTerminator !== undefined) {
      // After a `\`, the escape's own `\` is already written.
      body += escaped ? lineTerminator.slice(1) : lineTerminator
      escaped = false
      continue
    }

    if (escaped) {
      escaped = false
    } else if (character === '\\') {
      escaped = true
    } else if (character === '[') {
      inClass = true
    } else if (character === ']') {
      inClass = false
    } else if (character === '/' && !inClass) {
      body += '\\'
    }

    body += character
  }

  return `/${body === '' ? '(?:)' : body}/${flags}`
}
