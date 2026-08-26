# Languages

> The engine is language-blind: `@skmtc/core` constructs no language
> object and ships no rendering for any target language. A generator
> declares its target language purely by which lang package it imports
> from — there is no `client.json#language` selector, no renderer
> registry, and no `lang` config field anywhere.

Every language-specific concern — what a file, an import, or a
declaration looks like; which identifiers are legal; how names
sanitize — lives in a per-language package. `@skmtc/lang-typescript`
is the production language layer; other language layers are pre-alpha
and not published for general use.

## Where the language enters

The language enters the DSL class hierarchy at the lang package's
**snippet base** (`TsSnippet`), which carries a static `lang`.
Projection bases are built by the lang package's veneers
(`toTsModelProjectionBase`, `toTsOasOperationProjectionBase`, …), so
every projection inherits that static. The engine's Drivers read it
ephemerally when they create files and build Definitions — nothing in
core persists a language reference. Rendering lives on each DSL
object's own `toString()` in its language subclass; there is no
central renderer or visitor.

## What a lang package owns

For TypeScript, the package supplies:

- **The `Lang` object** — the four neutral factories Drivers call
  (`createFile` / `toDefinition` / `toImport` / `toIdentifier`).
- **The snippet base** — `TsSnippet`, where the language enters the
  hierarchy.
- **Projection-base veneers** — `toTs*ProjectionBase`, pre-binding the
  snippet base onto core's neutral factories.
- **The register family** — `register` / `defineAndRegister` and the
  concise `TsRegisterArgs` vocabulary (`imports` / `reExports` /
  `definitions`).
- **Concrete file, import, and definition classes** — `TsFile`,
  `TsImport`, `TsReExport`, `TsDefinition`.
- **Identifier factories and the kind vocabulary** — `createVariable` /
  `createType`.
- **Name sanitization and syntax helpers** — `sanitizePropertyName`,
  `List`, `FunctionParameter`, `toPathTemplate`, …

Generators never construct the file/import/definition classes
directly — the register functions and the engine's Drivers build them.
A generator newing up a `TsImport` almost certainly wanted
`register({ imports })`.

## Languages differ honestly

The design rule: don't surface one language's concepts in another, and
don't neutralize concepts until they lose meaning. Core carries only
opaque discriminants (`kind`, `exported`); each language package gives
them syntactic meaning and admits exactly what the language has. A
language without re-exports has no `reExports` field in its register
vocabulary — registering one is a compile error, not a silent no-op —
and each language's keyword mapping throws on a foreign kind rather
than guessing.

## Grammar vs policy

A lang package renders **grammar**; a generator decides **policy**.
`TsImport` knows how to render a type-only import; *deciding* that a
symbol is type-only is the generator's (or Driver's) call. Choices
like which validation library an output uses never belong in a lang
package — swapping that flavor means a sibling generator, not a lang
change.

## See also

- [projections-and-snippets.md](projections-and-snippets.md) — the
  DSL the lang packages plug into
- [how-generators-produce-output.md](how-generators-produce-output.md)
  — the register path end to end
- [stringable-composition.md](stringable-composition.md) — why
  rendering lives on `toString()`
