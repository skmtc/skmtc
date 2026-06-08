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
 * Status: **scaffold only** — no implementation yet. This package is NOT
 * yet a member of the root `deno.json#workspace` array, so it is held
 * out of the `deno task release` cascade until development begins
 * (Phase A in ../../notes/lang/07-migration-and-open-questions.md).
 */

/** The language id this package targets. */
export const langId = 'kotlin' as const

/** File extensions this language package renders. */
export const fileExtensions = ['.kt'] as const
