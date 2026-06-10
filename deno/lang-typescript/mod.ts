/**
 * @module @skmtc/lang-typescript
 *
 * SKMTC language package for **TypeScript** (the anchor language).
 *
 * Owns the TypeScript-specific DSL: concrete subclasses of `@skmtc/core`'s
 * neutral bases (`TsFile` → `CodeFileBase`, `TsImport` → `ImportBase`,
 * `TsDefinition` → `DefinitionBase`), each rendering itself in its own
 * `toString()`. The DSL classes are byte-identical to the engine's legacy
 * `File`/`Import`/`Definition` (pinned by `src/*.test.ts`), so moving
 * rendering out of core is lossless.
 *
 * Still to land (see ../../notes/lang/checklist.md):
 *   - `tsLang: Lang` + `TypescriptSnippet` + `toTypescript*ProjectionBase`
 *   - the `register` family (concise → `ImportBase[]` conversion)
 *   - `/oas` and `/gql` subpath entrypoints
 *   - `EntityKind`, `sanitizePropertyName`, the moved `core/typescript/*`.
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
export {
  toModelProjectionBase,
  type TsModelProjectionBaseConfig
} from './src/toModelProjectionBase.ts'
export {
  toOasOperationProjectionBase,
  type TsOasOperationProjectionBaseConfig
} from './src/toOasOperationProjectionBase.ts'
export {
  toGqlOperationProjectionBase,
  type TsGqlOperationProjectionBaseConfig
} from './src/toGqlOperationProjectionBase.ts'
export { ReactRouterPathParams } from './src/ReactRouterPathParams.ts'
export { TsFile, type TsFileArgs } from './src/TsFile.ts'
export { TsDefinition, type TsDefinitionArgs } from './src/TsDefinition.ts'
export { TsImport, type TsImportSpecifier } from './src/TsImport.ts'
export { TsObject, type TsPropertyArgs } from './src/TsObject.ts'
