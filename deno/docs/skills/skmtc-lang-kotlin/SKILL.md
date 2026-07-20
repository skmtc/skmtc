---
name: skmtc-lang-kotlin
version: 0.4.0
description: |
  The Kotlin target-language layer for SKMTC generators
  (`@skmtc/lang-kotlin`). Covers how a generator declares Kotlin as its
  target language (importing `toKtModelProjectionBase` /
  `toKtOasOperationProjectionBase` and `KtSnippet` from the lang
  package), what the lang package exports (the `kotlin` Lang object,
  the register family, `KtFile` / `KtImport` / `KtDefinition`), the
  head+value rendering model, entity kinds and identifier factories,
  the import model of emitted Kotlin (packages from paths, symbol-level
  imports, same-package suppression, no type-only imports), the value
  composition classes (`KtParameterList`, `KtPrimaryConstructor`,
  `KtFunctionSignature`, `KtAnnotation`), and naming/sanitization
  (`sanitizePropertyName`, `toPackageName`, hard keywords like
  `object`).

  Use this skill alongside `skmtc-generator` whenever a generator emits
  Kotlin — and specifically when the user asks about "lang-kotlin",
  "KtSnippet", "data class generation", "sealed interface", "package
  directive", "backticks", "@SerialName"/"@JsonProperty" wiring,
  "KtAnnotation", or anything about the *shape of the emitted Kotlin*
  rather than engine behavior. Engine rules (Projections, Snippets,
  cross-generator coordination, variants) live in `skmtc-generator`.
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
> (`as` casts, `switch`+`never`, Valibot enrichments) live in
> `skmtc-generator`. This skill covers how the generator's *output* is
> shaped — files, packages, imports, declarations, naming — for
> generators whose target is Kotlin.

This skill follows the `skmtc-lang-<X>` template established by
`skmtc-lang-typescript`: the same seven section headings, with Kotlin's
answers. Read §2 first if you read only one section — the **head +
value rendering model** is the intuition every other rule falls out of.

## 1. Package surface

`@skmtc/lang-kotlin` exports:

| Export | What it is |
|---|---|
| `kotlin` | The `Lang` object. Three neutral factories the engine's **Drivers** call, reading it ephemerally off the projection class's inherited static (`projection.lang`): `createFile`, `toDefinition`, `toImport` (+ the identifier-assembly seam `toIdentifier`). Generators never call it |
| `KtSnippet` | The snippet base — where Kotlin enters the DSL class hierarchy. Carries the static `lang`; its `register` / `defineAndRegister` methods are typed by the concise vocabulary. Registering snippets are **keyless** (`generatorKey` is optional attribution input) and always pass an explicit `destinationPath` |
| `toKtModelProjectionBase` / `toKtOasOperationProjectionBase` | The projection-base veneers over core's factories — pre-bind `KtSnippet` as the factory's positional first argument and add own-file `register(args)` + explicit cross-file `registerInto(destinationPath, args)`. The config is core's `ModelProjectionBaseConfig<E, KtIdentifierType>` (etc.), so `toIdentifierType`'s return is compile-time bound to Kotlin's entity kinds |
| `register` / `defineAndRegister` | The register **functions** — convert the concise form, create the destination `KtFile` on first write, hand pure data to the neutral `context.register`. Transforms (closures with no class) import `defineAndRegister` directly. `register` throws on a cross-language file collision |
| `KtRegisterArgs` / `KtDefineAndRegisterArgs` | The concise register vocabulary: `imports` / `definitions` / `custom` (leading file content — see §3). Deliberately **no `reExports` field**: Kotlin has no re-exports, so a generator registering one is a compile-time error, not a runtime no-op |
| `KtFile` | `CodeFileBase` subclass — a Kotlin output file. Derives its `package` directive from its own export path (§5), sorts imports alphabetically, suppresses same-package imports, renders the `custom` slot above the `package` line |
| `KtImport` / `KtImportNameArg` / `KtImportSpecifier` | `ImportBase` subclass — symbol-level import statements with `as` aliases; no brace grouping, no type-only form (§3) |
| `KtDefinition` | `DefinitionBase` subclass — renders `${head}${value}` (declaration kinds) or `${head} = ${value}` (assignment kinds), plus the value-carried `KtAnnotated` / `KtDocumented` protocols above the line (§2, §4) |
| `KtIdentifier` / `isKtIdentifier` / `KtIdentifierType` / `KtIdentifierArgs` | Kotlin's concrete `IdentifierBase`: carries the typed `type: KtEntityType` and renders its own **declaration head** — `[private ]<keyword> <name>[: <typeName>]` |
| `createClass` / `createDataClass` / `createEnumClass` / `createInterface` / `createSealedInterface` / `createTypeAlias` / `createValue` | The identifier factories — one per entity kind (§2) |
| `KtEntityType` / `isKtEntityType` / `toKtEntityType` | The entity-kind vocabulary, its guard, and the throw-narrowing of the engine's opaque `type` string |
| `KtParameterList` | Primary-constructor parameter list, **parentheses included** (§4) |
| `KtPrimaryConstructor` | Constructor modifiers + the explicit `constructor` keyword rule (§4) |
| `KtFunctionSignature` / `KtFunctionParameter` | Method signatures for interface/class bodies — annotations, KDoc, expression bodies, parameter defaults (§4) |
| `KtAnnotation` / `KtAnnotations` / `toKtAnnotations` / `KtAnnotated` | Annotation rendering + the self-registering import (§3, §4) |
| `KtDocumented` / `isKtDocumented` | The value-carried KDoc protocol (§4) |
| `withDescription` | Wraps a rendered declaration in a KDoc comment block |
| `sanitizePropertyName` | Kotlin/JVM property-name sanitization — backtick escaping, hard keywords (§5) |
| `toPackageName` | `@/`-export-path → dotted package, with segment validation (§5) |
| `ktHardKeywords` / `isKtIdentifierName` | The validation primitives behind the two above |
| `langId` | `'kotlin'` |
| `fileExtensions` | `['.kt']` |

### Wiring — the import graph declares the language

```ts fragment
// gen-x/src/base.ts — the language enters HERE, through the import
import { toKtModelProjectionBase } from '@skmtc/lang-kotlin'
import { emptyEnrichmentSchema } from '@skmtc/core'
import denoJson from '../deno.json' with { type: 'json' }

export const KtModelBase = toKtModelProjectionBase({
  id: denoJson.name,
  // Pure — the cache-key name. For DTO generators the refName IS the class name.
  toIdentifierName: ({ refName }) => refName,
  // Context-aware — the declaration kind, derived from the schema on cache-miss.
  // Return type is KtIdentifierType: `type` is compile-checked against §2's vocabulary.
  toIdentifierType: (refName, context) => {
    const schema = context.resolveSchemaRefOnce(refName, denoJson.name)
    return { type: schema.type === 'object' ? 'data-class' : 'typealias' }
  },
  // The export path doubles as the package — `@/models/…` → `package models` (§5).
  toExportPath: ({ refName }) => `@/models/${refName}.generated.kt`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})
```

```ts fragment
// gen-x/src/KtModel.ts — the per-schema Projection
import type { ModelProjectionArgs } from '@skmtc/core'
import { KtAnnotation } from '@skmtc/lang-kotlin'
import { KtModelBase } from './base.ts'
import { DataClassValue } from './DataClassValue.ts'

export class KtModel extends KtModelBase {
  // Class-level annotations — the KtAnnotated protocol (§4). The Driver
  // wraps THIS instance in the Definition, so the projection IS the
  // definition's value and the protocol field lives directly on it:
  // KtDefinition reads it as `this.value.annotations`.
  annotations: KtAnnotation[]
  value: DataClassValue

  constructor({ context, settings, refName }: ModelProjectionArgs) {
    super({ context, settings, refName })

    const schema = context.resolveSchemaRefOnce(refName, KtModel.id)

    this.annotations = [
      new KtAnnotation({
        context,
        name: 'JsonIgnoreProperties',
        args: ['ignoreUnknown = true'],
        packageName: 'com.fasterxml.jackson.annotation',
        destinationPath: settings.exportPath
      })
    ]

    this.value = new DataClassValue({
      context,
      schema,
      destinationPath: settings.exportPath // snippets/leaves always get the parent's file
    })
  }

  toString(): string {
    return `${this.value}`
  }
}
```

```ts fragment
// gen-x/src/mod.ts — the entry is pure pipeline config; no language anywhere
import { toModelEntry } from '@skmtc/core'
import denoJson from '../deno.json' with { type: 'json' }
import { KtModel } from './KtModel.ts'

export const ktModelEntry = toModelEntry({
  id: denoJson.name,
  transform({ context, refName }) {
    context.insertModel(KtModel, refName)
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})
```

