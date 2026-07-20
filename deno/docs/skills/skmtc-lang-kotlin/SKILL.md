---
name: skmtc-lang-kotlin
version: 0.3.1
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

The exact constructor shapes — **these are complete**; verify with
`deno check` after scaffolding rather than pre-reading the package
source:

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
  `skmtc create … --lang kotlin` scaffold ships this pattern.

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
