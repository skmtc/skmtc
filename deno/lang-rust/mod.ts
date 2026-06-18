/**
 * @module @skmtc/lang-rust
 *
 * SKMTC language package for **rust** (Stress-test).
 *
 * Tests / exercises: native tagged enums (matches oneOf), `use` paths, `pub` visibility
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
 * Status: **early spike.** `RsFile`/`RsDefinition`/`RsStruct`/`RsEnum`
 * prove the core `FileBase`/`DefinitionBase` seam reaches a language whose
 * declaration vocabulary (`struct`/`enum`/`type`) outgrows the binary
 * `EntityType` — the forcing case for the opaque `Identifier.kind`. Native
 * tagged enums exercise the `oneOf` distinctive constraint. Not yet wired
 * into the engine.
 */

/** The language id this package targets. */
export const langId = 'rust' as const

/** File extensions this language package renders. */
export const fileExtensions = ['.rs'] as const

export { RsFile, type RsFileArgs } from './src/RsFile.ts'
export { RsDefinition } from './src/RsDefinition.ts'
export { RsIdentifier, isRsIdentifier, type RsEntityKind } from './src/RsIdentifier.ts'
export { RsStruct, type RsFieldArgs } from './src/RsStruct.ts'
export { RsEnum, type RsVariantArgs } from './src/RsEnum.ts'
