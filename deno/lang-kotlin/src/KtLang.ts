import type { Lang } from '@skmtc/core'
import invariant from 'npm:tiny-invariant@1.3.3'
import { KtFile } from './KtFile.ts'
import { KtDefinition } from './KtDefinition.ts'
import { KtImport } from './KtImport.ts'
import { KtIdentifier, isKtIdentifier } from './KtIdentifier.ts'
import { toKtEntityType } from './createIdentifier.ts'

/**
 * The Kotlin {@link Lang} — carried as the static `lang` on
 * {@link import('./KtSnippet.ts').KtSnippet} and inherited by every class
 * built on it. Its only consumers are the engine's Drivers, which read it
 * off the projection class (`projection.lang`) ephemerally at each use
 * site. The engine reaches Kotlin only through these neutral factories;
 * it never names `KtFile` / `KtDefinition` / `KtImport` itself.
 */
export const kotlin: Lang = {
  createFile: ({ path, settings }) => new KtFile({ path, settings }),

  toDefinition: ({ context, identifier, value, noExport, description }) => {
    // The engine holds identifiers as the neutral `IdentifierBase`; this is
    // the one boundary that narrows back to the concrete `KtIdentifier`
    // before handing it on. A foreign identifier is a misconfiguration —
    // failing here, at Generate, keeps the causing generator on the stack
    // instead of surfacing at Render, far from the cause.
    invariant(
      isKtIdentifier(identifier),
      `KtDefinition needs a KtIdentifier to render '${identifier.name}', got a foreign identifier`
    )

    return new KtDefinition({
      context,
      // Kotlin has no definition-level visibility — `noExport` becomes
      // `exported: false` on the identifier, rendered in its head.
      identifier: noExport ? new KtIdentifier({ ...identifier, exported: false }) : identifier,
      value,
      description
    })
  },

  // The Driver's cross-file import of a peer Definition's identifier —
  // `module` is the peer's export path; KtFile resolves it to a package
  // (and suppresses it entirely when same-package) at render.
  toImport: ({ identifier, module }) => KtImport.fromIdentifier(module, identifier),

  // The engine's identifier-assembly seam: `name` from `toIdentifierName`,
  // the rest spread from `toIdentifierType`. Narrows the opaque `type`
  // string to this language's typed `KtEntityType`.
  toIdentifier: ({ name, type, typeName, exported }) =>
    new KtIdentifier({ name, typeName, exported, type: toKtEntityType(type) })
}
