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
 * carry no `lang`. Still tracked (see ../../notes/lang/checklist.md):
 * F5/F6 — `Identifier`, `EntityType`, `sanitizePropertyName`, and the
 * `core/typescript/*` syntax helpers still import from `@skmtc/core`.
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
export { TsImport, type TsImportSpecifier, type ImportNameArg } from './src/TsImport.ts'
export { TsReExport } from './src/TsReExport.ts'
export { TsObject, type TsPropertyArgs } from './src/TsObject.ts'
