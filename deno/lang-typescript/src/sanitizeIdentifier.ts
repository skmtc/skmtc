// @deno-types="npm:@types/babel__helper-validator-identifier@7.15.2"
import {
  isIdentifierName,
  isKeyword,
  isStrictBindReservedWord
} from 'npm:@babel/helper-validator-identifier@7.27.1'

/**
 * Makes a name safe to emit as a **JavaScript binding** — `export const
 * <name>`, `class <name>`, `function <name>`.
 *
 * This is a different question from {@link handleKey} / {@link
 * sanitizePropertyName}, which ask whether a name is safe as an object
 * *property*. `export` is a perfectly good property key, so
 * `isIdentifierName('export')` is `true` — but `export const export = …` is a
 * syntax error. Reserved words therefore have to be checked separately, and
 * against the module rules, where `await`, `yield`, `let`, `static`, `eval`
 * and `arguments` are reserved too.
 *
 * Two repairs, in order:
 *
 * 1. Anything that is not a valid identifier name loses the offending
 *    characters, and gains a `_` prefix if what remains still cannot start an
 *    identifier (a leading digit, a combining mark, or nothing at all).
 * 2. A reserved word gains a `Value` suffix — the convention already used by
 *    {@link protectedKeywords} for property names (`export` → `exportValue`).
 *
 * A name that is already safe is returned unchanged, so this is safe to apply
 * unconditionally in a projection's `toIdentifierName`.
 *
 * Two limits worth knowing:
 *
 * - **TypeScript type-alias names are not covered.** TS additionally rejects
 *   its predefined type names there — `type string = number` is TS2457 — and
 *   those are not JavaScript reserved words, so they pass through. Generators
 *   emitting type aliases capitalise (`String` is a legal alias name), so this
 *   has no practical exposure today.
 * - **Sanitizing is lossy, so distinct names can collide.** Schemas named
 *   `export` and `exportValue`, or `user-name` and `username`, both arrive at
 *   one binding. The engine's definition-uniqueness check turns that into a
 *   hard error rather than a silent clobber.
 *
 * @example
 * ```typescript
 * sanitizeIdentifier('user')      // 'user'
 * sanitizeIdentifier('Export')    // 'Export'  — capitalised, so not reserved
 * sanitizeIdentifier('export')    // 'exportValue'
 * sanitizeIdentifier('await')     // 'awaitValue'
 * sanitizeIdentifier('eval')      // 'evalValue'
 * sanitizeIdentifier('2fa')       // '_2fa'
 * ```
 */
export const sanitizeIdentifier = (name: string): string => {
  const valid = isIdentifierName(name) ? name : toValidIdentifierName(name)

  // `isKeyword` covers the always-reserved words. `isStrictBindReservedWord`
  // with `inModule` adds those reserved only under strict mode / modules —
  // which generated files always are — and, unlike `isStrictReservedWord`,
  // includes `eval` and `arguments`, which are illegal as bindings but legal
  // everywhere else.
  return isKeyword(valid) || isStrictBindReservedWord(valid, true) ? `${valid}Value` : valid
}

const toValidIdentifierName = (name: string): string => {
  const stripped = name.replace(/[^\p{ID_Continue}$]/gu, '')

  // Stripping keeps every ID_Continue character, but an identifier's *first*
  // character has to be ID_Start — so a name beginning with a digit or a
  // combining mark survives the strip and is still invalid. Re-asking
  // `isIdentifierName` catches that (and the empty string) rather than
  // enumerating the cases.
  return isIdentifierName(stripped) ? stripped : `_${stripped}`
}
