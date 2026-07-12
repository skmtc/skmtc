import { normalize } from '@std/path/normalize'
import type { DefinitionBase, GenerateContextType, GeneratedValue, Stringable } from '@skmtc/core'
import { TsFile } from './TsFile.ts'
import { TsImport, type ImportNameArg } from './TsImport.ts'
import { TsReExport } from './TsReExport.ts'
import { TsDefinition } from './TsDefinition.ts'
import type { TsIdentifier } from './TsIdentifier.ts'

/**
 * TypeScript's concise register vocabulary — the generator-facing form.
 *
 * Owned by this package (F10): each language defines its own concise args
 * type exposing only what the language supports, and the neutral
 * `context.register` only ever sees standardised objects. TypeScript
 * supports `reExports`; a language without them omits the field, so the
 * absence is compile-time.
 */
export type TsRegisterArgs = {
  /** Import statements to include, organized by module path. */
  imports?: Record<string, ImportNameArg[]>
  /** Re-export statements to include, organized by source module path. */
  reExports?: Record<string, TsIdentifier[]>
  /** Definition objects to include in the destination file. */
  definitions?: (DefinitionBase | undefined)[]
  /**
   * Free-form content for the destination file's neutral `custom` slot
   * ({@link FileBase.custom}) — typically a leading file banner comment (e.g.
   * a codegen header). Forwarded to `context.register`; the last
   * non-`undefined` write wins.
   */
  custom?: Stringable
}

/**
 * TypeScript's register function — the single implementation behind
 * {@link TsSnippet.register} and the projection-base veneers.
 *
 * Converts the concise import form into {@link TsImport} objects, creates
 * the destination {@link TsFile} on first write (caller-side creation — the
 * language is right here), and hands pure data to the neutral
 * `context.register`. No `generatorId`, no `Lang` object: the language is
 * this module.
 */
export const register = (
  context: GenerateContextType,
  args: TsRegisterArgs & { destinationPath: string }
): void => {
  const destinationPath = normalize(args.destinationPath)

  if (!context.getFile(destinationPath)) {
    context.addFile(new TsFile({ path: destinationPath, settings: context.settings }))
  }

  context.register({
    // Drop self-imports: a symbol exported from the destination file itself is
    // already in scope, so it is never imported. Centralising the same-file
    // check here means callers register against an export path without
    // pre-checking it (compared normalised, since `destinationPath` is too).
    imports: Object.entries(args.imports ?? {})
      .filter(([module]) => normalize(module) !== destinationPath)
      .map(([module, names]) => TsImport.fromConcise(module, names)),
    reExports: Object.entries(args.reExports ?? {})
      .filter(([, identifiers]) => identifiers.length > 0)
      .map(([module, identifiers]) => TsReExport.fromConcise(module, identifiers)),
    definitions: args.definitions,
    custom: args.custom,
    destinationPath
  })
}

/**
 * Arguments for {@link defineAndRegister}.
 */
export type TsDefineAndRegisterArgs<Value extends GeneratedValue> = {
  identifier: TsIdentifier
  value: Value
  destinationPath: string
  /** JSDoc description rendered above the declaration. */
  description?: string
  /** A `//` line comment rendered verbatim above the declaration (see {@link TsDefinition}). */
  leadingComment?: string
  noExport?: boolean
}

/**
 * Build a {@link TsDefinition} from `value` and register it at
 * `destinationPath`. The transform-level counterpart of
 * `this.defineAndRegister` — a transform (a closure with no class) imports
 * this directly; the language comes from the import, like everything else.
 *
 * No cache check — callers wrap with `context.findDefinition` first where
 * dedup is wanted (see the gen-msw accumulator pattern).
 */
export const defineAndRegister = <Value extends GeneratedValue>(
  context: GenerateContextType,
  {
    identifier,
    value,
    destinationPath,
    description,
    leadingComment,
    noExport
  }: TsDefineAndRegisterArgs<Value>
): TsDefinition<Value> => {
  const definition = new TsDefinition({
    context,
    identifier,
    value,
    description,
    leadingComment,
    noExport
  })

  register(context, { definitions: [definition], destinationPath })

  return definition
}
