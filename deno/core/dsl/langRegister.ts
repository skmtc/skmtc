import type { GenerateContextType, RegisterArgs } from '@/context/generateTypes.ts'
import type { GeneratedValue } from '@/dsl/GeneratedValue.ts'
import type { Identifier } from '@/dsl/Identifier.ts'
import type { DefinitionBase } from '@/dsl/Definition.ts'

/**
 * A node that carries the two things the register helpers need: the
 * generation context and the registering generator's `id`. The engine
 * resolves the language by that `id` (`context.resolveLang`) — the single
 * source of truth — so neither the node nor the `register` call ever holds a
 * `Lang` object or a `createFile` closure. Both the projection bases and
 * `SnippetBase` satisfy it (they derive `generatorId` from `generatorKey`).
 */
export type LangAware = {
  context: GenerateContextType
  generatorId: string
}

/**
 * Register a concise, generator-facing call (`{ 'zod': ['z'] }`) into the
 * file at `destinationPath`.
 *
 * Resolves the language by `generatorId`, converts the concise import form
 * into standardised {@link import('@/dsl/ImportBase.ts').ImportBase} objects
 * via `lang.toImports`, then hands the neutral result to the agnostic
 * `context.register` — passing only `generatorId`, never `createFile`. Shared
 * so the concise→standardised conversion is authored once.
 *
 * (Re-exports are not yet wired through this path — they await `ReExportBase`.)
 */
export const langRegister = (node: LangAware, args: RegisterArgs): void => {
  const lang = node.context.resolveLang(node.generatorId)
  node.context.register({
    imports: lang.toImports(args.imports ?? {}),
    definitions: args.definitions,
    destinationPath: args.destinationPath,
    generatorId: node.generatorId
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
 * Build a `Definition` from a value via the language (resolved by
 * `generatorId`) and register it. No cache check — callers wrap this with
 * `context.findDefinition` first where dedup is wanted.
 */
export const langDefineAndRegister = <V extends GeneratedValue>(
  node: LangAware,
  { identifier, value, destinationPath, noExport }: LangDefineAndRegisterArgs<V>
): DefinitionBase<V> => {
  const lang = node.context.resolveLang(node.generatorId)
  const definition = lang.toDefinition({ context: node.context, identifier, value, noExport })

  node.context.register({
    definitions: [definition],
    destinationPath,
    generatorId: node.generatorId
  })

  return definition
}
