// @deno-types="npm:@types/babel__helper-validator-identifier@7.15.2"
import {
  isIdentifierName,
  isKeyword,
  isStrictReservedWord
} from 'npm:@babel/helper-validator-identifier@7.27.1'

/**
 * Makes a name safe to emit as a **binding** — `export const <name>`,
 * `export type <name>`, `class <name>`.
 *
 * This is a different question from {@link handleKey} / {@link
 * sanitizePropertyName}, which ask whether a name is safe as an object
 * *property*. `export` is a perfectly good property key, so
 * `isIdentifierName('export')` is `true` — but `export const export = …` is a
 * syntax error. Reserved words therefore have to be checked separately, and
 * against the module rules, where `await`, `yield`, `let` and `static` are
 * reserved too.
 *
 * Two repairs, in order:
 *
 * 1. Anything that is not a valid identifier name loses the offending
 *    characters, and a leading digit (or an empty result) gains a `_`.
 * 2. A reserved word gains a `Value` suffix — the convention already used by
 *    {@link protectedKeywords} for property names (`export` → `exportValue`).
 *
 * A name that is already safe is returned unchanged, so this is safe to apply
 * unconditionally in a projection's `toIdentifierName`.
 *
 * @example
 * ```typescript
 * sanitizeIdentifier('user')     // 'user'
 * sanitizeIdentifier('Export')   // 'Export'  — capitalised, so not reserved
 * sanitizeIdentifier('export')   // 'exportValue'
 * sanitizeIdentifier('await')    // 'awaitValue'
 * sanitizeIdentifier('2fa')      // '_2fa'
 * ```
 */
export const sanitizeIdentifier = (name: string): string => {
  const valid = isIdentifierName(name) ? name : toValidIdentifierName(name)

  // `isKeyword` covers the always-reserved words; `isStrictReservedWord` with
  // `inModule` adds the ones reserved only under strict mode / modules, which
  // is what generated files always are.
  return isKeyword(valid) || isStrictReservedWord(valid, true) ? `${valid}Value` : valid
}

const toValidIdentifierName = (name: string): string => {
  const stripped = name.replace(/[^\p{ID_Continue}$]/gu, '')

  return stripped === '' || /^\d/.test(stripped) ? `_${stripped}` : stripped
}
