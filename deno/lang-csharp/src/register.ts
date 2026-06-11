import { normalize } from '@std/path/normalize'
import type {
  DefinitionBase,
  GenerateContextType,
  GeneratedValue,
  Identifier
} from '@skmtc/core'
import { CsFile } from './CsFile.ts'
import { CsImport, type CsImportNameArg } from './CsImport.ts'
import { CsDefinition } from './CsDefinition.ts'

/**
 * C#'s concise register vocabulary — the generator-facing form.
 *
 * Owned by this package: each language defines its own concise args type
 * exposing only what the language supports. C# has **no re-exports**, so
 * there is deliberately no `reExports` field — a generator trying to
 * register one is a compile-time error, not a runtime no-op (the Kotlin
 * precedent, D8).
 */
export type CsRegisterArgs = {
  /**
   * Import statements to include, keyed by module: a dotted namespace
   * (`'System.Text.Json'`) for BCL or external libraries, or an
   * `@/`-export path for project files. The symbol-level names exist at
   * the register boundary (dedup + alias bookkeeping); rendering
   * collapses to namespace-level `using` directives.
   */
  imports?: Record<string, CsImportNameArg[]>
  /** Definition objects to include in the destination file. */
  definitions?: (DefinitionBase | undefined)[]
}

/**
 * C#'s register function — the single implementation behind
 * {@link CsSnippet.register} and the projection-base veneers.
 *
 * Converts the concise import form into {@link CsImport} objects, creates
 * the destination {@link CsFile} on first write (caller-side creation —
 * the language is right here), and hands pure data to the neutral
 * `context.register`. No `generatorId`, no `Lang` object: the language is
 * this module.
 */
export const register = (
  context: GenerateContextType,
  args: CsRegisterArgs & { destinationPath: string }
): void => {
  const destinationPath = normalize(args.destinationPath)

  if (!context.getFile(destinationPath)) {
    context.addFile(new CsFile({ path: destinationPath, settings: context.settings }))
  }

  context.register({
    imports: Object.entries(args.imports ?? {}).map(([module, names]) =>
      CsImport.fromConcise(module, names)
    ),
    definitions: args.definitions,
    destinationPath
  })
}

/**
 * Arguments for {@link defineAndRegister}.
 */
export type CsDefineAndRegisterArgs<Value extends GeneratedValue> = {
  identifier: Identifier
  value: Value
  destinationPath: string
  noExport?: boolean
}

/**
 * Build a {@link CsDefinition} from `value` and register it at
 * `destinationPath`. The transform-level counterpart of
 * `this.defineAndRegister` — a transform (a closure with no class) imports
 * this directly; the language comes from the import, like everything else.
 *
 * No cache check — callers wrap with `context.findDefinition` first where
 * dedup is wanted (the gen-msw accumulator pattern; remember the note-30
 * lesson 4: a `findDefinition` hit with the wrong value type THROWS).
 */
export const defineAndRegister = <Value extends GeneratedValue>(
  context: GenerateContextType,
  { identifier, value, destinationPath, noExport }: CsDefineAndRegisterArgs<Value>
): CsDefinition<Value> => {
  const definition = new CsDefinition({ context, identifier, value, noExport })

  register(context, { definitions: [definition], destinationPath })

  return definition
}
