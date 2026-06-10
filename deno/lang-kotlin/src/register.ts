import { normalize } from '@std/path/normalize'
import type {
  DefinitionBase,
  GenerateContextType,
  GeneratedValue,
  Identifier
} from '@skmtc/core'
import { KtFile } from './KtFile.ts'
import { KtImport, type KtImportNameArg } from './KtImport.ts'
import { KtDefinition } from './KtDefinition.ts'

/**
 * Kotlin's concise register vocabulary — the generator-facing form.
 *
 * Owned by this package: each language defines its own concise args type
 * exposing only what the language supports. Kotlin has **no re-exports**,
 * so there is deliberately no `reExports` field — a generator trying to
 * register one is a compile-time error, not a runtime no-op (the note-16
 * Go example, realized).
 */
export type KtRegisterArgs = {
  /**
   * Import statements to include, keyed by module: a dotted package
   * (`'kotlinx.serialization'`) for external libraries, or an `@/`-export
   * path for project files.
   */
  imports?: Record<string, KtImportNameArg[]>
  /** Definition objects to include in the destination file. */
  definitions?: (DefinitionBase | undefined)[]
}

/**
 * Kotlin's register function — the single implementation behind
 * {@link KtSnippet.register} and the projection-base veneers.
 *
 * Converts the concise import form into {@link KtImport} objects, creates
 * the destination {@link KtFile} on first write (caller-side creation —
 * the language is right here), and hands pure data to the neutral
 * `context.register`. No `generatorId`, no `Lang` object: the language is
 * this module.
 */
export const register = (
  context: GenerateContextType,
  args: KtRegisterArgs & { destinationPath: string }
): void => {
  const destinationPath = normalize(args.destinationPath)

  if (!context.getFile(destinationPath)) {
    context.addFile(new KtFile({ path: destinationPath, settings: context.settings }))
  }

  context.register({
    imports: Object.entries(args.imports ?? {}).map(([module, names]) =>
      KtImport.fromConcise(module, names)
    ),
    definitions: args.definitions,
    destinationPath
  })
}

/**
 * Arguments for {@link defineAndRegister}.
 */
export type KtDefineAndRegisterArgs<Value extends GeneratedValue> = {
  identifier: Identifier
  value: Value
  destinationPath: string
  noExport?: boolean
}

/**
 * Build a {@link KtDefinition} from `value` and register it at
 * `destinationPath`. The transform-level counterpart of
 * `this.defineAndRegister` — a transform (a closure with no class) imports
 * this directly; the language comes from the import, like everything else.
 *
 * No cache check — callers wrap with `context.findDefinition` first where
 * dedup is wanted (the gen-msw accumulator pattern).
 */
export const defineAndRegister = <Value extends GeneratedValue>(
  context: GenerateContextType,
  { identifier, value, destinationPath, noExport }: KtDefineAndRegisterArgs<Value>
): KtDefinition<Value> => {
  const definition = new KtDefinition({ context, identifier, value, noExport })

  register(context, { definitions: [definition], destinationPath })

  return definition
}
