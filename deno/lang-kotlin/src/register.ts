import { normalize } from '@std/path/normalize'
import invariant from 'npm:tiny-invariant@1.3.3'
import type { DefinitionBase, GenerateContextType, GeneratedValue, Stringable } from '@skmtc/core'
import { KtFile } from './KtFile.ts'
import { KtImport, type KtImportNameArg } from './KtImport.ts'
import { KtDefinition } from './KtDefinition.ts'
import type { KtIdentifier } from './KtIdentifier.ts'

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
  /**
   * Leading file content, set on the destination file's neutral
   * `custom` slot ({@link FileBase.custom}) and rendered by
   * {@link KtFile} ABOVE the `package` directive — e.g. a
   * generated-file attribution banner (only comments may precede
   * `package`). The same placement `TsFile` gives the slot; the same
   * neutral semantics too — last non-`undefined` write wins.
   */
  custom?: Stringable
}

/**
 * Kotlin's register function — the single implementation behind
 * {@link KtSnippet.register} and the projection-base veneers.
 *
 * Converts the concise import form into {@link KtImport} objects, creates
 * the destination {@link KtFile} on first write (caller-side creation —
 * the language is right here), and hands pure data to the neutral
 * `context.register`. No `generatorId`, no `Lang` object: the language is
 * this module. Throws when the destination file exists but was created by
 * another language — a cross-language collision is a misconfiguration,
 * refused loudly rather than mixing Kotlin content into a foreign file.
 */
export const register = (
  context: GenerateContextType,
  args: KtRegisterArgs & { destinationPath: string }
): void => {
  const destinationPath = normalize(args.destinationPath)

  const file =
    context.getFile(destinationPath) ??
    context.addFile(new KtFile({ path: destinationPath, settings: context.settings }))

  invariant(
    file instanceof KtFile,
    `Cannot register Kotlin content into '${destinationPath}' — the file was created by another language`
  )

  context.register({
    imports: Object.entries(args.imports ?? {}).map(([module, names]) =>
      KtImport.fromConcise(module, names)
    ),
    definitions: args.definitions,
    custom: args.custom,
    destinationPath
  })
}

/**
 * Arguments for {@link defineAndRegister}.
 */
export type KtDefineAndRegisterArgs<Value extends GeneratedValue> = {
  identifier: KtIdentifier
  value: Value
  destinationPath: string
  /**
   * KDoc description rendered above the declaration — wins over the
   * value-carried {@link import('./KtDocumented.ts').KtDocumented}
   * protocol, exactly as on {@link KtDefinition}'s constructor.
   *
   * There is deliberately no `noExport` here: visibility is the
   * identifier's fact — pass `exported: false` to the identifier factory
   * (`createDataClass(name, { exported: false })`) instead.
   */
  description?: string
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
  { identifier, value, destinationPath, description }: KtDefineAndRegisterArgs<Value>
): KtDefinition<Value> => {
  const definition = new KtDefinition({ context, identifier, value, description })

  register(context, { definitions: [definition], destinationPath })

  return definition
}
