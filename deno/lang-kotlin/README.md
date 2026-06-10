# @skmtc/lang-kotlin

SKMTC language package for **kotlin** — _Roadmap_ tier.

Renders: `'.kt'`

**Status: render spike — Phase D (productionization) is the active next
milestone.** `KtFile` (package directive), `KtDefinition` (kind-dispatch
between the `data class Name(params)` shell and the top-level
`val Name = value` assignment — Kotlin's distinctive constraint), and
`KtDataClass` are implemented with green render tests. The package is a
workspace member and rides the release cascade.

## Phase D scope (the coordination/write path)

The snippet base (`KtSnippet`), the `kotlin` Lang object
(`createFile`/`toDefinition`/`toImport`), the register family
(`register`/`defineAndRegister` functions + projection-base veneers),
`KtImport` (symbol-level, `as` aliases), the identifier factories with
Kotlin's `kind` vocabulary, `sanitizePropertyName` (keywords + backtick
escaping), and a proving `gen-*` end-to-end. Mirror
`@skmtc/lang-typescript` — it is the worked template. Rendering lives on
each object's own `toString()`; `@skmtc/core` never imports from here.

Kickoff note (reading path + open decisions):
[`../../notes/lang/18-kotlin-kickoff.md`](../../notes/lang/18-kotlin-kickoff.md)

See [`../../notes/lang/`](../../notes/lang/) for the full design.