A generator declares its language **only** by importing its
projection-base veneer (and, for registering snippets, `KtSnippet`)
from this package. The language rides the class hierarchy as the
static `lang` on `KtSnippet`; the engine's Drivers read it ephemerally
off the projection class when they need to create a file or build a
Definition. Nothing else changes versus a TypeScript generator: the
same entry factories, the same engine calls — `insertModel(Peer,
refName)` for a named `$ref`, `insertNormalizedModel(Peer, { schema,
fallbackName })` for a schema that may be inline or a ref,
`findDefinition` to read the cache — the same `ContentSettings`. All
engine-side, all in `skmtc-generator`; do not re-derive them from core
source.

Generators normally never construct `KtFile` / `KtDefinition` /
`KtImport` directly — this package's register functions and the
engine's Drivers build them. If you find yourself writing
`new KtImport(...)` in a generator, you almost certainly wanted
`this.register({ imports })`.

The package dependency (both required, **same `lang-kotlin` pin in
every package of the stack** — see §6):

```jsonc
// gen-x/deno.json#imports
{
  "@skmtc/core": "jsr:@skmtc/core@<pin>",
  "@skmtc/lang-kotlin": "jsr:@skmtc/lang-kotlin@<pin>"
}
```

## 2. Entity kinds & identifiers

Kotlin output has seven entity kinds (`KtEntityType`), created via the
identifier factory functions exported by this package. **The identifier
renders its own declaration head; the value renders everything after
it.** `KtDefinition` composes the two without inspecting either:

```text
declaration kinds:  ${head}${value}       class | data-class | enum-class | interface | sealed-interface
assignment kinds:   ${head} = ${value}    typealias | val
```

| Factory | Head rendered | The value then renders |
|---|---|---|
| `createClass('UsersService')` | `class UsersService` | `${primaryConstructor}${supertypeClause}${body}` |
| `createDataClass('User')` | `data class User` | `${parameterList}${supertypeClause}` |
| `createEnumClass('Status')` | `enum class Status` | ` {\n    ACTIVE,\n    …\n}` |
| `createInterface('UsersApi')` | `interface UsersApi` | ` {\n${signatures}\n}` |
| `createSealedInterface('Animal')` | `sealed interface Animal` | usually nothing — the bodyless idiom |
| `createTypeAlias('UserList')` | `typealias UserList` | the right-hand side (`List<User>`) |
| `createValue('timeout', { typeName: 'Long' })` | `val timeout: Long` | the right-hand side expression |

The consequences, each a rule you'd otherwise rediscover:

- **A value's `toString()` starts where the head ends.** For a data
  class that means the parameter list (parens included, §4); for an
  enum/interface it means the braced body *including* the leading
  ` {`; for a sealed interface it is typically the empty string —
  an empty render IS how `sealed interface Animal` gets its bodyless
  form. Never render the keyword, the name, or `data class` inside a
  value.
- **Visibility is the identifier's fact.** Kotlin defaults to public,
  so `exported: true` (the default) renders nothing and
  `createDataClass('User', { exported: false })` renders
  `private data class User`. There is no `noExport` on this package's
  definition/register args — the neutral Driver-level `noExport` flag
  is folded into a restricted identifier copy at the `Lang.toDefinition`
  boundary, and in-generator code passes `exported: false` to the
  factory instead.
- **The `typeName` slot is the `val x: T` annotation** — only
  `createValue` takes it. It is part of the head, not the value.
- `isKtIdentifier` narrows a neutral `IdentifierBase` back to
  `KtIdentifier`; `toKtEntityType` / `isKtEntityType` narrow the
  engine's opaque `type` string. Generators rarely call either — the
  veneer's `ModelProjectionBaseConfig<E, KtIdentifierType>` makes
  `toIdentifierType`'s return compile-checked, and a foreign
  identifier fails loudly at the Generate boundary.
- Unlike TypeScript, the entity kind does **not** drive import form —
  every Kotlin import is `import pkg.Name`. It drives only the
  declaration shell. Kinds not yet in the vocabulary (`object`, `fun`,
  `var`) arrive with the milestones that need them; `toKtEntityType`
  throwing on them is the desired behavior until then.

## 3. The import model of emitted Kotlin

Generators register imports in the concise form (`KtImportNameArg`);
the register function converts them to `KtImport`s at the boundary:

```ts fragment
this.register({
  imports: {
    // dotted package — external libraries
    'com.fasterxml.jackson.annotation': ['JsonProperty', 'JsonSubTypes'],
    // @/-export path — project files (rarely hand-written: the Driver
    // registers peer imports for you on insertModel/insertOperation)
    '@/models/Role.generated.kt': ['Role'],
    // symbol-level alias — Kotlin's `as`
    'kotlinx.serialization.json': [{ name: 'Json', alias: 'KJson' }]
  }
})
```

Rendering rules `KtFile` / `KtImport` apply (authors never hand-write
these):

- **One statement per symbol** (`import kotlinx.serialization.Serializable`)
  — Kotlin has no brace grouping. Imports render **sorted
  alphabetically**, so registration order cannot leak into output.
- **No type-only imports.** `KtImportNameArg` has no `type` tag —
  the TS1484 discipline from lang-typescript has no Kotlin
  counterpart. If you find yourself tagging imports, you're writing a
  TypeScript instinct into a Kotlin generator.
- **Path-form modules resolve to packages at render.**
  `'@/models/Role.generated.kt'` → `import models.Role` via
  `toPackageName` (§5). The Driver passes exactly this form for
  cross-file peer imports.
- **Same-package imports are suppressed centrally.** A symbol in the
  destination file's own package needs no import in Kotlin, and
  `KtFile` drops it at render. Over-registering is therefore harmless
  — callers never need a same-package check. The single-file
  consequence: in a generator that registers every model into ONE
  file (the DTO-file idiom), peer references need **no import wiring
  at all** — get the peer's name through the `insertModel` handle
  (`.toName()`, per `skmtc-generator` §4) and interpolate it; there
  is no circular-import hazard to design around, since Kotlin
  same-file declarations reference each other freely.
- **Importing from the default package throws.** Kotlin cannot import
  a root-level (package-less) symbol from a packaged file; hitting
  this means a generator's path policy put an artifact at `@/<Name>.kt`
  that packaged files reference — give the artifact a package path.
- **Re-exports don't exist.** No barrels, no `reExports` field. The
  absence is compile-time by design.

### Annotation imports — the self-registering leaf

The dominant import in generated Kotlin is an annotation class.
`KtAnnotation` makes the annotation and its import **one statement**
(the `TsHeritage` registering-leaf pattern), so they cannot drift
apart:

```ts fragment
new KtAnnotation({
  context,
  name: 'JsonProperty',
  args: ['"user_id"'],
  packageName: 'com.fasterxml.jackson.annotation', // self-registers the import
  destinationPath                                  // always explicit — the parent knows its file
})
// renders: @JsonProperty("user_id")
// registers: import com.fasterxml.jackson.annotation.JsonProperty
```

Omit `packageName` for default-scope annotations (`@Deprecated`,
`@Suppress` — `kotlin.*` needs no import): the annotation then only
renders. Never pair a `KtAnnotation` with a separate manual
`register({ imports })` for the same class (§6).

The self-registration covers the annotation's **own** class only.
When the annotation's *arguments* name a second symbol —
`@JsonSerialize(using = MoneyStringSerializer::class)`,
`@field:JsonDeserialize(using = MoneyStringDeserializer::class)` —
that symbol needs its own `register({ imports })` alongside the
annotation (the args are opaque `Stringable`s; nothing parses class
references out of them). One annotation, two imports. Exception:
when the referenced class lands in the destination file's own
package, same-package suppression (§3) makes the extra register
unnecessary — though registering it anyway is harmless.

### Leading file content — the `custom` slot

`KtRegisterArgs.custom` sets the destination file's neutral `custom`
slot (`FileBase.custom`), rendered **above the `package` directive**
(only comments may precede `package` in Kotlin) — e.g. a
generated-file attribution banner. Same placement and semantics as
`TsFile`: last non-`undefined` write wins.

## 4. Syntax helpers

The composable value classes a declaration-kind value interpolates.
All return `Stringable`-compatible values that compose in template
literals; **plain Kotlin syntax carries no grammar rule worth a
class**, so supertype clauses (` : Animal`) and braced bodies
(` {\n…\n}`) are written inline in the value's `toString()`.

