import { CodeFileBase, matchDefinitions } from '@skmtc/core'
import type { DefinitionBase, ImportBase, ReExportBase, Lang, FindDefinitionsQuery } from '@skmtc/core'
import { RsIdentifier } from './RsIdentifier.ts'

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
export class RsFile extends CodeFileBase<Lang<RsIdentifier>> {
  uses: string[] = []

  /** Definitions keyed by identifier name (first write wins). */
  definitions: Map<string, DefinitionBase> = new Map()

  constructor({ path }: RsFileArgs) {
    super({ path })
  }

  addUse(path: string): void {
    this.uses.push(path)
  }

  override addDefinition(definition: DefinitionBase): void {
    if (!this.definitions.has(definition.identifier.name)) {
      this.definitions.set(definition.identifier.name, definition)
    }
  }

  override addImports(_imports: ImportBase[]): void {
    throw new Error('RsFile does not support structured imports yet (spike); use addUse.')
  }

  override addReExports(_reExports: ReExportBase[]): void {
    throw new Error('RsFile does not support re-exports yet (spike).')
  }

  override findDefinitions(
    query?: FindDefinitionsQuery<Lang<RsIdentifier>>
  ): DefinitionBase[] | undefined {
    return matchDefinitions(
      [...this.definitions.values()],
      query,
      identifier => (identifier instanceof RsIdentifier ? identifier.kind : undefined)
    )
  }

  override toString(): string {
    const uses = this.uses.map(use => `use ${use};`).join('\n')

    const definitions = Array.from(this.definitions.values())
      .map(definition => definition.toString())
      .join('\n\n')

    return [uses, definitions].filter(section => section.length > 0).join('\n\n')
  }
}
