/**
 * @module @skmtc/lang-go
 *
 * SKMTC language package for **go** (Stress-test).
 *
 * Tests / exercises: visibility-via-casing, package-level imports, no general aliases
 *
 * Planned contents (see ../../notes/lang/03-architecture.md):
 *   - concrete `File` / `Import` / `Identifier` / `Definition`
 *     subclasses of the abstract bases in `@skmtc/core` — each renders
 *     itself in its own `toString()`
 *   - the `register` family (`register`, `defineAndRegister`)
 *   - this language's `EntityType` vocabulary
 *   - `sanitizePropertyName` + identifier/casing/visibility rules
 *   - syntax helpers
 *
 * Status: **early spike.** `GoFile`/`GoDefinition`/`GoStruct` prove the
 * core `FileBase`/`DefinitionBase` seam generalizes beyond TypeScript and
 * exercise Go's visibility-via-casing. Not yet wired into the engine.
 */

/** The language id this package targets. */
export const langId = 'go' as const

/** File extensions this language package renders. */
export const fileExtensions = ['.go'] as const

export { GoFile, type GoFileArgs } from './src/GoFile.ts'
export { GoDefinition } from './src/GoDefinition.ts'
export { GoIdentifier, isGoIdentifier, type GoEntityType } from './src/GoIdentifier.ts'
export { GoStruct, type GoFieldArgs } from './src/GoStruct.ts'
