/**
 * The non-`name` parts of an identifier — everything a projection's
 * `toIdentifierType` derives from the schema (context-aware), bundled so
 * the engine can assemble the full identifier with
 * `lang.toIdentifier({ name, ...identifierType })`.
 *
 * The `type` is the opaque-boundary `string` — the engine never interprets
 * it. Each language's declaration-type vocabulary is a fixed fact of its lang
 * package; a lang veneer tightens `toIdentifierType`'s return to its own
 * `XxIdentifierType` (`type` narrowed to `XxEntityType`), which is assignable
 * back to this shape. Core never models or recovers that vocabulary.
 *
 * Pairs with `toIdentifierName(args) -> string` (the pure, cache-key
 * source): the engine assembles
 * `lang.toIdentifier({ name: P.toIdentifierName(args), ...P.toIdentifierType(coordinate, context) })`.
 */
export type IdentifierType = {
  /** Per-language declaration type — the opaque-boundary `string`. */
  type: string
  /** Optional type annotation, opaque to the engine (lang-interpreted). */
  typeName?: string
  /** Whether the identifier is exported. Defaults to `true`. */
  exported?: boolean
}
