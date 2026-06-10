import type { Lang } from '@skmtc/core'
import { TsFile } from './TsFile.ts'
import { TsDefinition } from './TsDefinition.ts'
import { TsImport } from './TsImport.ts'

/**
 * The TypeScript {@link Lang} — carried as the static `lang` on
 * {@link import('./TsSnippet.ts').TsSnippet} and inherited by every class
 * built on it. Its only consumers are the engine's Drivers, which read it
 * off the projection class (`projection.lang`) ephemerally at each use
 * site. The engine reaches TypeScript only through these neutral
 * factories; it never names `TsFile` / `TsDefinition` / `TsImport` itself.
 */
export const typescript: Lang = {
  createFile: ({ path, settings }) => new TsFile({ path, settings }),

  toDefinition: ({ context, identifier, value, noExport, description }) =>
    new TsDefinition({ context, identifier, value, noExport, description }),

  // The Driver's cross-file import of a peer Definition's identifier.
  toImport: ({ identifier, module }) => TsImport.fromIdentifier(module, identifier)
}
