---
name: skmtc-lang-kotlin
version: 0.2.0
description: |
  The Kotlin target-language layer for SKMTC generators
  (`@skmtc/lang-kotlin`). Covers how a generator declares Kotlin as its
  target language (importing the projection-base veneer and `KtSnippet`
  from the lang package), what the lang package exports (the `kotlin`
  Lang object, the register family, `KtFile` / `KtImport` /
  `KtDefinition` / `KtParameterList` / `KtAnnotation`), entity kinds and
  `Identifier` factories (`createDataClass`, `createEnumClass`, …), the
  import model of emitted Kotlin (symbol-level imports, `as` aliases,
  package derivation from the export path, same-package suppression, NO
  re-exports), the parameter/annotation construct helpers, and
  naming/sanitization (hard keywords, backtick escaping, annotation-led
  renames).

  Use this skill alongside `skmtc-generator` whenever a generator emits
  Kotlin, and specifically when the user asks about "lang-kotlin",
  "KtSnippet", "package directive", "where does the Kotlin package come
  from", "backticks", "@SerialName", "data class generation", or
  anything about the *shape of the emitted Kotlin* rather than engine
  behavior. Engine rules (Projections, Snippets, cross-generator
  coordination, variants) live in `skmtc-generator`. This skill follows
  the `skmtc-lang-typescript` TEMPLATE: same seven section headings,
  Kotlin answers.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Write
  - Edit
---

# SKMTC Kotlin language layer

This skill covers the **target-language** side of generator authoring:
what the emitted Kotlin looks like and which package owns each piece.
The boundary rule, worth internalizing first:

> **The authoring language is always TypeScript/Deno; only the target
> language varies.** Rules about how generator *source* is written
> (`as` casts, `switch`+`never`, `Deno.env`, Valibot enrichments) live
> in `skmtc-generator`. This skill covers how the generator's *output*
> is shaped — files, imports, definitions, identifiers, naming — for
> generators whose target is Kotlin.

> **Template contract.** This skill keeps the seven section headings of
> `skmtc-lang-typescript` (the template) and replaces the answers. A
> second boundary specific to Kotlin: **`lang-kotlin` is grammar,
> `gen-kotlin` is OpenAPI policy.** `kotlinx.serialization` is never
> named inside `lang-kotlin` — the lang package renders any annotation
> it is handed; *which* annotation to emit is generator policy.
> Architecture spec: `notes/lang/19-kotlin-architecture.md`.

## 1. Package surface

`@skmtc/lang-kotlin` exports:

