# Languages

SKMTC's engine is **language-blind**: `@skmtc/core` constructs no
language object, holds no language reference, and ships no rendering
for any target language. Every language-specific concern — what a
file, an import, or a declaration looks like; what identifiers are
legal; how names sanitize — lives in a per-language package
(`@skmtc/lang-typescript`, `@skmtc/lang-kotlin`, …). A generator
declares its target language purely by **which lang package it
imports from**. There is no `client.json#language` selector, no
renderer registry, and no `lang` config field anywhere.

## TL;DR

- The language enters the DSL class hierarchy at the lang package's
  **snippet base** (`TsSnippet` / `KtSnippet`), which carries a
  static `lang`. Projection bases are built by the lang package's
  veneers (`toModelProjectionBase` et al.), so every projection
  inherits that static. The engine's Drivers read it **ephemerally**
  (`projection.lang`) when they create files and build Definitions —
  nothing persists a language reference.
- Entries (`toOasOperationEntry` / `toGqlOperationEntry` /
  `toModelEntry`) are pure pipeline config. `register` passes plain
  data. Core's `Identifier` is neutral data with an opaque
  per-language `kind`.
- Rendering lives on each DSL object's own `toString()` in its
  language subclass — there is no central renderer or visitor.
- **Production languages: TypeScript and Kotlin.** The other lang
  packages (C#, Go, Rust, PHP; Python/Java unspiked) are render-only
  spikes.
- One composition must resolve exactly ONE copy of each lang package
  (see "The dual-copy hazard" below).

## What every lang package owns

`@skmtc/lang-typescript` is the template; a new language ships its
own equivalents of each piece:

| Piece | TypeScript | Kotlin |
|---|---|---|
| The `Lang` object (three neutral factories Drivers call: `createFile` / `toDefinition` / `toImport`) | `typescript` | `kotlin` |
| Snippet base (where the language enters the hierarchy; keyless `register`) | `TsSnippet` | `KtSnippet` |
| Projection-base veneers | `toModelProjectionBase` / `toOasOperationProjectionBase` / `toGqlOperationProjectionBase` | `toModelProjectionBase` (operation veneers are demand-driven — none exists yet; the Spring generator is accumulator-style) |
| Register family (functions + concise vocabulary) | `register` / `defineAndRegister`, `TsRegisterArgs` (`imports` / `reExports` / `definitions`) | same, `KtRegisterArgs` — deliberately **no `reExports`** (Kotlin has none; the absence is compile-time) |
| Concrete file / import / definition classes | `TsFile` / `TsImport` / `TsReExport` / `TsDefinition` | `KtFile` / `KtImport` / `KtDefinition` |
| Identifier factories + kind vocabulary | `createVariable` / `createType` (`'variable'` / `'type'`) | `createClass` / `createDataClass` / `createEnumClass` / `createInterface` / `createSealedInterface` / `createTypeAlias` / `createValue` (seven kinds) |
| Name sanitization | `sanitizePropertyName` (quoting / camelCase fallback) | `sanitizePropertyName` (backtick escaping; JVM-unescapable characters throw) |
| Syntax helpers | `List`, `FunctionParameter`, `toPathTemplate`, … | `KtParameterList`, `KtFunctionSignature`, `KtAnnotation`, … |

Generators never construct the file/import/definition classes
directly — the register functions and the engine's Drivers build
them. If a generator news up a `TsImport`, it almost certainly
wanted `register({ imports })`.

## Languages differ honestly

The design rule (Dmitri's constraint): *don't surface one language's
concepts in another, and don't neutralize concepts until they lose
meaning.* Core carries only opaque discriminants (`kind`,
`exported`); each language gives them syntactic meaning, and each
language's package admits exactly what the language has:

- **Kind vocabularies differ.** TypeScript has two kinds; Kotlin has
  seven. Each language's `toKeyword` mapping throws on a foreign
  kind — a C# identifier reaching the Kotlin renderer fails loudly.
- **Capabilities differ at compile time, not runtime.** Kotlin has
  no re-exports, so `KtRegisterArgs` has no `reExports` field —
  registering one is a type error, not a silent no-op.
- **Grammar slots core doesn't model ride value protocols.** The
  neutral `Lang.toDefinition` call carries `identifier` + `value` —
  nothing else. Kotlin declarations need more (annotations above the
  shell, a supertype clause, a primary constructor, KDoc), so
  lang-kotlin defines duck-typed protocols the Definition's VALUE
  supplies: `KtAnnotated`, `KtSupertyped`, `KtConstructed`,
  `KtDocumented`. The Driver wraps the **projection**, so a
  projection must mirror its value's protocol fields as getters.
  This is the extension pattern for any future language whose
  declaration grammar outgrows `identifier + value`: add a protocol
  in the lang package; never widen core.
- **Import models differ.** TypeScript: brace-grouped names,
  type-only imports, `@/` alias resolution. Kotlin: one statement
  per symbol, the `package` directive derived from the export path,
  same-package import suppression. Core's `ImportBase` knows none of
  this.

## Grammar vs policy

A lang package renders **grammar**; a generator decides **policy**.
The boundary in one grep: `grep kotlinx lang-kotlin/src/` is empty —
the lang package renders any annotation it is handed, while *which*
annotation (`@Serializable` vs a Jackson equivalent) belongs to
`gen-kotlin`. Swapping serialization flavor means a sibling
generator, not a lang change. The same split holds for TypeScript:
`TsImport` renders type-only imports; *deciding* a symbol is
type-only is the generator's (or Driver's) call.

## The dual-copy hazard

The lang architecture distributes classes across packages that meet
inside one `GenerateContext` — files, imports, and definitions from
*different generators* flow into shared registries. Two copies of
one lang package in a single module graph (e.g. two generators
pinning different versions) fail **silently**, two ways:

1. **Cross-copy `instanceof`** — e.g. `KtFile`'s same-package import
   suppression guard fails across copies, producing byte-different
   output with no error.
2. **Split module-scope state** — a generator's module-level config
   (gen-kotlin's `basePackage`) is set on one copy and read by
   another.

The rule: peer generators sharing a lang package must pin the SAME
version — the release cascade (`deno task release`) keeps fleet
peers aligned, and a wrapper project validating unpublished changes
must point ALL wrappers at local sources, not just the changed one.

## Adding a language

The worked path (Kotlin is the proof, shipped in one milestone arc):

1. **Spike the renderer** — throwaway `File`/`Import`/`Definition`
   subclasses proving the language's distinctive constraints render
   (Kotlin's: top-level `val`, package-=-folder, backtick escaping).
2. **Naming layer** — identifier factories, kind vocabulary,
   keyword mapping, `sanitizePropertyName`, path/package validation.
3. **DSL classes** — the concrete file/import/definition classes
   with the language's import model; value protocols for grammar
   slots beyond `identifier + value`.
4. **Write path** — the `Lang` object, the snippet base, the
   register functions, the model veneer.
5. **A proving generator** — a real `gen-*` package exercising the
   full path against real schemas, gated by a byte-pinned
   `toArtifacts` e2e AND a native-toolchain compile (Gradle for
   Kotlin).
6. **Docs + skill** — a `skmtc-lang-<X>` skill instantiating the
   `skmtc-lang-typescript` template (same seven section headings,
   new answers).

The per-language Definition of Done lives in
`notes/lang/checklist.md` (local notes); the architecture specs are
`notes/lang/16` (the convergence) and `notes/lang/19` (Kotlin, the
template instantiation).

## See also

- [projections-and-snippets.md](projections-and-snippets.md) — the
  DSL the lang packages plug into
- [how-generators-produce-output.md](how-generators-produce-output.md)
  — the register path end to end
- [stringable-composition.md](stringable-composition.md) — why
  rendering lives on `toString()`
- The `skmtc-lang-typescript` and `skmtc-lang-kotlin` skills — the
  per-language operational answers
