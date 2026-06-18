import type { Lang, LangKind } from '@/dsl/Lang.ts'

/**
 * The non-`name` parts of an identifier — everything a projection's
 * `toIdentifierType` derives from the schema (context-aware), bundled so
 * the engine can assemble the full identifier with
 * `lang.toIdentifier({ name, ...identifierType })`.
 *
 * Generic over the projection's {@link Lang}: the `kind` is drawn from that
 * language's declaration vocabulary, recovered via {@link LangKind} from the
 * typed `kind` on the {@link import('@/dsl/IdentifierBase.ts').IdentifierBase}
 * subclass the lang produces (`KtEntityKind` for `KtLang`, `TsEntityKind` for
 * the TypeScript `Lang`, …). A bare `Lang` falls back to the loose
 * `kind: string` — the opaque-kind boundary the engine never interprets.
 *
 * This is what lets a language's projection-base veneer parameterize core's
 * config (`ModelProjectionBaseConfig<E, KtLang>`) instead of recasting
 * `toIdentifierType`'s return: the tightening rides the `L` type argument.
 *
 * Pairs with `toIdentifierName(args) -> string` (the pure, cache-key
 * source): the engine assembles
 * `lang.toIdentifier({ name: P.toIdentifierName(args), ...P.toIdentifierType(coordinate, context) })`.
 */
export type IdentifierType<L extends Lang = Lang> = {
  /** Per-language declaration kind — `LangKind<L>`, opaque to the engine. */
  kind: LangKind<L>
  /** Optional type annotation, opaque to the engine (lang-interpreted). */
  typeName?: string
  /** Whether the identifier is exported. Defaults to `true`. */
  exported?: boolean
}
