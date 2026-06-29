import { CodeFileBase, matchDefinitions } from '@skmtc/core'
import type { DefinitionBase, ImportBase, ReExportBase } from '@skmtc/core'
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

  /** Definitions keyed by identifier name (first write wins). */
  definitions: Map<string, DefinitionBase> = new Map()

  constructor({ path, packageName }: GoFileArgs) {
    super({ path })
    this.packageName = packageName
  }

  override addDefinition(definition: DefinitionBase): void {
    if (!this.definitions.has(definition.identifier.name)) {
      this.definitions.set(definition.identifier.name, definition)
    }
  }

  override addImports(_imports: ImportBase[]): void {
    throw new Error('GoFile does not support structured imports yet (spike).')
  }

  override addReExports(_reExports: ReExportBase[]): void {
    throw new Error('GoFile does not support re-exports.')
  }

  override findDefinitions(
    query?: { name?: string; type?: GoEntityType }
  ): DefinitionBase[] | undefined {
    return matchDefinitions(
      [...this.definitions.values()],
      query,
      identifier => (identifier instanceof GoIdentifier ? identifier.type : undefined)
    )
  }

  override toString(): string {
    const definitions = Array.from(this.definitions.values()).map(definition =>
      definition.toString()
    )

    return [`package ${this.packageName}`, ...definitions].join('\n\n')
  }
}
