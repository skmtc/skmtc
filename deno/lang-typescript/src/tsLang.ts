import type { Lang } from '@skmtc/core'
import { TsFile } from './TsFile.ts'
import { TsDefinition } from './TsDefinition.ts'
import { TsImport } from './TsImport.ts'

/**
 * The TypeScript {@link Lang} — the object a generator binds to its
 * projection base (`toModelProjectionBase({ lang: typescript })`) and that
 * {@link TypescriptSnippet} carries. The engine reaches TypeScript only
 * through these four neutral factories; it never names `TsFile` /
 * `TsDefinition` / `TsImport` itself.
 */
export const typescript: Lang = {
  createFile: ({ path, settings }) => new TsFile({ path, settings }),

  toDefinition: ({ context, identifier, value, noExport, description }) =>
    new TsDefinition({ context, identifier, value, noExport, description }),

  // Concise generator input (`{ 'zod': ['z'] }`) -> one TsImport per module.
  toImports: imports =>
    Object.entries(imports).map(([module, names]) => TsImport.fromConcise(module, names)),

  // The Driver's cross-file import of a peer Definition's identifier.
  toImport: ({ identifier, module }) => TsImport.fromIdentifier(module, identifier)
}
