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
 *   end it), or throw when the pattern is not valid JavaScript.
 *
 * {@link toAnyStringExceptPattern} builds on the first for "any key except
 * the named ones", which a record beside named properties needs.
 */

import { lineTerminatorEscapes } from '@/src/lineTerminators.ts'

/** Characters a pattern reads as syntax; each is escaped with `\`. */
const SYNTAX_CHARACTERS = new Set(['\\', '^', '$', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|', '/'])

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
    return lineTerminatorEscapes.get(character) ?? (SYNTAX_CHARACTERS.has(character) ? `\\${character}` : character)
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
 * The JavaScript engine writes the literal. `new RegExp(source, flags)`
 * checks the pattern and the flags, and its `toString()` escapes only what
 * would break the literal: a `/` outside a character class, and a line
 * terminator (`\n`, `\r`, `\u2028`, `\u2029`). An empty pattern renders as
 * `/(?:)/`, since `//` starts a comment. So the literal parses wherever the
 * pattern does, and it matches what the pattern matches.
 *
 * The check is the generator's own JavaScript engine. Syntax newer than the
 * consumer's engine or TypeScript target, such as `(?i:a)` modifiers or
 * duplicate named groups, passes here and then fails to parse in the
 * generated file.
 *
 * Throws a `SyntaxError` when the pattern or the flags are not valid
 * JavaScript: a trailing `\`, which would escape the closing `/`; a leading
 * `*`, which would open a block comment; a pattern written for another engine
 * (`(?i)`); or flags such as `'gg'`, `'uv'` or `'g;run()//'`. A generator that
 * reads `pattern` from a schema catches it and leaves that pattern out, or
 * lets that one item fail.
 *
 * @example
 * ```typescript
 * toRegExpLiteral('^a/b$')        // '/^a\\/b$/'
 * toRegExpLiteral('^[/]$')        // '/^[/]$/'
 * toRegExpLiteral('^x-', 'u')     // '/^x-/u'
 * toRegExpLiteral('')             // '/(?:)/'
 * toRegExpLiteral('*x')           // throws SyntaxError
 * ```
 */
export const toRegExpLiteral = (source: string, flags = ''): string => new RegExp(source, flags).toString()