| Helper | Renders | The grammar rule it owns |
|---|---|---|
| `KtParameterList` | `(\n    @Anno\n    val id: String,\n    val email: String? = null\n)` | Parentheses included; each parameter a `val` property with annotations one per line above it, `private/protected/internal` visibility, `?` nullability, ` = default` |
| `KtPrimaryConstructor` | `(…)` or ` @Anno private constructor(…)` | Modifiers force Kotlin's explicit `constructor` keyword; without modifiers it renders just the parameter list |
| `KtFunctionSignature` | `    @GetMapping("/users/{id}")\n    fun getUsersId(@PathVariable("id") id: String): User` | Method signatures inside interface/class bodies: per-signature KDoc + annotations, abstract by default, expression body via `body` (` = …` — block bodies deliberately unsupported), implicit `Unit` when `returnType` omitted |
| `KtFunctionParameter` | `@RequestParam("verbose") verbose: Boolean? = null` | One signature parameter — annotations, nullability, defaults |
| `KtAnnotations` (via `toKtAnnotations(value)`) | One annotation per line + trailing newline; empty renders `''` | The class-level annotation block above a declaration |
| `withDescription(value, { description })` | `/** … */\n${value}` | KDoc — Kotlin's block-comment syntax is JSDoc-identical; multi-line descriptions get ` * ` margins |

The exact constructor shapes — **these are complete**, and the
**generated API appendix** at the end of this skill carries the full
`deno doc` surface of the whole package (every export, exact argument
shapes, generated from source — it cannot drift). Between this section
and the appendix there is nothing left to learn from pre-reading the
package source; verify with `deno check` after scaffolding instead:

```ts fragment
// KtParameterList — new KtParameterList(parameters: KtParameterArgs[])
type KtParameterArgs = {
  name: string                // FINAL name — already sanitized, may be backticked
  type: Stringable
  nullable?: boolean          // renders `Type?`
  defaultValue?: Stringable   // renders ` = …` (e.g. 'null')
  annotations?: KtAnnotation[]           // inline, before `val`
  visibility?: 'private' | 'protected' | 'internal'  // absent = public
}

// KtAnnotation — new KtAnnotation(args: KtAnnotationArgs)
type KtAnnotationArgs = {
  context: GenerateContextType
  name: string
  args?: Stringable[]         // pre-quoted, rendered inside `(…)`; omitted → bare @Name
  packageName?: string        // self-registers the import; omit for kotlin.* scope
  destinationPath: string     // always explicit — the parent knows its file
}

// KtFunctionSignature — new KtFunctionSignature(args)
type KtFunctionSignatureArgs = {
  name: string
  parameters: KtFunctionParameterArgs[]  // { name, type, nullable?, defaultValue?, annotations? }
  returnType?: Stringable     // omitted → implicit Unit
  annotations?: KtAnnotation[]
  description?: string        // KDoc above the annotations
  body?: Stringable           // expression body ` = …`; absent → abstract form
}

// KtPrimaryConstructor — new KtPrimaryConstructor(args)
type KtPrimaryConstructorArgs = {
  parameters: Stringable      // typically a KtParameterList (owns its parens)
  modifiers?: Stringable[]    // e.g. annotations / 'private' — forces `constructor` keyword
}

// Identifier factories — createDataClass(name, { exported?: boolean })
// (all kinds; only createValue adds { typeName?: string })
```

```text
data class value:   `${parameterList}${supertypes.length ? ` : ${supertypes.join(', ')}` : ''}`
class value:        `${primaryConstructor} : ${supertype} {\n${body}\n}`
enum class value:   ` {\n    ${members.join(',\n    ')}\n}`
interface value:    ` {\n${signatures.join('\n\n')}\n}`
sealed interface:   ``                                      ← the bodyless idiom
typealias / val:    the right-hand-side expression
```

### The `oneOf` → sealed interface recipe

The Kotlin idiom for a discriminated `oneOf` (`Animal` = `Dog | Cat`,
discriminated by `petType`) is a sealed parent plus supertyped
members. The pattern: **the union assigns membership to its members**
— a member schema does not know it is in a union and behaves as if it
is not.

- **Members** carry two generator-owned seams, empty by default:
  `supertypes: Stringable[]` and `omittedProperties: Set<string>`.
  Their value renders `` supertypes.length ? ` : ${supertypes.join(', ')}` : '' ``
  after the parameter list and filters omitted properties — so a
  standalone schema renders exactly as before.
- **Parent**: `createSealedInterface(refName)` with a value that
  renders `''` — the bodyless idiom gives `sealed interface Animal`.
  (Serialization annotations on the parent — `@JsonTypeInfo` /
  `@JsonSubTypes`, `@Serializable` — are generator policy via the
  `KtAnnotated` protocol.) Its constructor inserts each `$ref` member
  and assigns:

  ```ts fragment
  schema.members.forEach(member => {
    if (!member.isRef()) return
    const inserted = context.insertModel(KtModel, member.toRefName())
    inserted.definition.value.supertypes.push(refName)
    const tag = schema.discriminator?.propertyName
    if (tag) inserted.definition.value.omittedProperties.add(tag)
  })
  ```

- **Order cannot matter**: inserts are idempotent and memoized, so
  member-first and union-first visits converge on one instance, and
  generate completes before render — pinned by core's
  `GenerateContext.insert-mutation.test.ts`. Assign during generate
  only; `toString()` stays a pure read of the seams. Multi-union
  membership composes (` : A, B`) for free.
- This is generator-owned state, NOT a lang protocol — the old
  `KtSupertyped` render protocol stays gone. The
  `skmtc create … --lang kotlin` scaffold is a deliberate skeleton
  and does NOT ship this pattern — this section is the canonical
  recipe; implement it in your generator.

### The value protocols — what renders *above* the declaration

The neutral `Lang.toDefinition` call the Drivers make has no
annotations or description slot, so both ride on the **value** and
`KtDefinition` collects them at render:

- **`KtAnnotated`** — a value with an `annotations: KtAnnotation[]`
  field. `toKtAnnotations(value)` collects it into a `KtAnnotations`
  block rendered one-per-line above the head.
- **`KtDocumented`** (guard: `isKtDocumented`) — a value with a
  `description?: string` field, rendered as KDoc above the
  annotations. An explicit `description` passed to `KtDefinition` /
  `defineAndRegister` wins over the protocol.

Both protocols are read off the **definition's value** —
`thing.value.annotations` / `thing.value.description` — and that is
the only place they live. For a `defineAndRegister` call the value is
the object you passed (the worked example below). For a **Projection**,
the Driver wraps the projection instance itself in the Definition —
the projection IS the definition's value, so declare `annotations` /
`description` **directly on the projection** (the §1 scaffold). Do
not bury them inside an inner value object and mirror them out —
neither a getter (`get annotations() { … }` — a method, breaking the
producer contract) nor a copied field
(`this.annotations = this.value.annotations` — the same fact in two
places). One protocol field, on the object the Definition wraps.

### Worked example — a serializable DTO, end to end

```ts
import type { GenerateContextType } from '@skmtc/core'
import {
  KtAnnotation,
  KtParameterList,
  createDataClass,
  defineAndRegister
} from '@skmtc/lang-kotlin'

type UserValueArgs = {
  context: GenerateContextType
  destinationPath: string
}

// A value class: renders ONLY what follows the head. The `annotations`
// field is the KtAnnotated protocol — collected by KtDefinition.
class UserValue {
  annotations: KtAnnotation[]
  parameters: KtParameterList

  constructor({ context, destinationPath }: UserValueArgs) {
    this.annotations = [
      new KtAnnotation({
        context,
        destinationPath,
        name: 'Serializable',
        packageName: 'kotlinx.serialization'
      })
    ]

    this.parameters = new KtParameterList([
      {
        name: 'userId',
        type: 'String',
        annotations: [
          new KtAnnotation({
            context,
            destinationPath,
            name: 'SerialName',
            args: ['"user_id"'],
            packageName: 'kotlinx.serialization'
          })
        ]
      },
      { name: 'name', type: 'String' },
      { name: 'email', type: 'String', nullable: true, defaultValue: 'null' }
    ])
  }

  toString(): string {
    return `${this.parameters}`
  }
}

export const writeUser = (context: GenerateContextType): void => {
  const destinationPath = '@/com/example/api/User.generated.kt'

  defineAndRegister(context, {
    identifier: createDataClass('User'),
    value: new UserValue({ context, destinationPath }),
    destinationPath
  })
}
```

Renders — package from the path, imports self-registered by the
annotations, annotation block from the protocol, head from the
identifier, parens from the parameter list:

```kotlin
package com.example.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    @SerialName("user_id")
    val userId: String,
    val name: String,
    val email: String? = null
)
```

*Which* annotations to emit (`kotlinx.serialization` vs Jackson vs
none) is generator policy — this package renders what it is handed and
never names a serialization library.

## 5. Naming & sanitization

- **The export path IS the package.** `KtFile` derives its `package`
  directive from its own export path: the segments after `@/` are the
  package directories (`@/com/example/api/User.generated.kt` →
  `package com.example.api`; `@/models/User.generated.kt` →
  `package models`). `client.json#settings.basePath` points at the
  Gradle source root (e.g. `consumer/src/main/kotlin`), completing
  Kotlin's package-=-folder convention. So a generator's
  `toExportPath` is also its package policy — there is no separate
  package knob.
