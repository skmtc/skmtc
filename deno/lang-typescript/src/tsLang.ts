import type { Lang, GeneratedValue } from '@skmtc/core'
import invariant from 'npm:tiny-invariant@1.3.3'
import { TsFile } from './TsFile.ts'
import { TsDefinition } from './TsDefinition.ts'
import { TsImport } from './TsImport.ts'
import { TsIdentifier } from './TsIdentifier.ts'
import { toTsEntityType } from './createIdentifier.ts'

/**
 * The JSDoc a definition renders above itself, when the Driver doesn't pass
 * one explicitly: a `description` carried on the projection value (an
 * accumulator exposing a resource/class-level doc). Read here so a generator
 * can annotate a definition without a dedicated engine hook.
 */
const toValueDescription = (value: GeneratedValue): string | undefined =>
  value &&
  typeof value === 'object' &&
  'description' in value &&
  typeof value.description === 'string'
    ? value.description
    : undefined

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

  toDefinition: ({ context, identifier, value, noExport, description }) => {
    // The engine holds identifiers as the neutral `IdentifierBase`; this is the
    // one boundary that narrows back to the concrete `TsIdentifier` before
    // handing it on (a foreign identifier here is a misconfiguration).
    invariant(
      identifier instanceof TsIdentifier,
      `TsDefinition needs a TsIdentifier to render '${identifier.name}', got a foreign identifier`
    )

    return new TsDefinition({
      context,
      identifier,
      value,
      noExport,
      description: description ?? toValueDescription(value)
    })
  },

  // The Driver's cross-file import of a peer Definition's identifier.
  toImport: ({ identifier, module }) => {
    invariant(
      identifier instanceof TsIdentifier,
      `TsImport needs a TsIdentifier to import '${identifier.name}', got a foreign identifier`
    )

    return TsImport.fromIdentifier(module, identifier)
  },

  // The engine's identifier-assembly seam: `name` from `toIdentifierName`,
  // the rest spread from `toIdentifierType`. Narrows the opaque `type`
  // string to this language's typed `TsEntityType`.
  toIdentifier: ({ name, type, typeName, exported }) =>
    new TsIdentifier({ name, typeName, exported, type: toTsEntityType(type) })
}
