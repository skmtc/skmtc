/**
 * @module @skmtc/lang-kotlin
 *
 * The Kotlin target-language layer for SKMTC generators.
 *
 * Status: **production (Phase D + the Kotlin milestone arc complete).**
 * The full register/write path on the frozen language seam: the
 * `kotlin` {@link Lang} object,
 * `KtSnippet` (static `lang`, keyless registers), the register family
 * (`register`/`defineAndRegister` + `KtRegisterArgs` — deliberately no
 * `reExports` field), the projection-base veneers (model + OAS
 * operation), `KtFile` (path-derived `package` directive, sorted imports,
 * same-package suppression), `KtImport` (symbol-level, `as` aliases),
 * `KtDefinition` (exhaustive declaration shells; the `KtAnnotated` /
 * `KtSupertyped` / `KtConstructed` / `KtDocumented` value protocols), the
 * function-signature grammar (`KtFunctionSignature` /
 * `KtFunctionParameter` — interface/class methods incl. KDoc,
 * expression bodies, and parameter defaults), the identifier
 * factories, `sanitizePropertyName`
 * (hard keywords + backticks), and `toPackageName` (segment-validated).
 *
 * Grammar only: serialization flavor (kotlinx annotations) is generator
 * policy — `@skmtc/gen-kotlin` is the proving generator. Architecture
 * spec: `notes/lang/19-kotlin-architecture.md`. Template:
 * `@skmtc/lang-typescript`.
 */

/** The language id this package targets. */
export const langId = 'kotlin' as const

/** File extensions this language package renders. */
export const fileExtensions = ['.kt'] as const

export { KtFile, type KtFileArgs } from './src/KtFile.ts'
export { KtDefinition, type KtDefinitionArgs } from './src/KtDefinition.ts'
export { KtImport, type KtImportNameArg, type KtImportSpecifier } from './src/KtImport.ts'
export {
  KtIdentifier,
  isKtIdentifier,
  type KtIdentifierType,
  type KtIdentifierArgs
} from './src/KtIdentifier.ts'
export { KtParameterList, type KtParameterArgs } from './src/KtParameterList.ts'
export {
  KtFunctionSignature,
  KtFunctionParameter,
  type KtFunctionSignatureArgs,
  type KtFunctionParameterArgs
} from './src/KtFunctionSignature.ts'
export { KtAnnotation, isKtAnnotated, type KtAnnotated } from './src/KtAnnotation.ts'
export { isKtSupertyped, type KtSupertyped } from './src/KtSupertyped.ts'
export { isKtConstructed, type KtConstructed } from './src/KtConstructed.ts'
export { isKtDocumented, type KtDocumented } from './src/KtDocumented.ts'
export { withDescription, type WithDescriptionArgs } from './src/withDescription.ts'
export {
  createClass,
  createDataClass,
  createEnumClass,
  createInterface,
  createSealedInterface,
  createTypeAlias,
  createValue,
  createVerbatim,
  isKtEntityType,
  toKtEntityType,
  type KtEntityType,
  type CreateKtIdentifierArgs,
  type CreateValueArgs
} from './src/createIdentifier.ts'
export { sanitizePropertyName } from './src/sanitizePropertyName.ts'
export { toPackageName } from './src/toPackageName.ts'
export { ktHardKeywords, isKtIdentifierName } from './src/hardKeywords.ts'
export { kotlin } from './src/KtLang.ts'
export { KtSnippet } from './src/KtSnippet.ts'
export {
  register,
  defineAndRegister,
  type KtRegisterArgs,
  type KtDefineAndRegisterArgs
} from './src/register.ts'
export { toKtModelProjectionBase } from './src/toKtModelProjectionBase.ts'
export { toKtOasOperationProjectionBase } from './src/toKtOasOperationProjectionBase.ts'