- **Path segments must be valid package parts.** `toPackageName`
  throws when a directory segment is not a plain Kotlin identifier or
  is a hard keyword — `@/my-models/User.kt` (hyphen) or
  `@/object/User.kt` (keyword) cannot map to a package. Loud beats
  backticked package names. A root-level path (`@/Scratch.kt`) is the
  default package: legal, discouraged, renders no `package` line, and
  cannot be imported from (§3).
- **Multi-package output** (`client.json#settings.packages`): export
  paths are forward paths under a package's `rootPath`
  (`my-sdk-core/src/main/kotlin/com/example/User.kt`), and the package
  is derived with the owning `rootPath` stripped. Each `rootPath` is
  that module's Gradle source root, exactly as `basePath` is in
  single-package mode. Cross-module imports resolve to the target
  module's real dotted package.
- **`sanitizePropertyName(name)`** — makes a property name safe as a
  Kotlin declaration name. Plain identifier → as-is; hard keyword
  (`object`, `val`, …) or invalid name (`user name`, `1st`) →
  backticked (`` `object` ``); a name backticks cannot save (contains
  `.` `;` `:` `/` `\` `[` `]` `<` `>` a backtick or newline — illegal
  on the JVM even escaped) → throws. Returns a plain `string` (no
  quoted-property fallback exists in Kotlin).
- **Escaping is lang-side backticks; renames are gen-side
  annotations.** The two compose, and the split decides your
  snake_case strategy: keep the wire name and backtick if needed
  (`` `object` `` still equals its wire name — no annotation), or
  rename to camelCase and annotate
  (`@SerialName("user_id") val userId`). Renaming is generator
  policy; this package only guarantees the chosen name parses.
- **File naming**: `.kt` extension; the engine injects the
  generated-file infix (`client.json#settings.generatedSuffix`,
  default `'.generated'`) into `toExportPath` before the extension —
  `User.kt` lands as `User.generated.kt`, idempotently, exactly as
  for any language. Keep the convention for ordinary output; when the
  consumer requires an exact filename (recreating a hand-written
  file the app compiles against), set
  `client.json#settings.generatedSuffix: ""` rather than fighting
  the suffix in the path policy. Class names come from the refName;
  the engine's cache keys on `(identifier.name, exportPath)`.

## 6. Kotlin-output anti-patterns

- **Baking the head into the value** — a value `toString()` returning
  `data class User(…)` or `private class Foo`. The identifier renders
  the keyword, name, visibility, and `: TypeName`; the definition adds
  `${head}` — doubling them emits `data class User data class User(…)`.
  Return only what follows the head (§2).
- **Adding delimiters outside the value** — wrapping a value in
  `(${value})` or `{ ${value} }` at the call site. Values own their
  delimiters: `KtParameterList` brings its parens, a body value brings
  its ` {\n…\n}`. If the output is missing parens, fix the value, not
  the caller.
- **A manual import register next to a `KtAnnotation`** — registering
  `imports: { 'com.fasterxml.jackson.annotation': ['JsonProperty'] }`
  by hand while also constructing the annotation. Pass `packageName`
  to the annotation and delete the manual register; two statements
  drift apart (§3).
- **Hand-rendering import or package statements in template
  literals** — they land in the file *body* (invalid Kotlin below the
  real header) and bypass sorting, dedup, and same-package
  suppression. `KtFile` owns the header; generators only register.
- **Type-tagging imports or building barrels** — TypeScript instincts
  with no Kotlin counterpart: no type-only imports, no re-exports.
  The vocabulary omits both; don't emulate them with strings.
- **Faking raw file content as a definition** — an identifier whose
  name never appears in the emitted code nullifies what an identifier
  is. A leading banner belongs on the register vocabulary's `custom`
  slot (§3); whole-file static content is a FILE fact, not a
  definition.
- **Producer logic in private methods** — a `private
  toAnnotations()` on a value class or projection breaks the
  constructor + `toString()` contract exactly as a public method
  does (`skmtc-generator` §2: private helpers and accessors count).
  Annotation-building and union-membership branching belong in
  module-level free functions taking `{ context, … }` that construct
  `KtAnnotation` / snippet leaves — the leaves then self-register
  their imports.
