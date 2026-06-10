import { normalize } from '@std/path/normalize'
import type {
  DefinitionBase,
  GenerateContextType,
  GeneratedValue,
  Identifier
} from '@skmtc/core'
import { TsFile } from './TsFile.ts'
import { TsImport, type ImportNameArg } from './TsImport.ts'
import { TsReExport } from './TsReExport.ts'
import { TsDefinition } from './TsDefinition.ts'

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
  reExports?: Record<string, Identifier[]>
  /** Definition objects to include in the destination file. */
  definitions?: (DefinitionBase | undefined)[]
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
    imports: Object.entries(args.imports ?? {}).map(([module, names]) =>
      TsImport.fromConcise(module, names)
    ),
    reExports: Object.entries(args.reExports ?? {})
      .filter(([, identifiers]) => identifiers.length > 0)
      .map(([module, identifiers]) => TsReExport.fromConcise(module, identifiers)),
    definitions: args.definitions,
    destinationPath
  })
}

/**
 * Arguments for {@link defineAndRegister}.
 */
export type TsDefineAndRegisterArgs<Value extends GeneratedValue> = {
  identifier: Identifier
  value: Value
  destinationPath: string
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
  { identifier, value, destinationPath, noExport }: TsDefineAndRegisterArgs<Value>
): TsDefinition<Value> => {
  const definition = new TsDefinition({ context, identifier, value, noExport })

  register(context, { definitions: [definition], destinationPath })

  return definition
}
