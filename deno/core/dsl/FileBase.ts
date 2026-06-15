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

  /** Map of definition names to their (primary) Definition objects */
  definitions: Map<string, DefinitionBase>

  /**
   * Same-name companion definitions — TypeScript declaration merging, e.g. a
   * `class Foo` and its `export declare namespace Foo`. Kept separately so
   * the name-keyed {@link definitions} map (and the cross-generator cache
   * keyed on it) stays one-definition-per-name; rendered after the primaries.
   */
  mergedDefinitions: DefinitionBase[]

  constructor({ path }: { path: string }) {
    this.path = path
    this.definitions = new Map()
    this.mergedDefinitions = []
  }

  /**
   * Add a definition. The first definition for a name is the primary (held
   * in {@link definitions}, and what the cross-generator cache resolves).
   *
   * Re-adding the *same* definition object is an idempotent no-op. A
   * *different* definition that reuses an existing name is a declaration-
   * merging companion (e.g. a `declare namespace` beside its class), kept in
   * {@link mergedDefinitions} and rendered after the primaries.
   *
   * Neutral: the engine's `register` calls this on the abstract base, so it
   * works for every language's file.
   */
  addDefinition(definition: DefinitionBase): void {
    const name = definition.identifier.name
    const existing = this.definitions.get(name)

    if (existing === undefined) {
      this.definitions.set(name, definition)
      return
    }

    if (existing !== definition && !this.mergedDefinitions.includes(definition)) {
      this.mergedDefinitions.push(definition)
    }
  }

  /** Renders the file's complete contents. Implemented by the subclass. */
  abstract toString(): string
}
