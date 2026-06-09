import type { GenerateContextType, RegisterArgs } from '@/context/generateTypes.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'

/**
 * A node that carries the two things the register helpers need: the
 * generation context and the target language. The projection bases (core;
 * `lang` injected by the factory) and the per-language snippet bases
 * (`TypescriptSnippet`; `lang = typescript`) both satisfy it.
 */
export type LangAware = {
  context: GenerateContextType
  lang: Lang
}

/**
 * Register a concise, generator-facing call (`{ 'zod': ['z'] }`) into the
 * file at `destinationPath`.
 *
 * Converts the concise import form into the language's standardised
 * {@link import('@/dsl/ImportBase.ts').ImportBase} objects via
 * `lang.toImports`, then hands the neutral result to the agnostic
 * `context.register`. Shared so the concise→standardised conversion is
 * authored once, not copied across the four lang-aware bases.
 *
 * (Re-exports are not yet wired through this path — they await `ReExportBase`;
 * the migration targets do not use them.)
 */
export const langRegister = (node: LangAware, args: RegisterArgs): void => {
  node.context.register({
    imports: node.lang.toImports(args.imports ?? {}),
    definitions: args.definitions,
    destinationPath: args.destinationPath,
    createFile: path => node.lang.createFile({ path, settings: node.context.settings })
  })
}

/**
 * Arguments for {@link langDefineAndRegister}.
 */
export type LangDefineAndRegisterArgs<V extends GeneratedValue> = {
  identifier: Identifier
  value: V
  destinationPath: string
  noExport?: boolean
}

/**
 * Build a `Definition` from a value via the language (`lang.toDefinition`)
 * and register it. No cache check — callers wrap this with
 * `context.findDefinition` first where dedup is wanted.
 */
export const langDefineAndRegister = <V extends GeneratedValue>(
  node: LangAware,
  { identifier, value, destinationPath, noExport }: LangDefineAndRegisterArgs<V>
): DefinitionBase<V> => {
  const definition = node.lang.toDefinition({ context: node.context, identifier, value, noExport })

  node.context.register({
    definitions: [definition],
    destinationPath,
    createFile: path => node.lang.createFile({ path, settings: node.context.settings })
  })

  return definition
}
