/**
 * @module @skmtc/lang-csharp
 *
 * SKMTC language package for **csharp** (Roadmap).
 *
 * Tests / exercises: namespace-bulk imports, records, no file-scope values, nullable reference types
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
 * Status: **early spike (roadmap tier).** `CsFile`/`CsDefinition`/
 * `CsRecord` render a positional `record` DTO, confirming the resolved
 * Definition-assembly split on a positional shell and adding a fifth
 * `exported` behaviour (`public`/`internal`). Third consumer of the
 * opaque `Identifier.kind`. Not yet wired into the engine.
 */

/** The language id this package targets. */
export const langId = 'csharp' as const

/** File extensions this language package renders. */
export const fileExtensions = ['.cs'] as const

export { CsFile, type CsFileArgs } from './src/CsFile.ts'
export { CsDefinition } from './src/CsDefinition.ts'
export { CsRecord, type CsParameterArgs } from './src/CsRecord.ts'
