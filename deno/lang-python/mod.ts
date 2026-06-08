/**
 * @module @skmtc/lang-python
 *
 * SKMTC language package for **python** (Stress-test).
 *
 * Tests / exercises: indentation-as-syntax, module-vs-package model, `__init__.py` aggregation
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
export const langId = 'python' as const

/** File extensions this language package renders. */
export const fileExtensions = ['.py'] as const
