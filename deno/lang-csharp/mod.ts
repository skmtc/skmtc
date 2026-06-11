/**
 * @module @skmtc/lang-csharp
 *
 * SKMTC language package for **C#** — the third language on the frozen
 * seam (TypeScript, Kotlin, C#).
 *
 * Contents (arc spec: ../../notes/lang/31-csharp-kickoff.md → CS-A
 * binding spec):
 *   - the naming layer: `CsEntityKind` (`record` / `enum` at CS-A) with
 *     spelled-out identifier factories, `sanitizePropertyName` (the `@`
 *     verbatim-identifier escape), `toNamespaceName` (export path →
 *     dotted namespace), enum member naming with full-set dedup
 *   - concrete `CsFile` / `CsImport` / `CsDefinition` subclasses of the
 *     neutral bases in `@skmtc/core` — each renders itself in its own
 *     `toString()`
 *   - the construct helpers: `CsPropertyList` (nominal-record property
 *     members), `CsAttribute`
 *   - the value protocols `CsDefinition` reads off a Definition's value:
 *     `CsAttributed` (class-level attributes), `CsDocumented` (XML-doc
 *     summary), `CsBased` (base-type clause — declared at CS-A, rendered
 *     at CS-B)
 *   - `withDescription` (XML-doc block, XML-escaped in lang)
 *
 * Grammar/policy split: `System.Text.Json` is never named in this
 * package — the lang renders any attribute it is handed; serialization
 * flavor is generator policy (`gen-csharp`'s value files, the
 * Newtonsoft-sibling clone seam).
 *
 * Status: **CS-A in progress.** The write path (`csharp` Lang object,
 * `CsSnippet`, the register functions, `toModelProjectionBase`) lands at
 * CS-A step 3.
 */

/** The language id this package targets. */
export const langId = 'csharp' as const

/** File extensions this language package renders. */
export const fileExtensions = ['.cs'] as const

export {
  createEnum,
  createRecord,
  toCsKeyword,
  type CreateCsIdentifierArgs,
  type CsEntityKind
} from './src/createIdentifier.ts'
export { csHardKeywords, isCsIdentifierName } from './src/hardKeywords.ts'
export { sanitizePropertyName } from './src/sanitizePropertyName.ts'
export { toNamespaceName } from './src/toNamespaceName.ts'
export {
  toCsEnumMemberName,
  toCsEnumMemberNames,
  type CsEnumMember,
  type ToCsEnumMemberNamesArgs
} from './src/toCsEnumMemberName.ts'

export { CsFile, type CsFileArgs } from './src/CsFile.ts'
export {
  CsImport,
  type CsImportNameArg,
  type CsImportSpecifier
} from './src/CsImport.ts'
export { CsDefinition, type CsDefinitionArgs } from './src/CsDefinition.ts'
export { CsPropertyList, type CsPropertyArgs } from './src/CsPropertyList.ts'
export { CsAttribute, isCsAttributed, type CsAttributed } from './src/CsAttribute.ts'
export { isCsDocumented, type CsDocumented } from './src/CsDocumented.ts'
export { isCsBased, type CsBased } from './src/CsBased.ts'
export { withDescription, type WithDescriptionArgs } from './src/withDescription.ts'