- **Mirroring protocol fields** — a getter
  (`get annotations() { return this.value.annotations }` — a method;
  producers are constructor + `toString()` only, and the structural
  eval's method-discipline check counts accessors) or a copied field
  (`this.annotations = this.value.annotations` — the same fact in two
  places). Both mean the annotations were declared one level too deep:
  the protocol is read off the definition's value, so declare it
  directly on the object the Definition wraps — the projection itself
  when Driver-inserted (§4).
- **Running a formatter over the output** — render is unformatted by
  design; the consumer's ktfmt/ktlint formats. Trailing commas,
  line-wrapping, and indentation niceties are their territory.
- **Mismatched `lang-kotlin` pins across the stack** — two copies of
  the package (e.g. a local generator pinning a different version
  than a JSR peer) break cross-copy `instanceof`: `KtFile` /
  `KtIdentifier` checks fail in ways that look like engine bugs. Every
  package in one build must pin the SAME `@skmtc/lang-kotlin` version.
- **Export paths that cannot be packages** — `@/my-models/…`,
  `@/models/v1.2/…`, a hard-keyword segment. `toPackageName` throws at
  render, far from the `toExportPath` that caused it; fix the path
  policy (§5).

## 7. Boundary with other skills

- **`skmtc-generator`** — everything engine-side: Projections vs
  Snippets, `transform` returning void, `insertModel` /
  `insertOperation` / `findDefinition`, the constructor/`toString()`
  contract, enrichments, variants, cross-generator coordination. If
  the question is "how do generators work", it's there; if it's "what
  does the emitted Kotlin look like", it's here.
- **`skmtc-cli`** — install/bundle/generate commands, registering a
  local generator in a workspace.
- **`skmtc-debug`** — broken output, verify-first stance.
- **`skmtc-lang-typescript`** — the TypeScript counterpart and the
  template this skill follows; useful contrastively (type-only
  imports, re-exports, and quoted-property fallbacks exist THERE, not
  here).

### Status note

Current model: the **head+value rewrite** — the identifier renders its
declaration head, the value renders everything after it, and the
former `KtSupertyped` / `KtConstructed` value protocols and the
`verbatim` identifier kind are gone (historical: supertype clauses and
braced bodies are now written inline; primary constructors compose
`KtPrimaryConstructor`; raw file content goes through the `custom`
slot). `KtFile.header` / `fileHeader` were superseded by `custom`.
The package lives at `deno/lang-kotlin` (see its `deno.json` for the
current version; released through the workspace cascade against the
pinned `@skmtc/core`). Proving generators: the `gen-kotlin*` family —
being rewritten onto this model; the migration log is
`notes/lang-v2/02-lang-kotlin-changes-for-generator-rewrite.md`.

<!-- api-appendix:begin — GENERATED, do not edit by hand -->

## Appendix — generated API reference

> Generated from framework source at `eb16419c` by
> `deno run --allow-read --allow-write --allow-run=deno,git .scripts/generate-skill-api-appendix.ts`
> (from `deno/`). **Authoritative** for signatures, fields, and doc
> comments — trust it instead of re-reading package source. For a
> symbol not listed here, `deno doc <file> <Symbol>` against the
> framework source beats grepping it.

### `@skmtc/lang-kotlin` — the full exported surface

Every export of the package, with exact constructor/argument shapes. The prose sections above explain how the pieces compose; this is the complete signature-level truth.

### `lang-kotlin/mod.ts`

```text
@module
    @skmtc/lang-kotlin

    The Kotlin target-language layer for SKMTC generators.

    Status: production (Phase D + the Kotlin milestone arc complete).
    The full register/write path on the frozen language seam: the
    `kotlin` {@link Lang} object,
    `KtSnippet` (static `lang`, keyless registers), the register family
    (`register`/`defineAndRegister` + `KtRegisterArgs` — deliberately no
    `reExports` field), the projection-base veneers (model + OAS
    operation), `KtFile` (path-derived `package` directive, sorted imports,
    same-package suppression), `KtImport` (symbol-level, `as` aliases),
    `KtDefinition` (head + value rendering — the identifier renders its
    declaration head, the value renders everything after it via
    `KtParameterList` / `KtPrimaryConstructor` plus inline supertype
    clauses and ` {\n…\n}` bodies; the `KtAnnotated` / `KtDocumented`
    value protocols cover what renders above the declaration), the
    function-signature grammar (`KtFunctionSignature` /
    `KtFunctionParameter` — interface/class methods incl. KDoc,
    expression bodies, and parameter defaults), the identifier
    factories, `sanitizePropertyName`
    (hard keywords + backticks), and `toPackageName` (segment-validated).

    Grammar only: serialization flavor (kotlinx annotations) is generator
    policy — `@skmtc/gen-kotlin` is the proving generator. Architecture
    spec: `notes/lang/19-kotlin-architecture.md`. Template:
    `@skmtc/lang-typescript`.


Defined in deno/lang-kotlin/src/createIdentifier.ts:84:14

function createClass(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates a concrete `class` identifier.

  @example
      ```typescript
      const controller = createClass('UsersController')
      // KtDefinition renders: class UsersController(…) { … }
      ```


Defined in deno/lang-kotlin/src/createIdentifier.ts:97:14

function createDataClass(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates a `data class` identifier.

  @example
      ```typescript
      const user = createDataClass('User')
      // KtDefinition renders: data class User(…)
      ```


Defined in deno/lang-kotlin/src/createIdentifier.ts:110:14

function createEnumClass(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates an `enum class` identifier.

  @example
      ```typescript
      const status = createEnumClass('Status')
      // KtDefinition renders: enum class Status { … }
      ```


Defined in deno/lang-kotlin/src/createIdentifier.ts:123:14

function createInterface(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates an `interface` identifier.

  @example
      ```typescript
      const usersApi = createInterface('UsersApi')
      // KtDefinition renders: interface UsersApi { … }
      ```


Defined in deno/lang-kotlin/src/createIdentifier.ts:136:14

function createSealedInterface(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates a `sealed interface` identifier.

  @example
      ```typescript
      const animal = createSealedInterface('Animal')
      // KtDefinition renders: sealed interface Animal
      ```


Defined in deno/lang-kotlin/src/createIdentifier.ts:152:14

function createTypeAlias(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates a `typealias` identifier.

  @example
      ```typescript
      const userList = createTypeAlias('UserList')
      // KtDefinition renders: typealias UserList = …
      ```


Defined in deno/lang-kotlin/src/createIdentifier.ts:172:14

function createValue(name: string, args: CreateValueArgs): KtIdentifier
  Creates a top-level `val` identifier — Kotlin's distinctive file-scope
  value.

  @example
      Untyped value

      ```typescript
      const maxRetries = createValue('MAX_RETRIES')
      // KtDefinition renders: val MAX_RETRIES = …
      ```

  @example
      Typed value

      ```typescript
      const timeout = createValue('timeout', { typeName: 'Long' })
      // KtDefinition renders: val timeout: Long = …
      ```


Defined in deno/lang-kotlin/src/register.ts:102:14

function defineAndRegister<Value extends GeneratedValue>(context: GenerateContextType, {identifier, value, destinationPath, description}: KtDefineAndRegisterArgs<Value>): KtDefinition<Value>
  Build a {@link KtDefinition} from `value` and register it at
  `destinationPath`. The transform-level counterpart of
  `this.defineAndRegister` — a transform (a closure with no class) imports
  this directly; the language comes from the import, like everything else.

  No cache check — callers wrap with `context.findDefinition` first where
  dedup is wanted (the gen-msw accumulator pattern).

Defined in deno/lang-kotlin/src/KtDocumented.ts:19:14

function isKtDocumented(value: unknown): value is KtDocumented
  Type guard for the {@link KtDocumented} protocol — narrows without casts.

Defined in deno/lang-kotlin/src/createIdentifier.ts:53:14

function isKtEntityType(type: string): type is KtEntityType
  Type guard — whether an opaque `type` string is one this language knows.

Defined in deno/lang-kotlin/src/KtIdentifier.ts:83:14

function isKtIdentifier(identifier: IdentifierBase): identifier is KtIdentifier
  Type guard narrowing a neutral {@link IdentifierBase} to a
  {@link KtIdentifier} — the cast-free way the renderer reads `type`.

Defined in deno/lang-kotlin/src/hardKeywords.ts:54:14

function isKtIdentifierName(name: string): boolean
  Whether `name` is a plain (unescaped) Kotlin identifier: a letter or
  underscore followed by letters, digits, or underscores. Deliberately
  ASCII-conservative — Kotlin permits unicode letters, but anything
  outside ASCII gets the backtick treatment from
  {@link import('./sanitizePropertyName.ts').sanitizePropertyName},
  which is always safe.

  Note this is a SYNTAX check only — a hard keyword like `object`
  matches the regex but still needs escaping. Callers check
  {@link ktHardKeywords} separately.

Defined in deno/lang-kotlin/src/register.ts:49:14

function register(context: GenerateContextType, args: KtRegisterArgs & { destinationPath: string; }): void
  Kotlin's register function — the single implementation behind
  {@link KtSnippet.register} and the projection-base veneers.

  Converts the concise import form into {@link KtImport} objects, creates
  the destination {@link KtFile} on first write (caller-side creation —
  the language is right here), and hands pure data to the neutral
  `context.register`. No `generatorId`, no `Lang` object: the language is
  this module. Throws when the destination file exists but was created by
  another language — a cross-language collision is a misconfiguration,
  refused loudly rather than mixing Kotlin content into a foreign file.

Defined in deno/lang-kotlin/src/sanitizePropertyName.ts:27:14

function sanitizePropertyName(propertyName: string): string
  Makes a property name safe as a Kotlin declaration name.

  - A plain identifier that is not a hard keyword → returned as-is.
  - A hard keyword (`object`, `val`, …) or a syntactically invalid name
    (`user name`, `1st`) → backtick-escaped (``object``).
  - A name that backticks cannot save (contains `.`, `;`, `:`, `/`,
    `\`, `[`, `]`, `<`, `>`, a backtick, or a newline — illegal on the
    JVM even escaped) → throws. Generators camelCase wire names before
    calling this, so reaching the throw means a naming policy bug, not
    a schema problem.

  Renames are deliberately NOT this function's job: wire-name mismatches
  are handled gen-side via serialization annotations (`@SerialName`);
  this function only guarantees the chosen name parses. The two compose
  — a backticked keyword (``object``) still equals its wire name, so
  it needs no annotation.

  Returns a plain `string` (unlike the TypeScript version's key-value
  fallback — Kotlin has no quoted-property syntax to fall back to).

Defined in deno/lang-kotlin/src/KtAnnotation.ts:121:14

function toKtAnnotations(value: unknown): KtAnnotations
  Collect a value's {@link KtAnnotated} protocol field into a
  {@link KtAnnotations} block — empty when the value carries none, so the
  caller renders it without a guard.

Defined in deno/lang-kotlin/src/createIdentifier.ts:188:14

function toKtEntityType(type: string): KtEntityType
  Narrow the engine's opaque `type: string` (from `Lang.toIdentifier`'s
  neutral args) to this language's {@link KtEntityType} — cast-free, via
  {@link isKtEntityType}. Throws on a type outside the vocabulary, a loud
  signal that an identifier built for another language (or with a typo'd
  type) reached the Kotlin renderer. (Unlike TypeScript there is no
  keyword map here — the declaration keywords live on
  {@link import('./KtIdentifier.ts').KtIdentifier}'s declaration-head
  render, the only place they are used.)

Defined in deno/lang-kotlin/src/toKtModelProjectionBase.ts:32:14

function toKtModelProjectionBase<EnrichmentType = undefined>(config: ModelProjectionBaseConfig<EnrichmentType, KtIdentifierType>)
  Build a Kotlin model projection base class.

  Thin veneer over core's `toModelProjectionBase`: passes `KtSnippet` as the
  base (the hierarchy is language-bound at its root) and adds the register
  ergonomics core deliberately doesn't define — typed with Kotlin's concise
  vocabulary, which core can't name:

  - `register(args)` — own-file: `destinationPath` is always this
    projection's `settings.exportPath` (the foundation rule; never a
    fallback).
  - `registerInto(destinationPath, args)` — the explicit cross-file path.

  Both delegate to this package's register function — never
  `super.register` (lang-base members are type-erased on core's factory
  result).

  The config is core's `ModelProjectionBaseConfig` parameterized over
  {@link KtIdentifierType} (so `toIdentifierType` returns the `type` bound to
  `KtEntityType`). The base is the factory's first argument, not a config
  field.

  The companion operation veneer {@link toKtOasOperationProjectionBase} has
  arrived (the OAS veneer now exists, driven by gen-kotlin-sdk's Response
  models).

Defined in deno/lang-kotlin/src/toKtOasOperationProjectionBase.ts:31:14

function toKtOasOperationProjectionBase<EnrichmentType = undefined>(config: OasOperationProjectionBaseConfig<EnrichmentType, KtIdentifierType>)
  Build a Kotlin OAS operation projection base class — the first
  operation-keyed Kotlin projection family (demanded by
  gen-kotlin-sdk's Response models, arc note `32` §C4; earlier
  operation generators were accumulator-style and didn't need one).

  Thin veneer over core's `toOasOperationProjectionBase`: passes `KtSnippet`
  as the base (the hierarchy is language-bound at its root) and adds the
  register ergonomics core deliberately doesn't define — typed with Kotlin's
  concise vocabulary, which core can't name:

  - `register(args)` — own-file: `destinationPath` is always this
    projection's `settings.exportPath` (the foundation rule; never a
    fallback).
  - `registerInto(destinationPath, args)` — the explicit cross-file path.

  Both delegate to this package's register function — never
  `super.register` (lang-base members are type-erased on core's factory
  result).

  The config is core's `OasOperationProjectionBaseConfig` parameterized over
  {@link KtIdentifierType} (so `toIdentifierType` returns the `type` bound to
  `KtEntityType`). The base is the factory's first argument, not a config
  field.

Defined in deno/lang-kotlin/src/toPackageName.ts:27:14

function toPackageName(path: string, packages?: ModulePackage[]): string
  Derives the `package` directive from a Kotlin file's export path —
  the segments after the `@/` root ARE the package directories
  (Kotlin's package-=-folder convention; `client.json#settings.basePath`
  points at the Gradle source root, e.g. `./app/src/main/kotlin`).

  - `@/com/example/api/User.generated.kt` → `'com.example.api'`
  - `@/User.kt` → `''` (the default package — legal, discouraged;
    {@link import('./KtFile.ts').KtFile} renders no `package` line)

  Multi-package output (`client.json#settings.packages`): export paths
  are forward paths under a package's `rootPath`
  (`my-sdk-core/src/main/kotlin/com/example/User.kt`), and the package
  directories are the segments after the OWNING package's `rootPath` —
  pass `packages` and the longest matching `rootPath` prefix is
  stripped before derivation. Each `rootPath` is that module's Gradle
  source root, exactly as `basePath` is in single-package mode.

  Throws when any directory segment is not a plain Kotlin identifier or
  is a hard keyword — a generator authored a path that cannot be a
  package (`@/my-models/User.kt`). Loud beats backticked package names.
  This is Kotlin's `validateDestinationPath`.

