import { ReExportBase } from '@skmtc/core'
import type { TsIdentifier } from './TsIdentifier.ts'

/**
 * TypeScript's concrete {@link ReExportBase}: one source module's worth of
 * re-exported symbols, grouped by entity type so the renderer can pick
 * `export type { … }` vs `export { … }`. Owns the TS re-export rendering;
 * its output is identical to the engine's legacy `File` re-export section.
 *
 * The module specifier is stored raw — {@link import('./TsFile.ts').TsFile}
 * re-keys it through package-aware normalisation at render time, the same
 * arrangement step it applies to imports.
 */
export class TsReExport extends ReExportBase {
  module: string
  /** Re-exported names, grouped by entity type (`'variable'` / `'type'`). */
  groups: Record<string, Set<string>>

  constructor(module: string, groups: Record<string, Set<string>>) {
    super()
    this.module = module
    this.groups = groups
  }

  /** Build from the concise `{ module: TsIdentifier[] }` form a generator passes. */
  static fromConcise(module: string, identifiers: TsIdentifier[]): TsReExport {
    const groups: Record<string, Set<string>> = {}
    for (const identifier of identifiers) {
      const kind = identifier.kind
      groups[kind] ??= new Set()
      groups[kind].add(identifier.name)
    }
    return new TsReExport(module, groups)
  }

  override mergeKey(): string {
    return this.module
  }

  override merge(other: ReExportBase): ReExportBase {
    if (!(other instanceof TsReExport)) {
      throw new Error(`Cannot merge a TsReExport with a ${other.constructor.name}`)
    }

    const groups: Record<string, Set<string>> = {}
    for (const source of [this.groups, other.groups]) {
      for (const [entityType, names] of Object.entries(source)) {
        groups[entityType] ??= new Set()
        for (const name of names) groups[entityType].add(name)
      }
    }
    return new TsReExport(this.module, groups)
  }

  /**
   * Render one line per entity-type group — matching the legacy engine's
   * section byte-for-byte (including the doubled space when the keyword
   * slot is empty: `export  { x } from '…'`).
   */
  override toString(): string {
    return Object.entries(this.groups)
      .map(([entityType, names]) => {
        const prefix = entityType === 'type' ? 'type' : ''

        return `export ${prefix} { ${Array.from(names).join(', ')} } from '${this.module}'`
      })
      .join('\n')
  }
}
