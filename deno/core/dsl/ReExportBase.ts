/**
 * The language-neutral contract for a registered re-export.
 *
 * A `@skmtc/lang-*` package whose language supports re-exports provides a
 * concrete subclass (`TsReExport`, …) that owns the language's re-export
 * shape and rendering; a language without them simply never constructs
 * one (its concise register vocabulary has no `reExports` field, so the
 * absence is compile-time). The engine and
 * {@link import('@/dsl/CodeFileBase.ts').CodeFileBase} only ever see this
 * neutral surface — the same split as
 * {@link import('@/dsl/ImportBase.ts').ImportBase}:
 *
 * - `mergeKey()` — identity for dedup AND the handle a `File` uses to
 *   arrange its re-export section (typically the source module path). Two
 *   re-exports with the same key collapse via {@link merge}.
 * - `merge(other)` — combine a same-key re-export into this one (e.g.
 *   union their symbols). The subclass narrows `other` to its own type.
 * - `toString()` — render the standalone re-export. A language `File` MAY
 *   re-arrange instead, so `toString()` is the per-entry render, not the
 *   whole section.
 *
 * The *merge* of re-exports is language-neutral (it lives on
 * `CodeFileBase`); the *arrangement* of the re-export section is
 * language-specific (it lives in the concrete `File.toString()`).
 */
export abstract class ReExportBase {
  /**
   * Identity for dedup and arrangement — typically the source module
   * path. Re-exports sharing a `mergeKey()` are merged via {@link merge}.
   */
  abstract mergeKey(): string

  /**
   * Combine another re-export that shares this `mergeKey()` into a single
   * entry. The concrete subclass narrows `other` to its own type (and
   * throws if handed a foreign re-export — which only happens if two
   * languages wrote to one file, a misconfiguration).
   */
  abstract merge(other: ReExportBase): ReExportBase

  /** Render the standalone re-export. The `File` may re-arrange via `mergeKey`. */
  abstract toString(): string
}
