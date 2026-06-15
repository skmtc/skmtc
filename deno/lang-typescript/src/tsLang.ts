import type { Lang, GeneratedValue } from '@skmtc/core'
import { TsFile } from './TsFile.ts'
import { TsDefinition } from './TsDefinition.ts'
import { TsImport } from './TsImport.ts'
import { TsIdentifier } from './TsIdentifier.ts'
import { toTsEntityKind } from './createIdentifier.ts'

/**
 * The JSDoc a definition renders above itself, when the Driver doesn't pass
 * one explicitly: a `description` carried on the projection value (an
 * accumulator exposing a resource/class-level doc). Read here so a generator
 * can annotate a definition without a dedicated engine hook.
 */
const toValueDescription = (value: GeneratedValue): string | undefined =>
  value && typeof value === 'object' && 'description' in value && typeof value.description === 'string'
    ? value.description
    : undefined

/**
 * The TypeScript {@link Lang}, specialized to this language's concrete
 * {@link TsIdentifier}. Threaded as the `L` type argument through the
 * projection-base veneers so core's config tightens `toIdentifierType`'s
 * return to {@link import('./TsIdentifier.ts').TsIdentifierType} (the `kind`
 * bound to `TsEntityKind`) with no recast.
 */
export type TsLang = Lang<TsIdentifier>

/**
 * The TypeScript {@link Lang} — carried as the static `lang` on
 * {@link import('./TsSnippet.ts').TsSnippet} and inherited by every class
 * built on it. Its only consumers are the engine's Drivers, which read it
 * off the projection class (`projection.lang`) ephemerally at each use
 * site. The engine reaches TypeScript only through these neutral
 * factories; it never names `TsFile` / `TsDefinition` / `TsImport` itself.
 */
export const typescript: TsLang = {
  createFile: ({ path, settings }) => new TsFile({ path, settings }),

  toDefinition: ({ context, identifier, value, noExport, description }) =>
    new TsDefinition({
      context,
      identifier,
      value,
      noExport,
      description: description ?? toValueDescription(value)
    }),

  // The Driver's cross-file import of a peer Definition's identifier.
  toImport: ({ identifier, module }) => TsImport.fromIdentifier(module, identifier),

  // The engine's identifier-assembly seam: `name` from `toIdentifierName`,
  // the rest spread from `toIdentifierType`. Narrows the opaque `kind`
  // string to this language's typed `TsEntityKind`.
  toIdentifier: ({ name, kind, typeName, exported }) =>
    new TsIdentifier({ name, typeName, exported, kind: toTsEntityKind(kind) })
}