Defined in deno/lang-kotlin/src/withDescription.ts:20:14

function withDescription(value: Stringable, {description}: WithDescriptionArgs): string
  Wraps a value with a KDoc comment when a description is provided —
  Kotlin's block-comment syntax is identical to JSDoc, so this mirrors
  the lang-typescript helper.

  A multi-line description renders as a block with `*` margins —
  the inline form would leave continuation lines without a comment
  margin, so a formatter eats a content-leading `*` as decoration and
  intra-line indentation is lost.

Defined in deno/lang-kotlin/mod.ts:34:14

const fileExtensions: ".kt"[]
  File extensions this language package renders.

Defined in deno/lang-kotlin/src/KtLang.ts:16:14

const kotlin: Lang
  The Kotlin {@link Lang} — carried as the static `lang` on
  {@link import('./KtSnippet.ts').KtSnippet} and inherited by every class
  built on it. Its only consumers are the engine's Drivers, which read it
  off the projection class (`projection.lang`) ephemerally at each use
  site. The engine reaches Kotlin only through these neutral factories;
  it never names `KtFile` / `KtDefinition` / `KtImport` itself.

Defined in deno/lang-kotlin/src/hardKeywords.ts:9:14

const ktHardKeywords: ReadonlySet<string>
  Kotlin's hard keywords — names that can never be used as identifiers
  without backtick escaping. Soft keywords (`value`, `data`, `field`,
  `import`, …) and modifier keywords (`sealed`, `internal`, …) are NOT
  in this set: they are legal identifiers in Kotlin and need no escape.

  Source: the Kotlin language spec's "hard keywords" list (pinned in
  `notes/lang/19-kotlin-architecture.md`).

Defined in deno/lang-kotlin/mod.ts:31:14

const langId: "kotlin"
  The language id this package targets.

Defined in deno/lang-kotlin/src/KtAnnotation.ts:48:1

class KtAnnotation
  Renders a Kotlin annotation: `@Serializable`, `@SerialName("user_id")`.

  A registering LEAF entity (the `TsHeritage` precedent): given a
  `packageName` it registers its own class's import into
  `destinationPath`, so the annotation and its import are one statement
  that cannot drift apart. It registers unconditionally — a same-package
  annotation's import is dropped centrally by `KtFile`'s render-time
  suppression, so callers need no such check. Container renderers
  ({@link KtAnnotations}, `KtParameterList`, `KtFunctionSignature`) stay
  pure and just interpolate.

  NOT a `KtSnippet` subclass: `KtDefinition` imports {@link toKtAnnotations}
  from this module, so extending `KtSnippet` would close a load-time module
  cycle (`KtSnippet → KtLang → KtDefinition → KtAnnotation → KtSnippet`).
  It calls this package's {@link register} function directly instead — the
  same write path `KtSnippet.register` delegates to.

  Generic grammar only — args are {@link Stringable} and pre-quoted by the
  caller. WHICH annotation to emit is generator policy (the serialization
  seam lives in `gen-kotlin`); this package only renders what it is handed.

  constructor({context, name, args, packageName, destinationPath}: KtAnnotationArgs)
  name: string
  args: Stringable[]
  toString(): string

Defined in deno/lang-kotlin/src/KtAnnotation.ts:104:1

class KtAnnotations
  A class-level annotation block — zero or more {@link KtAnnotation}s,
  rendered one per line above a declaration head. Empty renders the empty
  string, so it interpolates unconditionally
  (`${annotations}${head}${value}`).

  constructor(annotations: KtAnnotation[])
  annotations: KtAnnotation[]
  toString(): string

Defined in deno/lang-kotlin/src/KtDefinition.ts:57:1

class KtDefinition<Value extends GeneratedValue = GeneratedValue> extends DefinitionBase<Value>
  Kotlin's concrete {@link DefinitionBase}: renders the identifier's
  declaration head and the value, each rendering itself.

  - Assignment kinds (`typealias`, `val`) — `${head} = ${value}`;
    the value is the right-hand-side expression.
  - Declaration kinds (`class`, `data-class`, `enum-class`,
    `interface`, `sealed-interface`) — `${head}${value}`; the value
    renders everything after the head: a
    {@link import('./KtParameterList.ts').KtParameterList} (parentheses
    included), a
    {@link import('./KtPrimaryConstructor.ts').KtPrimaryConstructor}
    (modifiers + the explicit `constructor` keyword), plus inline
    ` : A, B` supertype clauses and ` {\n…\n}` braced bodies — plain
    Kotlin syntax carries no grammar rule worth a class. A value that
    renders nothing yields the bodyless idiom (`sealed interface Animal`, `class Marker`) — the value decides its own form; the
    definition never inspects it.
    (Raw whole-file content — static template files — is a FILE fact, not
    a definition: it flows through the register vocabulary's `custom`
    field onto `FileBase.custom`, with no identifier involved.)

  Two protocols remain on the value because they render OUTSIDE the
  head+value line: class-level annotations
  ({@link import('./KtAnnotation.ts').KtAnnotated}, one per line above
  the declaration — the neutral `Lang.toDefinition` signature has no
  annotations slot) and KDoc
  ({@link import('./KtDocumented.ts').KtDocumented}, above the
  annotations; an explicit constructor `description` wins).

  (A foreign identifier is refused earlier, at the `Lang.toDefinition`
  boundary in `KtLang`; the constructor only accepts a
  {@link KtIdentifier}.)

  Visibility is the identifier's fact, rendered in its head (`private data class …` — see {@link KtIdentifier.toString}). The neutral
  `noExport` flag the Drivers pass is folded into a restricted identifier
  copy at the `KtLang.toDefinition` boundary, so this class never sees
  it.

  constructor({context, identifier, value, description}: KtDefinitionArgs<Value>)
  identifier: KtIdentifier
    Narrows the inherited neutral `identifier` to the concrete Kotlin
    subclass (the constructor only accepts a {@link KtIdentifier}).
  description: string | undefined
  override toString(): string

Defined in deno/lang-kotlin/src/KtFile.ts:43:1

class KtFile extends CodeFileBase
  Kotlin's concrete code file. Owns the definition + import collections and
  their merge policy (the neutral {@link CodeFileBase} declares the
  contract) and adds the Kotlin-specific pieces:

  - the `package` directive, DERIVED from the file's own path via
    {@link toPackageName} — the export path encodes the package
    (`@/com/example/api/User.generated.kt` → `package com.example.api`);
    `client.json#settings.basePath` points at the Gradle source root.
  - same-package import suppression: any import whose resolved
    package equals this file's package is omitted at render (same-package
    symbols need no import in Kotlin — the structural analog of TsFile's
    intra-package `@/` normalization). In particular the Driver's
    cross-file peer imports vanish when peers share the package.
  - the rendering arrangement: the neutral `custom` slot
    ({@link FileBase.custom}) first — leading content above the
    `package` directive (e.g. a generated-file attribution banner;
    only comments may precede `package`), the same placement `TsFile`
    gives it — then the package directive, imports (one statement
    per symbol, sorted alphabetically — not style, which is the
    consumer's formatter's job, but registration-order independence:
    the rendered bytes are what snapshot tests and byte-identical
    regression gates compare), then definitions joined by blank lines.

  `reExports` cannot arrive by construction — Kotlin's concise register
  vocabulary has no `reExports` field and the Driver never registers
  them — so rendering ignores the (always empty) neutral map.

  constructor({path, settings}: KtFileArgs)
  packageName: string
    The `package` this file declares — derived from `path`, with the
    owning package's `rootPath` stripped first in multi-package mode
    (`settings.packages`).
  settings: ClientSettings | undefined
    Threaded into package derivation and same-package suppression.
  definitions: Map<string, DefinitionBase>
    Definitions keyed by identifier name (first write wins; Kotlin has no declaration merging).
  imports: Map<string, ImportBase>
    Imports keyed by {@link ImportBase.mergeKey}.
  reExports: Map<string, ReExportBase>
    Re-exports keyed by {@link ReExportBase.mergeKey} — Kotlin registers none; kept for the neutral contract.
  override addDefinition(definition: DefinitionBase): void
  override addImports(incoming: ImportBase[]): void
  override addReExports(incoming: ReExportBase[]): void
  override findDefinitions(query?: { name?: string; type?: KtEntityType; }): DefinitionBase[] | undefined
  override toString(): string

