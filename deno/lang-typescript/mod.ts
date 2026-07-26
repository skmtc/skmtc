/**
 * @module @skmtc/lang-typescript
 *
 * SKMTC language package for **TypeScript** (the anchor language) — where
 * the TypeScript language enters the DSL.
 *
 * Owns everything language-shaped:
 *
 * - The concrete DSL subclasses of `@skmtc/core`'s neutral bases
 *   (`TsFile` → `CodeFileBase`, `TsImport` → `ImportBase`, `TsReExport` →
 *   `ReExportBase`, `TsDefinition` → `DefinitionBase`), each rendering
 *   itself in its own `toString()` — pinned byte-identical to the engine's
 *   legacy rendering by `src/*.test.ts`.
 * - The snippet base ({@link TsSnippet}) — where language enters the class
 *   hierarchy; registering snippets are keyless.
 * - The concise register vocabulary ({@link TsRegisterArgs},
 *   {@link ImportNameArg}) and the register family ({@link register},
 *   {@link defineAndRegister}) — convert locally, ensure the destination
 *   file, hand pure data to the neutral `context.register`.
 * - The projection-base veneers ({@link toModelProjectionBase},
 *   {@link toOasOperationProjectionBase},
 *   {@link toGqlOperationProjectionBase}) — pre-bind `base: TsSnippet` and
 *   add the own-file `register` / cross-file `registerInto` ergonomics.
 * - The {@link typescript} `Lang` object — the engine-facing factories,
 *   read by Drivers off the projection class's inherited static.
 *
 * A generator declares its language through its import graph: it imports
 * its projection-base factory and snippet base from this package; entries
 * carry no `lang`. The TypeScript syntax helpers (`List`, `NextList`,
 * `FunctionParameter`, `PathParams`, `toPathParams`, `toPathTemplate`,
 * `identifiers`, `keyValues`, `withDescription`) and the naming layer
 * (`sanitizePropertyName` for property keys, `sanitizeIdentifier` for
 * binding names) live HERE (moved from core under F5/F6 —
 * see ../../notes/lang/17-naming-layer-and-helpers-move.md).
 */

/** The language id this package targets. */
export const langId = 'typescript' as const

/** File extensions this language package renders. */
export const fileExtensions = ['.ts', '.tsx'] as const

export { typescript } from './src/tsLang.ts'
export { TsSnippet } from './src/TsSnippet.ts'
export {
  register,
  defineAndRegister,
  type TsRegisterArgs,
  type TsDefineAndRegisterArgs
} from './src/register.ts'
export { toTsModelProjectionBase } from './src/toTsModelProjectionBase.ts'
export { toTsOasOperationProjectionBase } from './src/toTsOasOperationProjectionBase.ts'
export { toTsWebhookProjectionBase } from './src/toTsWebhookProjectionBase.ts'
export { toTsGqlOperationProjectionBase } from './src/toTsGqlOperationProjectionBase.ts'
export { ReactRouterPathParams } from './src/ReactRouterPathParams.ts'
export { TsFile, type TsFileArgs } from './src/TsFile.ts'
export { TsDefinition, type TsDefinitionArgs } from './src/TsDefinition.ts'
export { TsImport, type TsImportSpecifier, type ImportNameArg } from './src/TsImport.ts'
export { TsReExport } from './src/TsReExport.ts'
export {
  TsClass,
  TsProperty,
  TsMethod,
  TsConstructor,
  type TsClassArgs,
  type TsClassPropertyArgs,
  type TsMethodArgs,
  type TsConstructorArgs,
  type TsAccessibility
} from './src/TsClass.ts'
export { TsHeritage, type TsHeritageArgs, type TsHeritageSymbol } from './src/TsHeritage.ts'
export { TsIdentifier, type TsIdentifierType, type TsIdentifierArgs } from './src/TsIdentifier.ts'

// TypeScript syntax helpers + naming layer (moved from @skmtc/core — F5/F6)
export * from './src/List.ts'
export { NextList } from './src/NextList.ts'
export * from './src/FunctionParameter.ts'
export * from './src/PathParams.ts'
export * from './src/toPathParams.ts'
export * from './src/toPathTemplate.ts'
export * from './src/identifiers.ts'
export * from './src/keyValues.ts'
export * from './src/withDescription.ts'
export * from './src/sanitizePropertyName.ts'
export * from './src/sanitizeIdentifier.ts'
export {
  createVariable,
  createType,
  createClass,
  createInterface,
  createNamespace,
  toTsKeyword,
  toTsEntityType,
  isTsEntityType,
  isBlockType,
  isTypeOnly,
  type TsEntityType,
  type CreateVariableArgs,
  type CreateTypeArgs,
  type CreateDeclarationArgs
} from './src/createIdentifier.ts'