| Export | What it is |
|---|---|
| `kotlin` | The `Lang` object. Three neutral factories the engine's **Drivers** call, reading it ephemerally off the projection class's inherited static (`projection.lang`): `createFile`, `toDefinition`, `toImport`. Generators never call it. |
| `KtSnippet` | The snippet base — where Kotlin enters the DSL class hierarchy. Carries the static `lang`; its `register` / `defineAndRegister` methods are typed by the concise vocabulary. Registering snippets are **keyless** (`generatorKey` is optional attribution input) |
| `toModelProjectionBase` | The model projection-base veneer over core's factory — pre-binds `base: KtSnippet` and adds own-file `register(args)` + explicit cross-file `registerInto(destinationPath, args)` (+ `KtModelProjectionBaseConfig`). No operation veneer exists — the first operation generator (`gen-kotlin-spring`) is accumulator-style (`KtSnippet` + `defineAndRegister` + `findDefinition`) and didn't need one; veneers are demand-driven |
| `register` / `defineAndRegister` | The register **functions** — convert the concise form, ensure the destination `KtFile`, hand pure data to the neutral `context.register`. Transforms (closures with no class) import `defineAndRegister` directly |
| `KtRegisterArgs` / `KtDefineAndRegisterArgs` | The concise register vocabulary (`imports` / `definitions`) — **deliberately NO `reExports` field**: Kotlin has no re-exports, so registering one is a compile-time error, not a runtime no-op |
| `KtFile` | `CodeFileBase` subclass — a Kotlin output file: `package` directive **derived from its own path**, alphabetically sorted import section, same-package import suppression |
| `KtImport` | `ImportBase` subclass — symbol-level specifiers, `as` aliases, one statement per symbol (no brace grouping), mergeKey/merge dedup, `@/`-path → package resolution at render |
| `KtDefinition` | `DefinitionBase` subclass — the declaration shells, exhaustive over the kind vocabulary (throws outside it); visibility from `exported`; reads class-level annotations off the value via the `KtAnnotated` protocol and the supertype clause via `KtSupertyped`; KDoc from `description` |
| `KtParameterList` / `KtParameter(Args)` | Primary-constructor parameter rendering: `    @Anno val name: Type? = default`, comma-joined, no trailing comma |
| `KtFunctionSignature` / `KtFunctionParameter` | The method grammar for interface and class bodies: optional KDoc `description` above the annotations (0.5.0), above-annotations one per line, inline parameter annotations, nullable `?`, optional `= default` per parameter (0.5.0 — the seam-ergonomics default, `verbose: Boolean? = null`), return type omitted → implicit `Unit`, optional EXPRESSION body (` = service.x(…)` — delegation; no block bodies, no `override`). Distinct production from `KtParameterList` (no `val`) |
| `KtAnnotation` | Generic annotation rendering: `@Name` / `@Name(arg, …)` — args pre-quoted by the caller |
| `KtAnnotated` / `isKtAnnotated` | The protocol (`{ annotations: KtAnnotation[] }`) by which a Definition's VALUE supplies class-level annotations to `KtDefinition` (the neutral `Lang.toDefinition` has no annotations slot); cast-free type guard |
| `KtConstructed` / `isKtConstructed` | The protocol (`{ constructorParameters: Stringable }`) by which a Definition's VALUE supplies a primary constructor to the `class` shell (`class UsersController(\n    private val service: …\n) { … }`); same value-carried pattern as `KtAnnotated` |
| `KtSupertyped` / `isKtSupertyped` | The protocol (`{ supertypes: Stringable[] }`) by which a Definition's VALUE supplies a supertype clause — `data class Dog(\n…\n) : Animal` (rendered for the `data-class` kind only in v1); same value-carried pattern as `KtAnnotated`; bare names, no import behavior (same-package suppression makes them correct) |
| `KtDocumented` / `isKtDocumented` | The FOURTH value protocol (0.5.0): `{ description?: string }` on a Definition's VALUE supplies the KDoc block `KtDefinition` renders above the annotations (an explicit constructor `description` wins). The lang renders the KDoc; WHAT the text is (schema `description`, operation `summary`) is generator policy. Gotcha (spec 28): the Driver wraps the PROJECTION, so all value protocols — `annotations`, `supertypes`, `description` — must be MIRRORED as getters on the projection class |
| `KtImportNameArg` | The concise import-name shape (`'Name'`, `{ name, alias }`) accepted by `register({ imports })` |
| `createClass` / `createDataClass` / `createEnumClass` / `createInterface` / `createSealedInterface` / `createTypeAlias` / `createValue` | The identifier factories — build neutral `Identifier`s with this language's `kind` vocabulary (`createValue` also takes `typeName` for `val x: T = …`) |
| `KtEntityKind` / `toKtKeyword` | The seven-kind vocabulary and its declaration-keyword mapping; throws outside the vocabulary |
| `sanitizePropertyName` | Kotlin-specific property-name sanitization (§5) |
| `toPackageName` | `@/`-path → dotted-package derivation + segment validation (Kotlin's `validateDestinationPath`) |
| `ktHardKeywords` / `isKtIdentifierName` | The pinned hard-keyword set and the plain-identifier syntax check |
| `withDescription` | KDoc comment helper (block syntax identical to JSDoc) |
| `langId` | `'kotlin'` |
| `fileExtensions` | `['.kt']` |

### Wiring — the import graph declares the language

```ts
// gen-x/src/base.ts — the language enters HERE, through the import
import { toModelProjectionBase, createDataClass } from '@skmtc/lang-kotlin'

export const MyBase = toModelProjectionBase({
  id: denoJson.name,
  toIdentifier({ refName }) { return createDataClass(name) },
  toExportPath({ refName }) { /* @/<package dirs>/<Name>.generated.kt */ }
})
```

There is no `lang` config field anywhere; entries are pure pipeline
config. Generators never construct `KtFile` / `KtDefinition` /
`KtImport` directly — the register functions and Drivers build them.

One Kotlin-specific wrinkle the TypeScript template doesn't have:
**Kotlin's declaration kind varies by schema shape** (object → `data
class`, string enum → `enum class`, the rest → `typealias`), and a
projection's `toIdentifier` cannot see the schema. The pattern (worked
out in `gen-kotlin`): one projection class per kind, each with a
constant-kind `toIdentifier`, all sharing name/export-path derivation,
dispatched by ONE shared shape function used by both the transform and
the ref snippet.

## 2. Entity kinds & identifiers

Kotlin output has seven entity kinds (`KtEntityKind`), created via the
factories exported by THIS package:

```ts
import { createDataClass, createValue } from '@skmtc/lang-kotlin'

createClass('UsersController')                // → class UsersController(…) { … }
createDataClass('User')                       // → data class User( … )
createEnumClass('Status')                     // → enum class Status { … }
createInterface('UsersApi')                   // → interface UsersApi { … }
createSealedInterface('Animal')               // → sealed interface Animal
createTypeAlias('UserList')                   // → typealias UserList = …
createValue('MAX_RETRIES')                    // → val MAX_RETRIES = …
createValue('timeout', { typeName: 'Long' })  // → val timeout: Long = …
```

- The kind drives ONLY the declaration shell (`toKtKeyword` /
  `KtDefinition`'s dispatch) — unlike TypeScript, it does NOT drive
  import form: every Kotlin import is `import pkg.Name`.
- Top-level `val` is Kotlin's distinctive file-scope value (illegal in
  C#/PHP/Java) — the language's distinctive-constraint test.
- `sealed-interface` is in the vocabulary AND gen-kotlin maps
  qualifying discriminated `oneOf`s onto it (spec
  `notes/lang/22-kotlin-sealed-oneof-architecture.md`); members carry
  the ` : Parent` clause via `KtSupertyped`.
- `interface` carries gen-kotlin-spring's `<Tag>Api` declarations
  (spec `notes/lang/23-kotlin-spring-architecture.md`); the body is a
  blank-line-joined list of `KtFunctionSignature`s. Same bodyless
  collapse as `sealed-interface` when the value renders empty.
  There is deliberately NO `fun` kind — methods live inside
  interface and class bodies, never at file scope.
- Visibility: Kotlin defaults to `public`, so `exported: true` renders
  *nothing* and `exported: false` renders `private ` (file-local) —
  keyword only to restrict.
- `toKtKeyword` throws on a kind outside the vocabulary — a foreign
  language's identifier reaching the Kotlin renderer fails loudly.

## 3. The import model of emitted Kotlin

Generators register imports in the concise form; the register function
converts them to `KtImport`s at the register boundary:

```ts
this.register({
  imports: {
    'kotlinx.serialization': ['Serializable', 'SerialName'],   // dotted package
    'com.example.shared': [{ name: 'Money', alias: 'SharedMoney' }] // alias via `as`
  }
})
```

Rendering rules `KtFile` / `KtImport` apply (authors never hand-write
these):

- **One statement per symbol** — Kotlin has no brace grouping:
  `import kotlinx.serialization.Serializable`.
- **Two module-key forms**: a dotted package (external libraries) or an
  `@/`-export-path (project files — what the Driver passes for
  cross-file peer imports). Path-form modules resolve to their package
  via `toPackageName` at render time.
- **The export path encodes the package.** The segments after `@/` ARE
  the package directories: `@/com/example/api/User.generated.kt` →
  `package com.example.api`. `client.json#settings.basePath` points at
  the Gradle source root (e.g. `./app/src/main/kotlin`), so files land
  on the package-=-folder convention. `KtFile` derives its own
  directive; nobody computes it by hand.
- **Same-package suppression**: an import whose resolved package equals
  the file's own package is omitted at render — Kotlin needs no import
  for same-package symbols. The Driver's peer imports vanish when peers
  share the package (the common case); this is the structural analog of
  TsFile's intra-package `@/` normalization.
- **Sorted alphabetically** — not style (the consumer's formatter owns
  style): sorting makes the rendered bytes independent of registration
  order, which is what snapshot tests and byte-identical gates compare.
- **No re-exports, no glob imports, no default package**: the concise
  vocabulary has no `reExports` field (compile-time absence); glob
  imports are not modeled in v1; importing from the default package
  throws (Kotlin genuinely cannot), and `toPackageName` throws on path
  segments that cannot be package parts (`@/my-models/User.kt`).

## 4. Syntax helpers

Construct-level helpers for Kotlin syntax — all `Stringable`-compatible:

| Helper | Renders |
|---|---|
| `KtParameterList` / `KtParameterArgs` | A primary-constructor parameter list: `    @SerialName("x_y") val xY: String? = null`, comma-joined, **no trailing comma** (cosmetic non-decision — formatters normalize; SKMTC renders unformatted) |
| `KtFunctionSignature` / `KtFunctionSignatureArgs` | A method signature for an interface or class body, indented one level: optional KDoc above the annotations, above-annotations one per line, parameters on one line, `: T` omitted when `returnType` is absent (implicit `Unit`), optional expression `body` (` = …` — the delegation idiom; block bodies deliberately unsupported). No `suspend` |
| `KtFunctionParameter` / `KtFunctionParameterArgs` | One function parameter: `@PathVariable("id") id: String` / `verbose: Boolean? = null` — inline annotations before the name, optional `= default` after the type; no `val` prefix (that is the constructor-parameter production) |
| `KtAnnotation` | `@Serializable` / `@SerialName("user_id")` — grammar only; args pre-quoted by the caller; which annotation is generator policy |
| `KtAnnotated` / `isKtAnnotated` | The value-carried class-level-annotation protocol `KtDefinition` reads (one annotation per line above the shell) |
| `KtSupertyped` / `isKtSupertyped` | The value-carried supertype protocol `KtDefinition` reads (` : A, B` after the data-class parameter list) |
| `KtConstructed` / `isKtConstructed` | The value-carried primary-constructor protocol `KtDefinition` reads for the `class` shell (the injected-service idiom) |
| `KtDocumented` / `isKtDocumented` | The value-carried KDoc protocol `KtDefinition` reads (block rendered above the annotations); mirror it on the projection — the Driver wraps the projection, not the value |
| `withDescription` | KDoc block (`/** … */`) above a declaration |

The schema→type mapping (`String`, `Int`/`Long`, `List<…>`,
`Map<String, …>`, `JsonElement`) is **generator** territory — it lives
in `gen-kotlin`'s value layer, not here.

## 5. Naming & sanitization

- **`sanitizePropertyName(name)`** — makes a name safe as a Kotlin
  declaration name. Plain identifier and not a hard keyword → as-is;
  hard keyword (`object`, `val`, …) or syntactically invalid → backtick
  escaped (`` `object` ``); characters illegal even inside backticks on
  the JVM (`.`, `;`, `/`, `[`, `]`, `<`, `>`, `:`, `\`, backtick,
  newline) → **throws** (rename gen-side before registering). Returns a
  plain `string` — Kotlin has no quoted-property fallback.
- **Renames are annotations, not escapes.** Kotlin cannot quote
  property names, so wire-name mismatches need `@SerialName` (or the
  Jackson/Moshi equivalent) — that policy belongs to the generator.
  The two mechanisms compose: a backticked keyword still *equals* its
  wire name, so it needs no annotation.
- **Soft keywords are fine**: `value`, `data`, `field`, `import` are
  legal identifiers — only the pinned hard-keyword set escapes.
- **Casing convention**: PascalCase classes, camelCase properties,
  CONSTANT_CASE enum entries (the casing itself is applied gen-side via
  `camelCase` / `capitalize` from core).
- **File extensions**: `.kt`, with the engine-side `.generated.` infix
  (`User.generated.kt`). Kotlin file names need not match the contained
  class, so the infix is harmless.
- **Path segments are names too**: `toPackageName` validates every
  directory segment as a package part and throws otherwise — loud beats
  backticked package names.

## 6. Kotlin-output anti-patterns

- **Registering a re-export** — won't compile: `KtRegisterArgs` has no
  `reExports` field. Kotlin has no re-export construct; restructure
  instead.
- **Baking the declaration into the value** — `toString()` returning
  `data class Foo(…)` or `@Serializable` ahead of it. The Driver +
  `KtDefinition` add annotations (via `KtAnnotated`), the supertype
  clause (via `KtSupertyped`), visibility, the keyword, the name, and
  the shell. Return only the body (the parameter list / enum entries /
  aliased type).
- **Adding `?` twice** — the type expression is the single owner of
  nullability; the parameter layer adds `= null` defaults, never a
  second `?`. (`gen-kotlin`'s `applyModifiers` guards this; keep the
  rule when hand-building parameters.)
- **Hand-computing the `package` directive** — it is derived from the
  export path by `KtFile`. To change a package, change `toExportPath`.
- **Emitting an anonymous object/enum shape** — Kotlin has none.
  Synthesize a named sibling (`findDefinition` + `defineAndRegister`)
  and reference it; `gen-kotlin`'s `KtObjectValue` / `KtString` are the
  worked pattern.
- **Zero-parameter `data class`** — illegal Kotlin. Empty objects are
  `JsonObject`-typealias territory, not data classes.
- **Naming `kotlinx.serialization` inside lang-kotlin** — the
  grammar/policy boundary in one rule. The lang package renders
  annotations it is handed; serialization flavor lives in the
  generator (that's the seam a Jackson sibling generator replaces).
- **Constructing `KtFile` / `KtImport` / `KtDefinition` in a
  generator** — those are built by this package's register functions
  and the engine's Drivers. Generators speak `register` /
  `insertModel` / `defineAndRegister`.
- **Running a formatter over the output** — render is unformatted by
  design; trailing commas and import order are the consumer's
  ktlint/ktfmt's job (the render sorts imports for determinism, not
  style).

## 7. Boundary with other skills

- **`skmtc-generator`** — everything engine-side: Projections,
  Snippets, `register` / `registerInto` semantics, cross-generator
  coordination, variants, enrichments, entry factories. If the question
  is "how do generators work", it's there; if it's "what does the
  emitted Kotlin look like", it's here.
- **`skmtc-lang-typescript`** — the template this skill instantiates;
  the TypeScript answers to these seven sections.
- **`skmtc-cli`** — install/clone/bundle/generate commands.
- **`skmtc-debug`** — broken output, verify-first stance.

### Status note

Shipped by the Kotlin Phase D milestone (spec
`notes/lang/19-kotlin-architecture.md`) and its successor milestones:
sealed-`oneOf` (`lang-kotlin@0.2.0`, spec `notes/lang/22` —
`KtSupertyped`), Spring (`0.3.0`, spec `notes/lang/23` — the
`interface` kind + function-signature grammar), controllers + service
seam (`0.4.0`, spec `notes/lang/25` — the `class` kind,
`KtConstructed`, parameter visibility, expression bodies), and the
production-polish arc (`0.5.0`, specs `notes/lang/28`/`29` — the
`KtDocumented` KDoc protocol, signature-level KDoc, and
function-parameter defaults). Two production generators ride it:
`gen-kotlin` (DTOs incl. the sealed-interface `oneOf` mapping,
enrichment-asserted union hints, model renames via `name`, KDoc, and
dotted `scalars` values that wire their own imports — e.g.
`kotlinx.datetime.Instant`) and `gen-kotlin-spring` (per-tag
`<Tag>Service` seam + delegating `@RestController` in ONE file per
tag, `serviceMethodName` renames, seam parameter defaults, and the
generated `ApiError` + `@RestControllerAdvice` error channel). Named
follow-ups: operation projection-base veneers (the Spring generator
is accumulator-style and didn't need one — veneers are
demand-driven), serialization flavors beyond kotlinx
(`gen-kotlin-jackson`), WebFlux/`suspend`. Gotcha burned in (spec
28): the Driver wraps the PROJECTION, so value protocols
(`annotations`, `supertypes`, `description`) must be MIRRORED as
getters on the projection. One operational rule: generators sharing
this package in one composition must pin the SAME version — two
lang-kotlin copies in a module graph break cross-copy `instanceof`
checks (`KtFile`'s same-package import suppression), and module-scope
generator state splits across copies; the release cascade keeps peers
aligned.