Defined in deno/lang-kotlin/src/KtFunctionSignature.ts:30:1

class KtFunctionParameter
  Renders a Kotlin function parameter: `@PathVariable("id") id: String`,
  `verbose: Boolean?`.

  Grammar only — WHICH annotations to attach (`@PathVariable`,
  `@RequestParam`, `@RequestBody`) is generator policy riding
  {@link import('./KtAnnotation.ts').KtAnnotation}. Distinct from
  {@link import('./KtParameterList.ts').KtParameterArgs} (primary-constructor
  parameters, `val` prefix + defaults) — the two are different productions.

  constructor({name, type, nullable, defaultValue, annotations}: KtFunctionParameterArgs)
  name: string
  type: Stringable
  nullable: boolean | undefined
  defaultValue: Stringable | undefined
  annotations: KtAnnotation[] | undefined
  toString(): string

Defined in deno/lang-kotlin/src/KtFunctionSignature.ts:93:1

class KtFunctionSignature
  Renders a Kotlin method signature — the building block of an
  `interface` or `class` body:

  ```kotlin
      @GetMapping("/users/{id}")
      fun getUsersId(@PathVariable("id") id: String, @RequestParam("verbose") verbose: Boolean?): User
  ```

  Indented one level (it lives inside a declaration body); parameters on
  one line (formatting is the consumer's formatter's job). Abstract by
  default; an expression `body` renders the delegation form (` = …` —
  block bodies deliberately unsupported). Optional KDoc `description`
  above the annotations and per-parameter `= default`. Grammar only —
  no `suspend`; the mapping annotations are generator policy.

  constructor({name, parameters, returnType, annotations, description, body}: KtFunctionSignatureArgs)
  name: string
  parameters: KtFunctionParameter[]
  returnType: Stringable | undefined
  annotations: KtAnnotation[] | undefined
  description: string | undefined
  body: Stringable | undefined
  toString(): string

Defined in deno/lang-kotlin/src/KtIdentifier.ts:50:1

class KtIdentifier extends IdentifierBase
  Kotlin's concrete {@link IdentifierBase}: adds the typed `type`
  ({@link KtEntityType}) and owns the rendering of its own declaration
  head — `data class User`, `enum class Status`, `val timeout: Long` —
  via {@link toString}. {@link import('./KtDefinition.ts').KtDefinition}
  interpolates the head and adds only the kind's arrangement (parameter
  parens, supertype clause, braced body); the keyword itself lives here,
  next to the identifier that determines it.

  The engine holds it as the neutral `IdentifierBase` (reading only
  `.name`); `KtDefinition` narrows back to `KtIdentifier` via
  {@link isKtIdentifier} to read `type`.

  constructor({name, typeName, exported, type}: KtIdentifierArgs)
  type: KtEntityType
    Per-language declaration type — drives the declaration head and shell.
  override toString(): string
    The declaration head: `[private ]<keyword> <name>[: <typeName>]`.
    Overrides the neutral base's bare-name render — in Kotlin the keyword
    belongs to the identifier's kind, so the identifier renders it, and
    visibility is the identifier's own `exported` fact (the pattern core's
    `IdentifierBase.exported` doc anticipates: each language renders it its
    own way — Go via name casing, Kotlin via this prefix). Kotlin defaults
    to `public`, so `exported` renders as nothing when true and
    `private ` (file-local) when false — keyword only to restrict.
    Generators splicing a name into generated code should keep using
    `.name` / `Inserted.toName()`, which this override does not touch.

Defined in deno/lang-kotlin/src/KtImport.ts:46:1

class KtImport extends ImportBase
  Kotlin's concrete {@link ImportBase}: one module's worth of imported
  symbols. The `module` takes two forms, distinguished by shape:

  - a dotted package (`'kotlinx.serialization'`) — external libraries,
    generator-registered;
  - an `@/`-export-path (`'@/com/example/api/User.generated.kt'`) — project
    files; this is what the Driver passes for cross-file peer imports.

  The path form resolves to its package via {@link toPackageName} at
  render time ({@link resolvedPackage}); {@link import('./KtFile.ts').KtFile}
  uses the same resolution to suppress same-package imports (same-package
  symbols need no import in Kotlin).

  Rendering is one statement per symbol — Kotlin has no brace grouping:
  `import kotlinx.serialization.Serializable`.

  constructor(module: string, specifiers: KtImportSpecifier[])
  module: string
  specifiers: KtImportSpecifier[]
  static fromConcise(module: string, names: KtImportNameArg[]): KtImport
    Build from the concise `{ module: KtImportNameArg[] }` form a generator passes.
  static fromIdentifier(module: string, identifier: IdentifierBase): KtImport
    Build the import of a single {@link IdentifierBase} from `module` — the
    cross-file import a Driver registers when a generator references a
    peer's Definition. The identifier's `type` is ignored: every Kotlin
    import has the same form, so the neutral `IdentifierBase` (which the
    engine holds) is all that's needed — no narrowing.
  resolvedPackage(packages?: ModulePackage[]): string
    The package this import's symbols come from: a path-form module
    (contains `/`) derives via {@link toPackageName}; a dotted package
    passes through. In multi-package output the owning
    {@link import('./KtFile.ts').KtFile} passes its `settings.packages`
    so a path under another module's `rootPath` resolves to that
    module's real dotted package — Kotlin imports are always packages;
    `moduleName` has no Kotlin meaning.
  override mergeKey(): string
  override merge(other: ImportBase): ImportBase
  toLines(packages?: ModulePackage[]): string[]
    One `import pkg.Name[ as Alias]` line per specifier.
  override toString(): string
    The packages-less fallback render — correct for dotted-package modules
    and for path-form modules in single-package projects. The canonical
    render path is {@link import('./KtFile.ts').KtFile}'s `toString`, which
    calls {@link toLines} with the project's `settings.packages` so a
    path-form module under another module's `rootPath` resolves to that
    module's real package; the neutral `ImportBase` signature gives this
    override no way to receive them, so multi-package resolution is only
    correct through `KtFile`.

Defined in deno/lang-kotlin/src/KtParameterList.ts:38:1

class KtParameterList
  Renders a Kotlin primary-constructor parameter list, parentheses
  included — `(\n    val id: String\n)`. The value owns its
  delimiters: a data-class value interpolates this directly
  (`${parameters}${supertypeClause}`), and the definition renders only
  `${head}${value}`. Each parameter is a `val` property (public by
  default).

  No trailing comma after the last parameter — a cosmetic non-decision:
  trailing commas are the consumer's formatter's territory (ktfmt adds
  them, ktlint can enforce either way) and SKMTC renders unformatted by
  design.

  constructor(parameters: KtParameterArgs[])
  parameters: KtParameterArgs[]
  toString(): string

Defined in deno/lang-kotlin/src/KtPrimaryConstructor.ts:32:1

class KtPrimaryConstructor
  A primary constructor — the clause after the class name, owned by the
  VALUE: a class value composes
  `${primaryConstructor}${supertypeClause}${body}` and the definition
  renders `${head}${value}`. Without modifiers this is just the
  parameter list; the class exists for the modifier + explicit
  `constructor`-keyword grammar rule.

  constructor({parameters, modifiers}: KtPrimaryConstructorArgs)
  parameters: Stringable
  modifiers: Stringable | undefined
  toString(): string

Defined in deno/lang-kotlin/src/KtSnippet.ts:29:1

