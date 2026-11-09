import type { GenerateContextType } from '@skmtc/core'
import { TsSnippet } from './TsSnippet.ts'
import { toRenderedModule } from './toImportModule.ts'

/** Arguments for {@link TsDynamicImport}. */
export type TsDynamicImportArgs = {
  context: GenerateContextType
  /** The module to import: an export path (`@/…`) or a module specifier. */
  module: string
  /** The file the expression is written in. */
  destinationPath: string
}

/**
 * `import('<module>')`: a dynamic import, written where the snippet stands in
 * the code, not in the file's header. The module loads when the expression
 * runs, so the file does not load it at startup. The module text is the text
 * a header import in the same file gets ({@link toRenderedModule}).
 *
 * The file must not also import the module in its header: ES modules load
 * header imports first, so the module would load at startup after all. A
 * type-only header import is fine; it is erased.
 */
export class TsDynamicImport extends TsSnippet {
  /** The module text, as a header import in this file renders it. */
  module: string

  constructor({ context, module, destinationPath }: TsDynamicImportArgs) {
    super({ context })

    this.module = toRenderedModule({ destinationPath, module, packages: context.settings?.packages })
  }

  override toString(): string {
    return `import('${this.module}')`
  }
}
