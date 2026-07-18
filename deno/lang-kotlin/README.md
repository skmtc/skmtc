# @skmtc/lang-kotlin

The Kotlin target-language layer for SKMTC generators.

Renders: `'.kt'`

**Status: production** (see `deno.json` for the current version — the
release cascade patch-bumps it). The full register/write path on the
frozen language seam — the second language after TypeScript, proven
end-to-end by the
[`@skmtc/gen-kotlin`](../../../skmtc-generators/gen-kotlin/) DTO
generator, `@skmtc/gen-kotlin-spring`, and `@skmtc/gen-kotlin-sdk`.
Milestone history: 0.2.0 added the `KtSupertyped` value protocol (the
supertype clause — `data class Dog(…) : Animal` — for gen-kotlin's
sealed-interface `oneOf` mapping; spec
`notes/lang/22-kotlin-sealed-oneof-architecture.md`). 0.3.0 added the
`interface` kind and the function-signature grammar
(`KtFunctionSignature` / `KtFunctionParameter`) for
`@skmtc/gen-kotlin-spring` (spec `notes/lang/23`). 0.4.0 added the
concrete-`class` kind, the `KtConstructed` value protocol (primary
constructors), parameter visibility, and expression-bodied methods —
the generated-controller idiom (spec
`notes/lang/25-kotlin-controller-service-architecture.md`). 0.5.0 added
the `KtDocumented` KDoc value protocol, signature-level KDoc, and
function-parameter defaults (`verbose: Boolean? = null` — the
service-seam ergonomics) — the production-polish arc (specs
`notes/lang/28`/`29`). The gen-kotlin-sdk arc (note `32`) added the
`verbatim` kind (multi-declaration template files — since removed;
whole-file raw content is a FILE fact awaiting a neutral content-file
class in core), constructor
modifiers with the explicit `constructor` keyword, the supertype clause
on the `class` shell, and the OAS operation projection-base veneer.
The head+value rewrite then moved the declaration keywords (and
visibility) onto `KtIdentifier` and the delimiters onto the value
side, dissolving the `KtSupertyped` and `KtConstructed` protocols —
primary constructors became `KtPrimaryConstructor`; supertype clauses
and braced bodies are written inline (see `KtDefinition` below for
the current model).

## What this package owns

- **`kotlin`** — the `Lang` object (`createFile` / `toDefinition` /
  `toImport`); read ephemerally by the engine's Drivers off the
  projection class's static. Generators never call it.
- **`KtSnippet`** — the snippet base; where Kotlin enters the DSL
  class hierarchy. Keyless `register` / `defineAndRegister`.
- **`toKtModelProjectionBase`** / **`toKtOasOperationProjectionBase`**
  — the projection-base veneers (own-file `register(args)` + cross-file
  `registerInto(path, args)`). Veneers are demand-driven: the model
  veneer came with `gen-kotlin`, the OAS operation veneer with
  `gen-kotlin-sdk`'s Response models; a GraphQL veneer arrives with the
  first generator that needs it.
- **`register` / `defineAndRegister`** functions +
  **`KtRegisterArgs`** — the concise vocabulary. Deliberately **no
  `reExports` field**: Kotlin has none, so the absence is compile-time.
- **`KtFile`** — `package` directive derived from the file's own path
  (the export path encodes the package; `basePath` = Gradle source
  root), alphabetically sorted imports (registration-order
  independence), **same-package import suppression**.
- **`KtImport`** — symbol-level, `as` aliases, one statement per
  symbol, dotted-package and `@/`-path module keys.
- **`KtDefinition`** — head + value rendering: the identifier renders
  its declaration head (`data class User`, `val timeout: Long` — the
  keyword map lives on `KtIdentifier`), and the value renders
  everything after it. Assignment kinds (`typealias` / `val`) render
  `${head} = ${value}`; declaration kinds render `${head}${value}`. A
  value that renders nothing IS the bodyless idiom (`sealed interface
  Animal`) — the definition never inspects the value. Raw whole-file
  content (static template files) is a FILE fact, not a definition —
  no identifier involved; it belongs on a self-contained content file
  (neutral core wiring pending), not on `KtFile`. `KtFile` renders the
  neutral `custom` slot (`FileBase.custom`) as LEADING content above
  the `package` directive — e.g. a generated-file attribution banner —
  the same placement `TsFile` gives it, last non-`undefined` write
  wins. Visibility is the identifier's fact,
  rendered in its head (nothing when public, `private ` to restrict);
  the neutral `noExport` flag folds into a restricted identifier copy
  at the `KtLang.toDefinition` boundary. Two protocols remain on the
  value because
  they render above the declaration: class-level annotations
  (**`KtAnnotated`**) and KDoc (**`KtDocumented`**, rendered with
  `withDescription`; constructor `description` wins) — mirror protocol
  getters on the projection: the Driver wraps the projection, not the
  value.
- **`KtParameterList`** (parentheses included) / **`KtPrimaryConstructor`**
  (modifiers + the explicit `constructor` keyword rule) — the
  composable value classes a declaration-kind value interpolates
  (`${primaryConstructor} : Supertype {\n…\n}` — supertype clauses and
  braced bodies are written inline; plain Kotlin syntax carries no
  grammar rule worth a class).
- **`KtFunctionSignature`** / **`KtFunctionParameter`** — construct
  helpers (method signatures for interface and class bodies with
  optional KDoc, expression bodies (` = …` delegation), and
  per-parameter defaults).
- **`KtAnnotation`** — a registering leaf (the `TsHeritage` pattern):
  given a `packageName` it self-registers its class's import into
  `destinationPath`, so annotation and import are one statement;
  same-package imports are suppressed centrally by `KtFile`.
  Default-scope annotations (`@Deprecated`) pass no `packageName`.
  `toKtAnnotations(value)` collects a value's `KtAnnotated` protocol
  field into a `KtAnnotations` block (empty renders nothing). *Which*
  annotation to emit is generator policy.
- **Identifier factories** — `createClass`, `createDataClass`,
  `createEnumClass`, `createInterface`, `createSealedInterface`,
  `createTypeAlias`, `createValue` (+
  `toKtEntityType`, the cast-free narrowing of the engine's opaque
  `type` string; throws outside the vocabulary).
- **`sanitizePropertyName`** — hard keywords + invalid names →
  backticks; JVM-unescapable characters throw. Renames are gen-side
  annotations; escaping is lang-side backticks.
- **`toPackageName`** — `@/`-path → dotted package, with segment
  validation (Kotlin's `validateDestinationPath`).

The boundary in one grep: `grep kotlinx src/` → empty. Serialization
flavor lives in `gen-kotlin`; this package is grammar only.

Skill: [`skmtc-lang-kotlin`](../docs/skills/skmtc-lang-kotlin/SKILL.md)
(on the [`skmtc-lang-typescript`](../docs/skills/skmtc-lang-typescript/SKILL.md)
template; source↔skill sync enforced by `deno task verify-docs` — see
`docs/skills/README.md`).
Architecture spec: `notes/lang/19-kotlin-architecture.md` (local notes).
Template: [`@skmtc/lang-typescript`](../lang-typescript/).
