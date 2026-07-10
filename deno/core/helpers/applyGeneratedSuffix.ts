import { extname } from '@std/path/extname'

/**
 * The filename suffix marking a file as engine-owned, applied by the
 * engine when a projection's `toExportPath` result is stored into
 * `ContentSettings` (see `GenerateContext.to*ContentSettings`).
 * Consumers override it per project via
 * `client.json#settings.generatedSuffix`; setting it to `''` disables
 * injection entirely.
 */
export const DEFAULT_GENERATED_SUFFIX = '.generated'

/**
 * Inserts the generated-file suffix into an export path, before the
 * file extension: `@/forms/CreateForm.tsx` →
 * `@/forms/CreateForm.generated.tsx`.
 *
 * Idempotent: a path that already carries the suffix is returned
 * unchanged, so generators that predate central injection (they
 * hardcode `.generated` in `toExportPath`) keep producing byte-identical
 * paths. New generators return suffix-less paths and let the engine
 * inject.
 *
 * Rules:
 * - `suffix === ''` → path returned unchanged (project-level opt-out).
 * - A suffix without a leading dot is normalized to have one, so a
 *   config value of `"gen"` cannot false-positive on names that merely
 *   end in `gen`.
 * - The extension is the final `.`-segment (`extname`): a dotted stem
 *   keeps its dots (`user.model.tsx` → `user.model.generated.tsx`).
 *   Multi-part extensions are not special-cased (`user.d.ts` →
 *   `user.d.generated.ts`) — generated declaration files are rare and
 *   the rule stays predictable.
 * - No extension → the suffix is appended (`Makefile` →
 *   `Makefile.generated`).
 */
export const applyGeneratedSuffix = (path: string, suffix: string): string => {
  if (suffix === '') {
    return path
  }

  const dottedSuffix = suffix.startsWith('.') ? suffix : `.${suffix}`

  const extension = extname(path)

  // A trailing suffix IS the extension for extension-less names that
  // were already suffixed (`Makefile.generated`).
  if (extension === dottedSuffix) {
    return path
  }

  if (extension === '') {
    return `${path}${dottedSuffix}`
  }

  const stem = path.slice(0, -extension.length)

  if (stem.endsWith(dottedSuffix)) {
    return path
  }

  return `${stem}${dottedSuffix}${extension}`
}
