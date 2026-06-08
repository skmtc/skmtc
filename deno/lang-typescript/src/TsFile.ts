import { FileBase } from '@skmtc/core'
import { TsImport } from './TsImport.ts'

/**
 * TypeScript rendering of a {@link FileBase}.
 *
 * Holds its own import state and renders imports followed by the
 * definitions accumulated in the inherited `definitions` map (now typed
 * against `DefinitionBase`, so it holds `TsDefinition`s). Module-path
 * formatting and re-exports land as the anchor matures.
 */
export class TsFile extends FileBase {
  imports: TsImport[] = []

  addImport(imp: TsImport): void {
    this.imports.push(imp)
  }

  override toString(): string {
    const imports = this.imports.map(imp => imp.toString()).join('\n')

    const definitions = Array.from(this.definitions.values())
      .map(definition => definition.toString())
      .join('\n\n')

    return [imports, definitions].filter(section => section.length > 0).join('\n\n')
  }
}
