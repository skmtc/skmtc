import { csHardKeywords, isCsIdentifierName } from './hardKeywords.ts'

/**
 * Makes a name safe as a C# declaration name.
 *
 * - A plain identifier that is not a reserved keyword → returned as-is.
 * - A reserved keyword (`class`, `object`, …) → `@`-prefixed
 *   (`@class` — the verbatim-identifier escape, C#'s backtick analog).
 *   A `@`-escaped keyword still equals its wire name, so it needs no
 *   `[JsonPropertyName]`.
 * - A digit-leading name that is otherwise identifier-shaped (`1st`) →
 *   `_`-prefixed (`_1st`). Unlike the `@` escape this IS a rename —
 *   `@1st` is not legal C# — so the wire name differs and the generator
 *   pairs it with `[JsonPropertyName]` (which gen-csharp emits whenever
 *   wire ≠ property name anyway, D11).
 * - Anything else (spaces, dots, dashes, non-ASCII — nothing `@` or `_`
 *   can save) → throws. Generators PascalCase wire names before calling
 *   this, so reaching the throw means a naming policy bug, not a schema
 *   problem.
 *
 * Casing is deliberately NOT this function's job: PascalCase conventions
 * (and the `[JsonPropertyName]` rename machinery) are gen-side policy;
 * this function only guarantees the chosen name parses. Returns a plain
 * `string` — C# has no quoted-property fallback.
 */
export const sanitizePropertyName = (propertyName: string): string => {
  if (isCsIdentifierName(propertyName)) {
    return csHardKeywords.has(propertyName) ? `@${propertyName}` : propertyName
  }

  if (/^[0-9]/.test(propertyName) && isCsIdentifierName(`_${propertyName}`)) {
    return `_${propertyName}`
  }

  throw new Error(
    `Property name '${propertyName}' cannot be escaped as a C# identifier — ` +
      `rename it (e.g. PascalCase + [JsonPropertyName]) before registering`
  )
}
