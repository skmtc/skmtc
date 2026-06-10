# @skmtc/lang-kotlin

The Kotlin target-language layer for SKMTC generators.

Renders: `'.kt'`

**Status: production (0.1.0, Phase D complete).** The full
register/write path on the frozen language seam — the second language
after TypeScript, proven end-to-end by the
[`@skmtc/gen-kotlin`](../../../skmtc-generators/gen-kotlin/) DTO
generator.

## What this package owns

- **`kotlin`** — the `Lang` object (`createFile` / `toDefinition` /
  `toImport`); read ephemerally by the engine's Drivers off the
  projection class's static. Generators never call it.
- **`KtSnippet`** — the snippet base; where Kotlin enters the DSL
  class hierarchy. Keyless `register` / `defineAndRegister`.
- **`toModelProjectionBase`** — the projection-base veneer (own-file
  `register(args)` + cross-file `registerInto(path, args)`). Operation
  veneers arrive with the first operation-emitting generator.
- **`register` / `defineAndRegister`** functions +
  **`KtRegisterArgs`** — the concise vocabulary. Deliberately **no
  `reExports` field**: Kotlin has none, so the absence is compile-time.
- **`KtFile`** — `package` directive derived from the file's own path
  (the export path encodes the package; `basePath` = Gradle source
  root), alphabetically sorted imports (registration-order
  independence), **same-package import suppression**.
- **`KtImport`** — symbol-level, `as` aliases, one statement per
  symbol, dotted-package and `@/`-path module keys.
- **`KtDefinition`** — declaration shells, exhaustive over the kind
  vocabulary (`data-class` / `enum-class` / `sealed-interface` /
  `typealias` / `val`); visibility renders nothing when public,
  `private` to restrict; class-level annotations ride the value via the
  **`KtAnnotated`** protocol; KDoc via `withDescription`.
- **`KtParameterList`** / **`KtAnnotation`** — construct helpers
  (nullability `?`, `= default`, inline annotations; generic
  annotation grammar — *which* annotation is generator policy).
- **Identifier factories** — `createDataClass`, `createEnumClass`,
  `createSealedInterface`, `createTypeAlias`, `createValue` (+
  `toKtKeyword`, throws outside the vocabulary).
- **`sanitizePropertyName`** — hard keywords + invalid names →
  backticks; JVM-unescapable characters throw. Renames are gen-side
  annotations; escaping is lang-side backticks.
- **`toPackageName`** — `@/`-path → dotted package, with segment
  validation (Kotlin's `validateDestinationPath`).

The boundary in one grep: `grep kotlinx src/` → empty. Serialization
flavor lives in `gen-kotlin`; this package is grammar only.

Skill: [`docs/skills/skmtc-lang-kotlin/`](../docs/skills/skmtc-lang-kotlin/SKILL.md).
Architecture spec: `notes/lang/19-kotlin-architecture.md` (local notes).
Template: [`@skmtc/lang-typescript`](../lang-typescript/).
