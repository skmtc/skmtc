/**
 * @module @skmtc/lang-kotlin
 *
 * SKMTC language package for **kotlin** (Roadmap).
 *
 * Tests / exercises: top-level fun/val, `as` import aliases, `data class` DTOs, relaxed file-name-vs-class rule, sealed classes
 *
 * Planned contents (see ../../notes/lang/03-architecture.md):
 *   - concrete `File` / `Import` / `Identifier` / `Definition`
 *     subclasses of the abstract bases in `@skmtc/core` — each renders
 *     itself in its own `toString()`
 *   - the `register` family (`register`, `defineAndRegister`)
 *   - this language's `EntityKind` vocabulary
 *   - `sanitizePropertyName` + identifier/casing/visibility rules
 *   - syntax helpers
 *
 * Status: **early spike (roadmap tier).** `KtFile`/`KtDefinition`/
 * `KtDataClass` render a `data class` DTO and a top-level `val`. One
 * Definition subclass spans both shells (container vs assignment) via the
 * opaque `kind`; the top-level `val` is Kotlin's distinctive file-scope
 * value (illegal in C#/PHP/Java). Sixth `exported` behaviour (public
 * default, `private` to restrict). Not yet wired into the engine.
 */

/** The language id this package targets. */
export const langId = 'kotlin' as const

/** File extensions this language package renders. */
export const fileExtensions = ['.kt'] as const

export { KtFile, type KtFileArgs } from './src/KtFile.ts'
export { KtDefinition } from './src/KtDefinition.ts'
export { KtDataClass, type KtParameterArgs } from './src/KtDataClass.ts'
export {
  createDataClass,
  createEnumClass,
  createSealedInterface,
  createTypeAlias,
  createValue,
  toKtKeyword,
  type KtEntityKind,
  type CreateKtIdentifierArgs,
  type CreateValueArgs
} from './src/createIdentifier.ts'
export { sanitizePropertyName } from './src/sanitizePropertyName.ts'
export { toPackageName } from './src/toPackageName.ts'
export { ktHardKeywords, isKtIdentifierName } from './src/hardKeywords.ts'
