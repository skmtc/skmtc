/**
 * The language-neutral contract for a registered import.
 *
 * A `@skmtc/lang-*` package provides a concrete subclass (`TsImport`,
 * `GoImport`, …) that owns the language's import shape and rendering. The
 * engine and {@link import('@/dsl/CodeFileBase.ts').CodeFileBase} only ever
 * see this neutral surface:
 *
 * - `mergeKey()` — identity for dedup AND the handle a `File` uses to
 *   arrange its import section (typically the module / package path). Two
 *   imports with the same key collapse via {@link merge}.
 * - `merge(other)` — combine a same-key import into this one (e.g. union
 *   their symbols). The subclass narrows `other` to its own type.
 * - `toString()` — render the standalone import. A language `File` MAY
 *   re-arrange instead (e.g. Go groups every package into one
 *   `import ( … )` block keyed by `mergeKey()`), so `toString()` is the
 *   per-import render, not the whole section.
 *
 * The split is deliberate: the *merge* of imports is language-neutral (it
 * lives on `CodeFileBase`); the *arrangement* of the import section is
 * language-specific (it lives in the concrete `File.toString()`).
 */
export abstract class ImportBase {
  /**
   * Identity for dedup and arrangement — typically the module or package
   * path. Imports sharing a `mergeKey()` are merged via {@link merge}; a
   * `File` may also group or sort its imports by this key.
   */
  abstract mergeKey(): string

  /**
   * Combine another import that shares this `mergeKey()` into a single
   * import. The concrete subclass narrows `other` to its own type (and
   * throws if handed a foreign import — which only happens if two languages
   * wrote to one file, a misconfiguration).
   */
  abstract merge(other: ImportBase): ImportBase

  /** Render the standalone import. The `File` may re-arrange via `mergeKey`. */
  abstract toString(): string
}
