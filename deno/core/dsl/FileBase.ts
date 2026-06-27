import type { Stringable } from '@/dsl/Stringable.ts'

/**
 * The language-neutral coordination surface shared by the engine and
 * every `@skmtc/lang-*` package's concrete file subclass.
 *
 * `FileBase` carries only what is common to *every* file — code or not:
 * its `path`, an optional free-form `custom` content slot, and the
 * `toString()` contract. It holds NO definitions, imports, or dedup
 * policy — those are code-file concerns that live on {@link CodeFileBase}
 * and the language subclass, which is what keeps the engine
 * language-blind.
 *
 * `JsonFile` extends this directly — a JSON file has a `path`, serialises
 * its content in `toString()`, and never touches definitions. (See
 * notes/lang: "JSON is a degenerate language".)
 *
 * Lives in its own leaf module (only a type-only `Stringable` import) so
 * that the file subclasses can import it without forming a value-level
 * import cycle.
 */
export abstract class FileBase {
  /** The file path for this generated file */
  path: string

  /**
   * Optional free-form content. On a code file this is the leading banner
   * (e.g. a codegen header); on an ad-hoc non-code file (Markdown, plain
   * text) it can carry the body. Inert until a concrete subclass renders
   * it in `toString()`. Set through the neutral `register` vocabulary's
   * `custom` field (last write wins).
   */
  custom: Stringable | undefined

  constructor({ path }: { path: string }) {
    this.path = path
  }

  /** Renders the file's complete contents. Implemented by the subclass. */
  abstract toString(): string
}
