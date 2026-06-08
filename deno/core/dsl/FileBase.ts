import type { DefinitionBase } from '@/dsl/Definition.ts'

/**
 * The language-neutral coordination surface shared by the engine and
 * every `@skmtc/lang-*` package's concrete file subclass.
 *
 * The engine (`GenerateContext` and the cross-generator cache) only ever
 * reads this surface — the file's `path` and its `definitions` map. It
 * never reads a file's language-specific output state (imports,
 * re-exports) or its rendered string, which is what keeps the engine
 * language-blind. A language package subclasses `FileBase`, adds its own
 * output state, and implements `toString()` to render itself.
 *
 * `JsonFile` extends this too — a JSON file is a `FileBase` whose
 * `definitions` map stays empty and whose `toString()` serialises its
 * content. (See notes/lang: "JSON is a degenerate language".)
 *
 * Lives in its own leaf module (only a type-only `DefinitionBase` import)
 * so that `File` and `JsonFile` — which both `extends FileBase` — can
 * import it without forming a value-level import cycle through `File.ts`.
 */
export abstract class FileBase {
  /** The file path for this generated file */
  path: string

  /** Map of definition names to their Definition objects */
  definitions: Map<string, DefinitionBase>

  constructor({ path }: { path: string }) {
    this.path = path
    this.definitions = new Map()
  }

  /**
   * Add a definition, deduplicating by identifier name (first write wins).
   *
   * Neutral: the engine's `register` calls this on the abstract base, so
   * it works for every language's file. The dedup-by-name rule is the
   * cross-generator cache's contract, not a language concern.
   */
  addDefinition(definition: DefinitionBase): void {
    if (!this.definitions.has(definition.identifier.name)) {
      this.definitions.set(definition.identifier.name, definition)
    }
  }

  /** Renders the file's complete contents. Implemented by the subclass. */
  abstract toString(): string
}
