import { CodeFileBase, matchDefinitions } from '@skmtc/core'
import type { DefinitionBase, ImportBase, PendingDefinition, ReExportBase } from '@skmtc/core'
import { PhpIdentifier } from './PhpIdentifier.ts'
import type { PhpEntityType } from './PhpIdentifier.ts'

/** Constructor arguments for {@link PhpFile}. */
export type PhpFileArgs = {
  path: string
  /** The PSR-4 namespace this file declares (e.g. `App\\Models`). */
  namespace: string
}

/**
 * PHP rendering of a {@link CodeFileBase}.
 *
 * A fourth point on the file-header spectrum (after TS's bare top-level,
 * Go's `package`, and Rust's headerless module): every PHP file opens with
 * `<?php` and a `namespace …;` declaration. The namespace mirrors the
 * directory tree under PSR-4 — for the spike it is supplied as a string;
 * deriving it from `path` is a later concern.
 *
 * Spike scope: owns a name-keyed definition map (first-write-wins); the
 * structured import (`use`) / re-export seams declared by
 * {@link CodeFileBase} are not yet wired (no PHP generator registers
 * imports).
 */
export class PhpFile extends CodeFileBase {
  namespace: string

  /**
   * Definitions keyed by identifier name (first write wins). A model's name
   * holds its pending entry while its projection is constructed, then its
   * Definition ({@link addDefinition}).
   */
  definitions: Map<string, DefinitionBase | PendingDefinition> = new Map()

  constructor({ path, namespace }: PhpFileArgs) {
    super({ path })
    this.namespace = namespace
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
    throw new Error('PhpFile does not support structured imports yet (spike).')
  }

  override addReExports(_reExports: ReExportBase[]): void {
    throw new Error('PhpFile does not support re-exports.')
  }

  override findDefinitions(query?: {
    name?: string
    type?: PhpEntityType
  }): DefinitionBase[] | undefined {
    return matchDefinitions(this.#constructedDefinitions(), query, identifier =>
      identifier instanceof PhpIdentifier ? identifier.type : undefined
    )
  }

  override toString(): string {
    const definitions = this.#constructedDefinitions()
      .map(definition => definition.toString())
      .join('\n\n')

    return `<?php\n\nnamespace ${this.namespace};\n\n${definitions}`
  }
}
