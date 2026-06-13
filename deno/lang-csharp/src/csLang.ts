import type { Lang } from '@skmtc/core'
import { CsFile } from './CsFile.ts'
import { CsDefinition } from './CsDefinition.ts'
import { CsImport } from './CsImport.ts'
import { CsIdentifier } from './CsIdentifier.ts'
import { toCsEntityKind } from './createIdentifier.ts'

/**
 * The C# {@link Lang}, specialized to this language's concrete
 * {@link CsIdentifier}. Threaded as the `L` type argument through the
 * projection-base veneers so core's config tightens `toIdentifierType`'s
 * return to {@link import('./CsIdentifier.ts').CsIdentifierType} (the `kind`
 * bound to `CsEntityKind`) with no recast.
 */
export type CsLang = Lang<CsIdentifier>

/**
 * The C# {@link Lang} — carried as the static `lang` on
 * {@link import('./CsSnippet.ts').CsSnippet} and inherited by every class
 * built on it. Its only consumers are the engine's Drivers, which read it
 * off the projection class (`projection.lang`) ephemerally at each use
 * site. The engine reaches C# only through these neutral factories;
 * it never names `CsFile` / `CsDefinition` / `CsImport` itself.
 */
export const csharp: CsLang = {
  createFile: ({ path, settings }) => new CsFile({ path, settings }),

  toDefinition: ({ context, identifier, value, noExport, description }) =>
    new CsDefinition({ context, identifier, value, noExport, description }),

  // The Driver's cross-file import of a peer Definition's identifier —
  // `module` is the peer's export path; CsFile resolves it to a namespace
  // (and suppresses it entirely when same-namespace) at render.
  toImport: ({ identifier, module }) => CsImport.fromIdentifier(module, identifier),

  // The engine's identifier-assembly seam: `name` from `toIdentifierName`,
  // the rest spread from `toIdentifierType`. Narrows the opaque `kind`
  // string to this language's typed `CsEntityKind`.
  toIdentifier: ({ name, kind, typeName, exported }) =>
    new CsIdentifier({ name, typeName, exported, kind: toCsEntityKind(kind) })
}
