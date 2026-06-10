import { isKtIdentifierName, ktHardKeywords } from './hardKeywords.ts'

// Characters that are illegal in a Kotlin identifier even INSIDE
// backticks (JVM constraint), plus the backtick itself and newlines.
const unescapableCharacters = /[.;:\\/\[\]<>`\r\n]/

/**
 * Makes a property name safe as a Kotlin declaration name.
 *
 * - A plain identifier that is not a hard keyword → returned as-is.
 * - A hard keyword (`object`, `val`, …) or a syntactically invalid name
 *   (`user name`, `1st`) → backtick-escaped (`` `object` ``).
 * - A name that backticks cannot save (contains `.`, `;`, `:`, `/`,
 *   `\`, `[`, `]`, `<`, `>`, a backtick, or a newline — illegal on the
 *   JVM even escaped) → throws. Generators camelCase wire names before
 *   calling this, so reaching the throw means a naming policy bug, not
 *   a schema problem.
 *
 * Renames are deliberately NOT this function's job: wire-name mismatches
 * are handled gen-side via serialization annotations (`@SerialName`);
 * this function only guarantees the chosen name parses. The two compose
 * — a backticked keyword (`` `object` ``) still equals its wire name, so
 * it needs no annotation.
 *
 * Returns a plain `string` (unlike the TypeScript version's key-value
 * fallback — Kotlin has no quoted-property syntax to fall back to).
 */
export const sanitizePropertyName = (propertyName: string): string => {
  if (isKtIdentifierName(propertyName) && !ktHardKeywords.has(propertyName)) {
    return propertyName
  }

  if (unescapableCharacters.test(propertyName)) {
    throw new Error(
      `Property name '${propertyName}' cannot be escaped as a Kotlin identifier — ` +
        `rename it (e.g. camelCase + @SerialName) before registering`
    )
  }

  return `\`${propertyName}\``
}