class KtSnippet extends SnippetBase
  The Kotlin snippet base — where the Kotlin language enters the SKMTC
  DSL class hierarchy.

  `@skmtc/core`'s {@link SnippetBase} is language-blind and needs no
  `generatorKey` to register — the key stays an optional constructor arg
  used for attribution (gen-maps) only. `KtSnippet` extends it and carries
  the Kotlin {@link Lang} as a static only: Drivers read it off the
  projection class (`projection.lang`), pre-construction, inherited through
  every class built on this base (including projection classes from this
  package's `toKtModelProjectionBase`). No instance slot — the register
  methods delegate to this package's register functions, which name the
  Kotlin classes directly.

  `destinationPath` is always explicit on snippets: a snippet has no
  file or settings of its own, so the parent passes the target path through
  the constructor. Own-file defaulting exists only on projections, in the
  projection-base veneers.

  static lang: Lang
    The language every class built on this base renders into — the neutral
    {@link Lang}. Drivers read it off the projection class
    (`projection.lang`) pre-construction; a projection-base veneer carries
    the Kotlin identifier tightening ({@link import('./KtIdentifier.ts').KtIdentifierType})
    through its config's `toIdentifierType` rather than through this static.
  register(args: KtRegisterArgs & { destinationPath: string; }): void
    Register imports / definitions into the file at `destinationPath`,
    typed by Kotlin's concise vocabulary — keyless: no `generatorId`
    resolution, no `generatorKey` requirement.
  defineAndRegister(args: KtDefineAndRegisterArgs<Value>): KtDefinition<Value>
    Build a {@link KtDefinition} from `value` and register it at
    `destinationPath`.

Defined in deno/lang-kotlin/src/createIdentifier.ts:59:1

type CreateKtIdentifierArgs = { exported?: boolean; }
  Options shared by the identifier factories — every field optional, so
  the common case stays `createDataClass(name)`.

Defined in deno/lang-kotlin/src/createIdentifier.ts:68:1

type CreateValueArgs = { typeName?: string; exported?: boolean; }
  Options for {@link createValue} — the only factory with a `typeName`
  slot (the `val x: T = …` annotation).

Defined in deno/lang-kotlin/src/KtAnnotation.ts:79:1

type KtAnnotated = { annotations: KtAnnotation[]; }
  The protocol by which a Definition's VALUE supplies class-level
  annotations to {@link import('./KtDefinition.ts').KtDefinition}.

  `Lang.toDefinition`'s neutral signature has no annotations slot, so
  annotations ride on the value: a generator's projection sets an
  `annotations` field, and `KtDefinition.toString()` collects it via
  {@link toKtAnnotations} and renders the annotations above the
  declaration head.

Defined in deno/lang-kotlin/src/KtAnnotation.ts:6:1

type KtAnnotationArgs = { context: GenerateContextType; name: string; args?: Stringable[]; packageName?: string; destinationPath: string; }
  Constructor arguments for {@link KtAnnotation}.

Defined in deno/lang-kotlin/src/register.ts:77:1

type KtDefineAndRegisterArgs<Value extends GeneratedValue> = { identifier: KtIdentifier; value: Value; destinationPath: string; description?: string; }
  Arguments for {@link defineAndRegister}.

Defined in deno/lang-kotlin/src/KtDefinition.ts:10:1

type KtDefinitionArgs<Value extends GeneratedValue> = { context: GenerateContextType; identifier: KtIdentifier; value: Value; description?: string; }
  Constructor arguments for {@link KtDefinition}.

Defined in deno/lang-kotlin/src/KtDocumented.ts:12:1

type KtDocumented = { description?: string; }
  The protocol by which a Definition's VALUE supplies a KDoc description
  to {@link import('./KtDefinition.ts').KtDefinition} — a value-carried
  protocol (like `KtAnnotated`) because it renders ABOVE the head+value
  line and the neutral `Lang.toDefinition` call the Drivers make carries
  no description; threading it through core would change every
  language's output at once. The lang renders the KDoc; WHAT the text is
  (a schema `description`, an operation `summary`) is generator policy.

  An explicit `description` passed to `KtDefinition`'s constructor wins
  over the protocol.

Defined in deno/lang-kotlin/src/createIdentifier.ts:32:1

type KtEntityType = (typeof ktEntityTypes)[number]
  Kotlin's declaration-type vocabulary — the typed `type` this package
  writes onto its {@link KtIdentifier} and the discriminator its renderers
  narrow against.

  - `'class'` — a concrete `class Name(…) { … }` declaration (the
    generated-controller idiom; the value composes its
    `KtPrimaryConstructor` and braced body).
  - `'data-class'` — a `data class Name(…)` DTO container.
  - `'enum-class'` — an `enum class Name { … }` declaration.
  - `'interface'` — an `interface Name { … }` declaration (the Spring
    "interfaceOnly" idiom — abstract method signatures the consumer
    implements).
  - `'sealed-interface'` — a `sealed interface Name` (the `oneOf` idiom).
  - `'typealias'` — a `typealias Name = …` declaration.
  - `'val'` — a top-level `val Name = …` assignment (Kotlin's distinctive
    file-scope value, illegal in C#/PHP/Java).

  Every kind names a REAL declaration — an identifier that never appears
  in code is a contradiction. Raw whole-file content (static template
  files) is a FILE fact, not a definition: it goes through the register
  vocabulary's `custom` field (`FileBase.custom`), with no identifier
  involved.

  Unlike TypeScript, the type does NOT drive import form — every Kotlin
  import is `import pkg.Name`. It drives only the declaration shell.
  Deferred kinds (`object`, `fun`, `var`, `const-val`) arrive with the
  milestones that need them; {@link toKtEntityType} throwing on them is
  the desired behavior until then.

Defined in deno/lang-kotlin/src/KtFile.ts:10:1

type KtFileArgs = { path: string; settings: ClientSettings | undefined; }
  Constructor arguments for {@link KtFile} — the `Lang.createFile` shape.

Defined in deno/lang-kotlin/src/KtFunctionSignature.ts:4:1

type KtFunctionParameterArgs = { name: string; type: Stringable; nullable?: boolean; defaultValue?: Stringable; annotations?: KtAnnotation[]; }
  A single parameter of a Kotlin function signature.

Defined in deno/lang-kotlin/src/KtFunctionSignature.ts:59:1

type KtFunctionSignatureArgs = { name: string; parameters: KtFunctionParameterArgs[]; returnType?: Stringable; annotations?: KtAnnotation[]; description?: string; body?: Stringable; }
  Constructor arguments for {@link KtFunctionSignature}.

Defined in deno/lang-kotlin/src/KtIdentifier.ts:18:1

type KtIdentifierArgs = IdentifierBaseArgs & { type: KtEntityType; }
  Constructor arguments for {@link KtIdentifier} — the neutral
  {@link IdentifierBaseArgs} plus this language's typed `type`.

Defined in deno/lang-kotlin/src/KtIdentifier.ts:12:1

type KtIdentifierType = IdentifierType & { type: KtEntityType; }
  The non-`name` parts of a Kotlin identifier — the tightened
  `IdentifierType` a Kotlin projection's `toIdentifierType` returns.
  Core's neutral {@link IdentifierType} carries an opaque `type: string`;
  this alias narrows it to {@link KtEntityType}, the named form generators
  annotate with. The engine spreads it into
  `lang.toIdentifier({ name, ...identifierType })`.

Defined in deno/lang-kotlin/src/KtImport.ts:11:1

type KtImportNameArg = string | { name: string; alias?: string; }
  The concise import form a Kotlin generator passes to `register` —
  `'Serializable'` or `{ name: 'User', alias: 'UserModel' }` (Kotlin
  supports symbol-level aliases via `as`, unlike Java). Owned by this
  package: the concise vocabulary is language-specific; the neutral
  engine never sees it. No `type` tag — Kotlin has no type-only imports.

Defined in deno/lang-kotlin/src/KtImport.ts:14:1

type KtImportSpecifier = { name: string; alias?: string; }
  A single imported symbol on a {@link KtImport}.

Defined in deno/lang-kotlin/src/KtParameterList.ts:4:1

type KtParameterArgs = { name: string; type: Stringable; nullable?: boolean; defaultValue?: Stringable; annotations?: KtAnnotation[]; visibility?: "private" | "protected" | "internal"; }
  A single primary-constructor parameter of a Kotlin class.

Defined in deno/lang-kotlin/src/KtPrimaryConstructor.ts:5:1

type KtPrimaryConstructorArgs = { parameters: Stringable; modifiers?: Stringable; }
  Arguments for {@link KtPrimaryConstructor}.

Defined in deno/lang-kotlin/src/register.ts:17:1

type KtRegisterArgs = { imports?: Record<string, KtImportNameArg[]>; definitions?: (DefinitionBase | undefined)[]; custom?: Stringable; }
  Kotlin's concise register vocabulary — the generator-facing form.

  Owned by this package: each language defines its own concise args type
  exposing only what the language supports. Kotlin has no re-exports,
  so there is deliberately no `reExports` field — a generator trying to
  register one is a compile-time error, not a runtime no-op (the note-16
  Go example, realized).

Defined in deno/lang-kotlin/src/withDescription.ts:5:1

type WithDescriptionArgs = { description?: string; }
  Arguments for {@link withDescription}.
```

<!-- api-appendix:end -->
