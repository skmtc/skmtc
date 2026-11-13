import { CodeFileBase, matchDefinitions } from '@skmtc/core'
import type { DefinitionBase, ImportBase, PendingDefinition, ReExportBase } from '@skmtc/core'
import { GoIdentifier } from './GoIdentifier.ts'
import type { GoEntityType } from './GoIdentifier.ts'

/** Constructor arguments for {@link GoFile}. */
export type GoFileArgs = {
  path: string
  /** The `package <name>` directive — required for every Go source file. */
  packageName: string
}

/**
 * Go rendering of a {@link CodeFileBase}.
 *
 * Unlike TypeScript, every Go file opens with a `package <name>`
 * directive — a structural difference the file shell owns. Proves the
 * abstract {@link CodeFileBase} accommodates a language whose file header
 * differs from TS's bare top-level declarations.
 *
 * Spike scope: owns a name-keyed definition map (first-write-wins); the
 * structured import/re-export seams are declared by {@link CodeFileBase}
 * but not yet wired (no Go generator registers imports). `use`-style
 * imports land as the seam matures.
 */
export class GoFile extends CodeFileBase {
  packageName: string

  /**
   * Definitions keyed by identifier name (first write wins). A model's name
   * holds its pending entry while its projection is constructed, then its
   * Definition ({@link addDefinition}).
   */
  definitions: Map<string, DefinitionBase | PendingDefinition> = new Map()

  constructor({ path, packageName }: GoFileArgs) {
    super({ path })
    this.packageName = packageName
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
    throw new Error('GoFile does not support structured imports yet (spike).')
  }

  override addReExports(_reExports: ReExportBase[]): void {
    throw new Error('GoFile does not support re-exports.')
  }

  override findDefinitions(query?: {
    name?: string
    type?: GoEntityType
  }): DefinitionBase[] | undefined {
    return matchDefinitions(this.#constructedDefinitions(), query, identifier =>
      identifier instanceof GoIdentifier ? identifier.type : undefined
    )
  }

  override toString(): string {
    const definitions = this.#constructedDefinitions().map(definition => definition.toString())

    return [`package ${this.packageName}`, ...definitions].join('\n\n')
  }
}
