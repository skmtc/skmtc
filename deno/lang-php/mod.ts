/**
 * @module @skmtc/lang-php
 *
 * SKMTC language package for **php** (Stress-test).
 *
 * Tests / exercises: namespace=folder (PSR-4), class container, no top-level funcs/values, no type-only imports
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
 * Status: **early spike.** `PhpFile`/`PhpDefinition`/`PhpClass` prove the
 * core `FileBase`/`DefinitionBase` seam reaches a language whose
 * declaration is a `class X { … }` container assembled from properties —
 * the sharp test for the "Definition assembly" question. Outcome:
 * Definition assembles the *shell*, the value renders the *body* (the
 * same split Go/Rust already use). PHP is a second consumer of the opaque
 * `Identifier.type` and a fourth `exported` behaviour (ignored at class
 * level). Not yet wired into the engine.
 */

/** The language id this package targets. */
export const langId = 'php' as const

/** File extensions this language package renders. */
export const fileExtensions = ['.php'] as const

export { PhpFile, type PhpFileArgs } from './src/PhpFile.ts'
export { PhpDefinition } from './src/PhpDefinition.ts'
export { PhpIdentifier, isPhpIdentifier, type PhpEntityType } from './src/PhpIdentifier.ts'
export { PhpClass, type PhpPropertyArgs } from './src/PhpClass.ts'
