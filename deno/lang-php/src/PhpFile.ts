import { CodeFileBase, matchDefinitions } from '@skmtc/core'
import type { DefinitionBase, ImportBase, ReExportBase } from '@skmtc/core'
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

  /** Definitions keyed by identifier name (first write wins). */
  definitions: Map<string, DefinitionBase> = new Map()

  constructor({ path, namespace }: PhpFileArgs) {
    super({ path })
    this.namespace = namespace
  }

  override addDefinition(definition: DefinitionBase): void {
    if (!this.definitions.has(definition.identifier.name)) {
      this.definitions.set(definition.identifier.name, definition)
    }
  }

  override addImports(_imports: ImportBase[]): void {
    throw new Error('PhpFile does not support structured imports yet (spike).')
  }

  override addReExports(_reExports: ReExportBase[]): void {
    throw new Error('PhpFile does not support re-exports.')
  }

  override findDefinitions(
    query?: { name?: string; type?: PhpEntityType }
  ): DefinitionBase[] | undefined {
    return matchDefinitions(
      [...this.definitions.values()],
      query,
      identifier => (identifier instanceof PhpIdentifier ? identifier.type : undefined)
    )
  }

  override toString(): string {
    const definitions = Array.from(this.definitions.values())
      .map(definition => definition.toString())
      .join('\n\n')

    return `<?php\n\nnamespace ${this.namespace};\n\n${definitions}`
  }
}
