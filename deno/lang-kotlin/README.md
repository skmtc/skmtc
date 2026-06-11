# @skmtc/lang-kotlin

The Kotlin target-language layer for SKMTC generators.

Renders: `'.kt'`

**Status: production (0.5.0).** The full register/write path on the
frozen language seam — the second language after TypeScript, proven
end-to-end by the
[`@skmtc/gen-kotlin`](../../../skmtc-generators/gen-kotlin/) DTO
generator. 0.2.0 added the `KtSupertyped` value protocol (the supertype
clause — `data class Dog(…) : Animal` — for gen-kotlin's
sealed-interface `oneOf` mapping; spec
`notes/lang/22-kotlin-sealed-oneof-architecture.md`). 0.3.0 added the
`interface` kind and the function-signature grammar
(`KtFunctionSignature` / `KtFunctionParameter`) for
`@skmtc/gen-kotlin-spring` (spec `notes/lang/23`). 0.4.0 added the
concrete-`class` kind, the `KtConstructed` value protocol (primary
constructors), parameter visibility, and expression-bodied methods —
the generated-controller idiom (spec
`notes/lang/25-kotlin-controller-service-architecture.md`). 0.5.0 adds
the `KtDocumented` KDoc value protocol, signature-level KDoc, and
function-parameter defaults (`verbose: Boolean? = null` — the
service-seam ergonomics) — the production-polish arc (specs
`notes/lang/28`/`29`).

## What this package owns

- **`kotlin`** — the `Lang` object (`createFile` / `toDefinition` /
  `toImport`); read ephemerally by the engine's Drivers off the
  projection class's static. Generators never call it.
- **`KtSnippet`** — the snippet base; where Kotlin enters the DSL
  class hierarchy. Keyless `register` / `defineAndRegister`.
- **`toModelProjectionBase`** — the projection-base veneer (own-file
  `register(args)` + cross-file `registerInto(path, args)`). No
  operation veneer yet — the first operation generator
  (`gen-kotlin-spring`) is accumulator-style and didn't need one;
  veneers are demand-driven.
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
  vocabulary (`class` / `data-class` / `enum-class` / `interface` /
  `sealed-interface` / `typealias` / `val`); visibility renders
  nothing when public,
  `private` to restrict; class-level annotations ride the value via the
  **`KtAnnotated`** protocol, the supertype clause
  (`data class Dog(…) : Animal`, data-class kind only in v1) via the
  **`KtSupertyped`** protocol, the primary constructor via the
  **`KtConstructed`** protocol, and KDoc via the **`KtDocumented`**
  protocol (rendered with `withDescription`) — mirror protocol getters
  on the projection: the Driver wraps the projection, not the value.
- **`KtParameterList`** / **`KtFunctionSignature`** /
  **`KtFunctionParameter`** / **`KtAnnotation`** — construct helpers
  (constructor params: nullability `?`, `= default`, inline
  annotations; method signatures for interface and class bodies with
  optional KDoc, expression bodies (` = …` delegation), and
  per-parameter defaults; generic annotation grammar — *which*
  annotation is generator policy).
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
