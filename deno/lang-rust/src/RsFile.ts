import { CodeFileBase, matchDefinitions } from '@skmtc/core'
import type { DefinitionBase, ImportBase, PendingDefinition, ReExportBase } from '@skmtc/core'
import { RsIdentifier } from './RsIdentifier.ts'
import type { RsEntityType } from './RsIdentifier.ts'

/** Constructor arguments for {@link RsFile}. */
export type RsFileArgs = {
  path: string
}

/**
 * Rust rendering of a {@link CodeFileBase}.
 *
 * A third point on the file-header spectrum: TypeScript opens with bare
 * top-level declarations, Go *requires* a `package <name>` directive, and
 * Rust requires **no** header at all — modules come from the directory
 * tree, not an in-file statement.
 *
 * Spike scope: owns a name-keyed definition map (first-write-wins). `use`
 * imports are held as raw paths via {@link addUse}; the structured
 * import/re-export seams declared by {@link CodeFileBase} are not yet wired
 * (no Rust generator registers imports). Structured imports + `pub use`
 * re-exports land as the seam matures.
 */
export class RsFile extends CodeFileBase {
  uses: string[] = []

  /**
   * Definitions keyed by identifier name (first write wins). A model's name
   * holds its pending entry while its projection is constructed, then its
   * Definition ({@link addDefinition}).
   */
  definitions: Map<string, DefinitionBase | PendingDefinition> = new Map()

  constructor({ path }: RsFileArgs) {
    super({ path })
  }

  addUse(path: string): void {
    this.uses.push(path)
  }

  /**
   * The first Definition for a name wins. A model's pending entry takes the
   * name before its projection is constructed, and does not render. The
   * model's Definition then replaces it and moves to the end of the map, so
   * it renders after the models its constructor added.
   */
  override addDefinition(entry: DefinitionBase | PendingDefinition): void {
    const name = entry.identifier.name
    const current = this.definitions.get(name)

    if (current === undefined) {
      this.definitions.set(name, entry)

      return
    }

    // The Driver looks a model up before it marks it pending: a pending entry
    // for a taken name is an engine bug.
    if (entry.isPending()) {
      throw new Error(`'${name}' already has a declaration in '${this.path}'`)
    }

    if (current.isPending()) {
      if (current.generatorKey !== entry.generatorKey) {
        throw new Error(
          `Registered definition mismatch: '${name}' in file '${this.path}'. Pending key '${current.generatorKey}' does not match new key '${entry.generatorKey}'`
        )
      }

      this.definitions.delete(name)
      this.definitions.set(name, entry)
    }
  }

  override removePendingDefinition(pending: PendingDefinition): void {
    if (this.definitions.get(pending.identifier.name) === pending) {
      this.definitions.delete(pending.identifier.name)
    }
  }

  override findPendingDefinitions(name?: string): PendingDefinition[] {
    return [...this.definitions.values()].filter(
      (entry): entry is PendingDefinition =>
        entry.isPending() && (name === undefined || entry.identifier.name === name)
    )
  }

  /** The Definitions in the order they were added, leaving out pending entries. */
  #constructedDefinitions(): DefinitionBase[] {
    return [...this.definitions.values()].filter(
      (entry): entry is DefinitionBase => !entry.isPending()
    )
  }

  override addImports(_imports: ImportBase[]): void {
    throw new Error('RsFile does not support structured imports yet (spike); use addUse.')
  }

  override addReExports(_reExports: ReExportBase[]): void {
    throw new Error('RsFile does not support re-exports yet (spike).')
  }

  override findDefinitions(query?: {
    name?: string
    type?: RsEntityType
  }): DefinitionBase[] | undefined {
    return matchDefinitions(this.#constructedDefinitions(), query, identifier =>
      identifier instanceof RsIdentifier ? identifier.type : undefined
    )
  }

  override toString(): string {
    const uses = this.uses.map(use => `use ${use};`).join('\n')

    const definitions = this.#constructedDefinitions()
      .map(definition => definition.toString())
      .join('\n\n')

    return [uses, definitions].filter(section => section.length > 0).join('\n\n')
  }
}
