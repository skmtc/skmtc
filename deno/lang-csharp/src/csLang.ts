import type { Lang } from '@skmtc/core'
import { CsFile } from './CsFile.ts'
import { CsDefinition } from './CsDefinition.ts'
import { CsImport } from './CsImport.ts'

/**
 * The C# {@link Lang} — carried as the static `lang` on
 * {@link import('./CsSnippet.ts').CsSnippet} and inherited by every class
 * built on it. Its only consumers are the engine's Drivers, which read it
 * off the projection class (`projection.lang`) ephemerally at each use
 * site. The engine reaches C# only through these neutral factories;
 * it never names `CsFile` / `CsDefinition` / `CsImport` itself.
 */
export const csharp: Lang = {
  createFile: ({ path, settings }) => new CsFile({ path, settings }),

  toDefinition: ({ context, identifier, value, noExport, description }) =>
    new CsDefinition({ context, identifier, value, noExport, description }),

  // The Driver's cross-file import of a peer Definition's identifier —
  // `module` is the peer's export path; CsFile resolves it to a namespace
  // (and suppresses it entirely when same-namespace) at render.
  toImport: ({ identifier, module }) => CsImport.fromIdentifier(module, identifier)
}
