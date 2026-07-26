---
name: skmtc-lang-kotlin
version: 0.10.0
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
  `KtFunctionSignature`, `KtAnnotation`), the `SchemaToValueFn` router
  contract and where serialization annotations and default values are
  decided (inside the router's per-type snippets, exposed as value
  fields), and naming/sanitization (`sanitizePropertyName`,
  `toPackageName`, hard keywords like `object`).

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
import type { EmptyEnrichments, ModelProjectionArgs, Stringable } from '@skmtc/core'
import { KtAnnotation } from '@skmtc/lang-kotlin'
import { KtModelBase } from './base.ts'
import { toKtValue } from './Kt.ts'

export class KtModel extends KtModelBase {
  // Class-level annotations — the KtAnnotated protocol (§4). The Driver
  // wraps THIS instance in the Definition, so the projection IS the
  // definition's value and the protocol field lives directly on it:
  // KtDefinition reads it as `this.value.annotations`.
  annotations: KtAnnotation[]
  value: Stringable

  // The enrichment generic must match the base: `toEnrichmentSchema:
  // () => emptyEnrichmentSchema` makes the base expect
  // ModelProjectionArgs<EmptyEnrichments>; the bare default fails
  // `deno check` — which bundle/generate will NOT catch (esbuild does
  // not typecheck).
  constructor({ context, settings, refName }: ModelProjectionArgs<EmptyEnrichments>) {
    super({ context, settings, refName })

    const schema = context.resolveSchemaRefOnce(refName, KtModel.id).resolve()

    // ONE router call — the generator's SchemaToValueFn owns every
    // schema.type decision (skmtc-generator axiom 1); 'object' maps to
    // the data-class value snippet inside the router, not here.
    this.value = toKtValue({
      context,
      schema,
      destinationPath: settings.exportPath, // snippets/leaves always get the parent's file
      required: true
    })

    // Reference-sharing: point the protocol field at the routed value's
    // OWN array — one array, two names; whatever a router case put there
    // is already here. Push projection-level policy into it; NEVER
    // reassign it afterward (a later `this.annotations = []` would
    // silently split the two names onto different arrays).
    this.annotations = this.value.annotations
    this.annotations.push(
      new KtAnnotation({
        context,
        name: 'JsonIgnoreProperties',
        args: ['ignoreUnknown = true'],
        packageName: 'com.fasterxml.jackson.annotation',
        destinationPath: settings.exportPath
      })
    )
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

The same-pin rule covers **core too**: pin `@skmtc/core` to the exact
version the lang-kotlin package (vendored or JSR) pins — read it from
that package's `deno.json` rather than taking a newer one. Two core
copies in one build break cross-copy `instanceof` exactly like two
lang copies (§6).

### The router contract — `SchemaToValueFn`, no core dive needed

The `toKtValue` router the scaffold above calls is typed by core's
`SchemaToValueFn`. Its whole surface:

```ts fragment
type SchemaType = OasSchema | OasRef<'schema'> | OasVoid | CustomValue

type SchemaToValueFn = <S extends SchemaType>(
  args: TypeSystemArgs<S>
) => TypeSystemOutput<S['type']>

type TypeSystemArgs<S extends SchemaType> = {
  context: GenerateContextType
  destinationPath: string // the parent's file — threaded into every leaf
  schema: S               // the typed variant after narrowing
  rootRef?: RefName       // originating ref name, when routing a named schema
  required: boolean | undefined
}
```

The contract is **structural**: each per-type snippet class carries the
fields of its output type alongside its own state — nothing extends a
core class for this. The `skmtc create … --lang kotlin` skeleton's
`DataClassValue` is the worked case: `type = 'object' as const`,
`recordProperties: null`, `objectProperties`, `modifiers`. A snippet
for another schema type carries its own output type's fields the same
way (`'string'` → `type`, `format`, `enums`, `modifiers`).

The complete output-shape crib — **exact**, one line per contract
type; a snippet carries its case's fields verbatim (each shape also
takes an optional `generatorKey`; `enums` keeps its full Nullable
union — §4):

```ts fragment
type TypeSystemString  = { type: 'string'; format: string | undefined; enums: string[] | (string | null)[] | undefined; modifiers: Modifiers }
type TypeSystemInteger = { type: 'integer'; modifiers: Modifiers }
type TypeSystemNumber  = { type: 'number'; modifiers: Modifiers }
type TypeSystemBoolean = { type: 'boolean'; modifiers: Modifiers }
type TypeSystemArray   = { type: 'array'; items: TypeSystemValue; modifiers: Modifiers }
type TypeSystemRef     = { type: 'ref'; name: string; modifiers: Modifiers }
type TypeSystemObject  = { type: 'object'; recordProperties: TypeSystemRecord | null; objectProperties: TypeSystemObjectProperties | null; modifiers: Modifiers }
type TypeSystemRecord  = { value: TypeSystemValue | 'true' }
type TypeSystemObjectProperties = { properties: Record<string, TypeSystemValue> }
type TypeSystemUnion   = { type: 'union'; members: TypeSystemValue[]; discriminator: string | undefined; modifiers: Modifiers }
type TypeSystemUnknown = { type: 'unknown' }
type TypeSystemCustom  = { type: 'custom'; value: Stringable }
```

Two more facts that save a dive into `core/types/TypeSystem.ts`:

- **`Modifiers` is deliberately thin** — `{ required?, description?,
  nullable? }` and nothing else. Wire facts (`readOnly` / `writeOnly`,
  `format`) are NOT threaded through modifiers; the per-type snippet
  holds its typed schema variant and reads them directly (§4,
  "annotations and defaults are decided inside the per-type snippet").
- **Keep the router's plain signature** (§4: union in, union out,
  intersected with `KtValueFields`) — the generic
  `TypeSystemOutput<S['type']>` tightening is documented there as a
  rare exception, not the default.

The output types carry `.type` discriminators, but consumers never
need them (§4): a renderer reads fields off routed values —
`annotations`, `defaultValue` — instead of narrowing.

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
  same-file declarations reference each other freely. Concretely, the
  router's whole `ref` case is those two calls: a `RefValue` snippet
  whose constructor does `context.insertModel(KtModel,
  ref.toRefName())` and whose `toString()` returns the stored
  `.toName()` — no register, nothing else.
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

Multi-element `args` render comma-joined on **one line**
(`args.join(', ')`). For a multi-line annotation body — the
`@JsonSubTypes` idiom with one `JsonSubTypes.Type(…)` entry per
line — pass a SINGLE arg carrying the whole body: a `Stringable`
snippet whose `toString()` composes the lines (keeping composition
inside `toString()`), or a pre-formatted string.

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
**generated API appendix** (`appendix.md`, this skill's directory)
carries the full `deno doc` surface of the whole package (every
export, exact argument shapes, generated from source — it cannot
drift). Between this section and that file there is nothing left to
learn from pre-reading the package source; verify with `deno check`
after scaffolding instead:

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

### Exact render shapes — verbatim

Generated by constructing each class and printing `toString()` —
match output against these instead of reading the rendering source
(`«»` marks the exact boundaries; every newline and space is real):

```text
createDataClass('User')                        «data class User»
createDataClass('User', { exported: false })   «private data class User»
createValue('timeout', { typeName: 'Long' })   «val timeout: Long»
createSealedInterface('Animal')                «sealed interface Animal»

KtAnnotation { name: 'JsonProperty', args: ['"user_id"'] }
                                               «@JsonProperty("user_id")»
KtAnnotation { name: 'JvmInline' }             «@JvmInline»

toKtAnnotations(value)  — one per line + TRAILING newline (so
`${annotations}${head}` needs no separator); empty renders «»:
«@JsonProperty("user_id")
@Deprecated("use v2")
»

KtParameterList — parens included, one param per line at 4-space
indent, annotations one per line ABOVE their param, inline
visibility; an EMPTY list renders parens around a blank line:
«(
    @JsonProperty("user_id")
    val userId: String,
    private val name: String,
    val email: String? = null
)»          empty: «(

)»

KtPrimaryConstructor — without modifiers, identical to its parameter
list; with modifiers, a LEADING space then the explicit keyword:
« private constructor(…)»

KtFunctionSignature — indented 4 spaces (it lives inside a
declaration body); single-line KDoc stays inline; parameters on one
line; expression body appends ` = …`:
«    /** Fetch one user. */
    @GetMapping("/users/{id}")
    fun getUsersId(id: String, verbose: Boolean? = null): User»
«    fun toId(raw: String): UserId = UserId(raw)»

KtDefinition (declaration kind) — KDoc, then annotations, then
`${head}${value}` with no space before the value's parens:
«/** A user of the system. */
@JsonSerialize(…)
data class User(
    …
)»
KtDefinition (assignment kind)   «typealias UserList = List<User>»

withDescription(value, { description }) — MULTI-line descriptions get
a block with ` * ` margins (single-line stays inline as above):
«/**
 * Line one.
 * Line two.
 */
data class X(…)»
```

### The `oneOf` → sealed interface recipe

The Kotlin idiom for a discriminated `oneOf` (`Animal` = `Dog | Cat`,
discriminated by `petType`) is a sealed parent plus supertyped
members. The pattern: **the union assigns membership to its members**
— a member schema does not know it is in a union and behaves as if it
is not.

- **Members** carry two fields the parent writes to, both reachable
  through `inserted.definition.value` (the Driver wraps the projection
  instance itself in the Definition, so that IS the member
  projection): `supertypes` — declared on the projection, rendered by
  its own `toString()` — and the routed value's `parameters` array,
  reached as `.value.parameters` (it lives on the object value that
  renders it; no projection property, no copy). The router keeps the
  **bare `SchemaToValueFn` type** — nothing extra is threaded in;
  facts flow *out* of the router on the values it returns:

  ```ts fragment
  // Member side — the §1 projection, grown one seam. A schema that is
  // in no union renders exactly as before (supertypes empty).
  export class KtModel extends KtModelBase {
    supertypes: Stringable[] = []
    annotations: KtAnnotation[] // the KtAnnotated protocol slot (§4)
    value: ReturnType<typeof toKtValue> // NOT Stringable — so .value reads type-check

    constructor({ context, settings, refName }: ModelProjectionArgs<EmptyEnrichments>) {
      super({ context, settings, refName })
      const schema = context.resolveSchemaRefOnce(refName, KtModel.id).resolve()
      this.value = toKtValue({
        context,
        schema,
        destinationPath: settings.exportPath,
        required: true
      })
      // Reference-sharing: KtDefinition reads annotations off THIS
      // object, so the protocol slot must exist here — point it at the
      // routed value's own array (one array, two names; whatever a
      // router case put there is already here). Never reassign either
      // name afterward — push, don't replace.
      this.annotations = this.value.annotations
    }

    toString(): string {
      return `${this.value}${this.supertypes.length ? ` : ${this.supertypes.join(', ')}` : ''}`
    }
  }
  ```

  The discriminator tag property is **removed by the parent, during
  generate** — not filtered at render: `insertModel` guarantees the
  member's constructor has run (existence), so the object value and
  its `parameters` array always exist by the time a union case
  touches them, whichever visit order; the `KtParameterList` built in
  the value's constructor holds the same array instance, so the
  removal is visible at render with zero render-time work. The member
  never chooses between tags (a member of two unions gets two
  removals); which tag appears on the wire is decided at
  serialization time by the sealed parent the value is viewed through
  (each parent renders its own `@JsonTypeInfo(property = …)`), never
  by the member.

- **Parent**: `createSealedInterface(refName)` with a value whose
  `toString()` renders `''` — the bodyless idiom gives
  `sealed interface Animal`. The router case stays ONE line — `case
  'union': return new UnionValue({ context, unionSchema: schema,
  destinationPath, rootRef, modifiers: { required } })` — like every
  other case: the router routes and constructs, it never does the
  work. The work all happens in **`UnionValue`'s constructor**: it
  receives the union facts (discriminator name, member list) with the
  typed schema, so it is where the parent's class annotations are
  decided — pushed into its own `annotations` array; the parent
  projection's alias line (previous fragment) makes that same array
  its `KtAnnotated` protocol slot. No annotation helper elsewhere, no
  `.type` guard anywhere. Membership assignment in a constructor is
  exactly axiom 2 — declaration at construction. Member assignment
  uses `insertModel` — it returns the one memoized handle however
  many producers ask, and `.definition.value` is the member
  projection instance — typed as such by `insertModel`'s generics, so
  the writes below need no cast:

  ```ts fragment
  // UnionValue, in full: the router case constructs it; the
  // constructor owns parent annotations + membership; toString
  // renders the bodyless idiom.
  export class UnionValue extends KtSnippet {
    type = 'union' as const
    members: (TypeSystemValue & KtValueFields)[]
    discriminator: string | undefined
    modifiers: Modifiers
    annotations: KtAnnotation[] = []

    constructor({ context, unionSchema, destinationPath, rootRef, modifiers }: Args) {
      super({ context })
      this.modifiers = modifiers
      this.discriminator = unionSchema.discriminator?.propertyName
      // Members route back through the router — the contract fields
      // come for free, and insertModel below is idempotent whether
      // reached from here or from the membership loop.
      this.members = unionSchema.members.map(member =>
        toKtValue({ context, schema: member, destinationPath, required: true })
      )

      const tag = this.discriminator
      if (tag) {
        // Wire tag per member: the discriminator mapping keys are the
        // wire values, the ref suffix identifies which member each
        // maps to; a member absent from the mapping defaults to its
        // refName.
        const mapping = unionSchema.discriminator?.mapping ?? {}
        const entries = unionSchema.members.flatMap(member => {
          if (!member.isRef()) return []
          const refName = member.toRefName()
          const wireTag =
            Object.entries(mapping).find(([, ref]) => ref.endsWith(`/${refName}`))?.[0] ?? refName
          return [{ className: refName, wireTag }]
        })
        this.annotations.push(
          new KtAnnotation({
            context,
            destinationPath,
            name: 'JsonTypeInfo',
            args: [`use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "${tag}"`],
            packageName: 'com.fasterxml.jackson.annotation'
          }),
          new KtAnnotation({
            context,
            destinationPath,
            name: 'JsonSubTypes',
            // ONE arg carrying the whole multi-line body (§3) — a tiny
            // dedicated snippet, so the composition lives in ITS
            // toString(), not built ad hoc here.
            args: [new SubTypeEntries({ context, entries })],
            packageName: 'com.fasterxml.jackson.annotation'
          })
        )
      }

      unionSchema.members.forEach(member => {
        if (!member.isRef()) return
        const inserted = context.insertModel(KtModel, member.toRefName())
        if (rootRef) inserted.definition.value.supertypes.push(rootRef)
        if (tag) {
          // Remove the tag parameter — Jackson owns it via the parent's
          // @JsonTypeInfo. Generate-time mutation of the object value's
          // entries array; its KtParameterList sees the settled result.
          const parameters = inserted.definition.value.value.parameters ?? []
          const at = parameters.findIndex(parameter => parameter.wireName === tag)
          if (at >= 0) parameters.splice(at, 1)
        }
      })
    }

    override toString(): string {
      return '' // the bodyless idiom — the head IS the declaration
    }
  }
  ```

  ```ts fragment
  // SubTypeEntries.ts — the multi-line @JsonSubTypes body as its own
  // tiny snippet. This is the canonical shape for ANY multi-line,
  // multi-symbol annotation argument: facts in the constructor,
  // composition in toString().
  export class SubTypeEntries extends KtSnippet {
    entries: { className: string; wireTag: string }[]

    constructor({ context, entries }: SubTypeEntriesArgs) {
      super({ context })
      this.entries = entries
    }

    override toString(): string {
      return this.entries
        .map(({ className, wireTag }) => `JsonSubTypes.Type(value = ${className}::class, name = "${wireTag}")`)
        .join(',\\n    ')
    }
  }
  ```

  A note on the structural eval's composition metric: constructor-built
  annotation args (the `KtAnnotation` args above, an enum constant's
  `@JsonProperty("${wireValue}")`) count toward
  composition-outside-`toString()` — that is expected and fine.
  Annotations are BUILT at construction by design; the metric's 50%
  warning threshold accounts for this, so do not restructure working
  code just to move that number.

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

### The `enum class` recipe — head and body from two seams

**`enums` is not a string fact.** Every schema variant except `union`
and `unknown` carries it, each over its own element type — integer and
number enums (`enums: number[] | (number | null)[]`), boolean, array,
object. This recipe covers the string case because that is the one
that maps cleanly onto a Kotlin `enum class` with wire values; the
others need a policy decision you make deliberately (an integer enum
can be an `enum class` whose constants carry an `Int`, or just `Int`
with the constraint dropped). Decide it in the router case that owns
that type — a `number` snippet that silently ignores `enums` has made
the decision by omission, and the schema's constraint vanishes with no
trace.

A string-with-`enums` schema becomes `enum class PetType { … }`, and
the declaration is split across the two places §2 defines: the
**identifier** renders the head (`enum class PetType`), so
`toIdentifierType` must return `'enum-class'` — a mapping-metadata
policy, where inspecting the schema is sanctioned:

```ts fragment
// base.ts — declaration KIND is metadata (toIdentifierType may
// inspect the schema; it decides what a node is CALLED, never what
// renders it).
toIdentifierType: (refName, context): KtIdentifierType => {
  const schema = context.resolveSchemaRefOnce(refName, denoJson.name).resolve()
  if (schema.type === 'object') return { type: 'data-class' }
  if (schema.type === 'union') return { type: 'sealed-interface' }
  if (schema.type === 'string' && schema.enums) return { type: 'enum-class' }
  return { type: 'typealias' }
}
```

The **value** renders the braced body — the router's `string` case
forks on `enums` presence (a schema fact; the same within-case
license as the `format` branch and the object case's Map fork):

```ts fragment
case 'string':
  return schema.enums
    ? new EnumClassValue({ context, stringSchema: schema, destinationPath, modifiers })
    : new StringValue({ context, stringSchema: schema, destinationPath, modifiers })
```

```ts fragment
// Renders ONLY the body — ` {\n…\n}` including the leading space and
// braces (§2: the value owns its shell; the head comes from the
// identifier). Everything is decided and built in the constructor:
// wire value → UPPER_SNAKE constant name, the @JsonProperty rename
// each constant keeps, and which constant gets @JsonEnumDefaultValue
// (the forward-compatible fallback — generator policy).
export class EnumClassValue extends KtSnippet {
  type = 'string' as const // TypeSystem contract fields (§1) …
  format: string | undefined
  enums: string[] | undefined
  modifiers: Modifiers
  annotations: KtAnnotation[] = [] // KtValueFields — empty here
  constants: { annotations: KtAnnotation[]; name: string }[]

  constructor({ context, stringSchema, destinationPath, modifiers }: Args) {
    super({ context })
    this.format = stringSchema.format
    this.enums = (stringSchema.enums ?? []).flatMap(entry => (entry === null ? [] : [entry]))
    this.modifiers = modifiers
    this.constants = this.enums.map(wireValue => ({
      // Wire values are data; constant names are identifiers.
      name: wireValue.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase(),
      annotations: [
        new KtAnnotation({
          context,
          destinationPath,
          name: 'JsonProperty',
          args: [`"${wireValue}"`],
          packageName: 'com.fasterxml.jackson.annotation'
        })
      ]
    }))
  }

  override toString(): string {
    const body = this.constants
      .map(({ annotations, name }) => `${annotations.map(a => `    ${a}\n`).join('')}    ${name},`)
      .join('\n\n')
    return ` {\n${body}\n}`
  }
}
```

One caveat to state rather than discover: an **inline** (property-
level) string-with-enums also routes through this case, and a braced
body is not a valid property type. In the discriminated-union shape
this is harmless — the only inline enums are discriminator tags,
whose parameter entries the union parent removes before render. A
schema with genuine inline enums needs a policy decision first: hoist
the enum to a named schema (`insertNormalizedModel` with a
`fallbackName`) or degrade the property to plain `String`.

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
the projection IS the definition's value, so the field must sit
**directly on the projection**. When the fact is computed inside a
router case (the routed value carries it), the wiring is
**reference-sharing**: after the single router call, point the
projection's field at the routed value's own array —
`this.annotations = this.value.annotations` — one array, two names;
writes through either are visible to both (the §1 scaffold). Two
disciplines keep it safe: a getter (`get annotations() { … }`) is
still a method and still banned, and neither name may ever be
**reassigned** afterward — push into the array, never replace it; a
later `this.annotations = []` silently splits the two names onto
different arrays with no error anywhere.

### Annotations and defaults are decided inside the per-type snippet

Which serialization annotations to emit, what default value to use,
which access modifier applies — every such decision depends on a fact
somebody already holds, and the rule is to make the decision **where
the fact lives**, then expose the result as a field:

> The router's dispatch answers `schema.type` once. Every
> type-dependent decision is made inside the per-type snippet that
> dispatch constructed, and exposed as a field on the snippet
> (`annotations`, `defaultValue`) for the consuming renderer to read.
> Nothing outside the router ever asks `.type` again — not on a
> schema, not on a routed value.

A helper that takes a schema and asks `resolved.type === 'string'`
after the router already dispatched is asking the already-answered
question a second time — the structural eval's single-dispatch check
flags exactly this, and is right to.

Split every decision by where its fact lives:

- **Type facts → the snippet self-declares.**
  `@JsonSerialize(using = MoneyStringSerializer::class)` derives from
  `format: 'decimal'`; `@JsonFormat(…)` from `format: 'date-time'`.
  The router's `string` case already owns those facts, and it spends
  them by CHOOSING a snippet — `BigDecimalValue`,
  `OffsetDateTimeValue`, `EnumClassValue`, or plain `StringValue` —
  each rendering exactly one Kotlin type and self-declaring the
  annotations that type implies as its protocol field
  (`annotations: KtAnnotation[]`, the same shape `KtAnnotated` gives
  class level). The line to hold: a fork that picks **different
  output types** lives in the router case (a schema-fact fork, the
  same license as the enums fork); a branch **inside** a snippet is
  only for rendering variations of the one type it renders. A
  `StringValue` whose `toString()` returns `'BigDecimal'` on one
  branch and `'String'` on another is two snippets sharing a file —
  split it; the module is named after what it renders (§6F).
- **Defaults are the snippet's own knowledge.** A map snippet knows its
  zero value is `'emptyMap()'`; it exposes a `defaultValue` protocol
  field rather than letting the renderer inspect
  `value.type === 'object'` to decide.
- **Position facts → the parameter renderer, no dispatch needed.**
  There are two, and they are decided in the same place: the
  `@JsonProperty("user_id")` rename (which needs `wireName` vs the
  sanitized name — facts only the object snippet has) and access
  control from `readOnly` / `writeOnly`. Access control is the one
  that reads like a type fact, because it arrives *on the schema* —
  but it belongs to the occurrence, not the type: the same `String`
  snippet may sit at a read-only property here and a writable one
  there, so a shared per-type snippet cannot carry it without being
  wrong at one of the two sites. The parameter renderer reads both per
  property and concatenates its own position annotations with the
  value's type annotations. When BOTH facts apply to one property,
  they combine into a single annotation with two named args —
  `@JsonProperty(value = "user_id", access = JsonProperty.Access.READ_ONLY)`
  — never two `@JsonProperty` annotations; the single-arg forms are
  the degenerate cases. The rule generalizes: **a fact that can
  differ between two properties of the same schema type is a position
  fact**, whatever it is declared on.
- **Cross-type wire facts → the `in` operator.** `readOnly` /
  `writeOnly` are declared on the concrete variants, not on the
  `OasSchema` union (`union` and `unknown` have neither), so the read
  itself needs `in` — a fact read, not a dispatch:
  `'readOnly' in resolved ? resolved.readOnly : undefined`.
- **Cross-type applicability → move the call, don't guard.** If class
  annotations don't apply to unions, let the union router case be the
  one that doesn't request them — never an internal
  `schema.type !== 'union'` guard inside the annotation helper.

The mechanics, on the skeleton's shapes:

```ts fragment
// The generator's value protocol — EVERY routed snippet carries these
// (empty when the type implies nothing; that mild burden is the point:
// consumers read fields, never narrow).
export type KtValueFields = {
  annotations: KtAnnotation[]
  defaultValue?: Stringable
  // Object values only: the entries array their KtParameterList shares —
  // exposed so a union parent can reach it through the projection
  // (`inserted.definition.value.value.parameters` — the oneOf recipe).
  parameters?: KtDataClassParameter[]
}

// The router's own signature — the DEFAULT form: take the union in,
// return the union out, intersected with the protocol. Every case
// returns one union member, so every branch type-checks with no
// casts and no overloads, and protocol reads are cast-free.
export const toKtValue = (
  args: TypeSystemArgs<SchemaType>
): TypeSystemValue & KtValueFields => { /* switch (schema.type) … */ }
```

The generic tightening (`<S extends SchemaType>` returning
`TypeSystemOutput<S['type']> & KtValueFields`) exists and is almost
never worth it. Under the doctrine, consumers read protocol fields
and never narrow — so per-type return precision is something a
rule-following consumer cannot even use; the one legitimate
cross-snippet read (`parameters`) is an optional protocol field, not
a narrowed contract field. And the generic form has a real
implementation cost: inside the function body `S` is unresolved, so
TypeScript cannot prove a `switch` branch's concrete snippet against
the conditional return type — which pushes the implementation toward
the banned `as` or an overload pair. Reach for the generic form only
when a call site routes a *statically known* schema type and must
read one of its CONTRACT fields without a guard; prefer widening the
protocol with an optional field even then.

```ts fragment
// Router 'string' case — the fork on schema facts CHOOSES a snippet;
// each target renders exactly one Kotlin type and is its own module
// (§6F: named after what it renders). Nothing inside a snippet
// re-asks format.
case 'string': {
  const args = { context, stringSchema: schema, destinationPath, modifiers: { required } }
  if (schema.enums) return new EnumClassValue(args)
  if (schema.format === 'decimal') return new BigDecimalValue(args)
  if (schema.format === 'date-time') return new OffsetDateTimeValue(args)
  return new StringValue(args)
}
```

```ts fragment
// BigDecimalValue.ts — one type; its annotations are unconditional
// (the router fork already decided; no format branch survives here).
export class BigDecimalValue extends KtSnippet {
  type = 'string' as const    // TypeSystem contract fields (§1) — the
  format: string | undefined  // 'string' OUTPUT contract, whatever renders
  // Declared EXACTLY as TypeSystemString declares it — see the
  // Nullable-generic note below; narrowing this to `string[]` is the
  // one-line change that costs a `deno check` round-trip.
  enums: string[] | (string | null)[] | undefined
  modifiers: Modifiers
  annotations: KtAnnotation[] // ← protocol: self-declared policy
  defaultValue?: Stringable

  constructor({ context, stringSchema, destinationPath, modifiers }: Args) {
    super({ context })
    this.format = stringSchema.format
    this.enums = stringSchema.enums
    this.modifiers = modifiers
    this.annotations = [
      new KtAnnotation({
        context,
        destinationPath,
        name: 'JsonSerialize',
        args: ['using = MoneyStringSerializer::class'],
        packageName: 'com.fasterxml.jackson.databind.annotation'
      })
    ]
    // Two more imports the leaf owns: the annotation's ARGS name a
    // second class (§3, one annotation, two imports), and the rendered
    // type itself is not in Kotlin's default imports.
    this.register({
      imports: {
        'com.example.serde': ['MoneyStringSerializer'],
        'java.math': ['BigDecimal']
      },
      destinationPath
    })
  }

  override toString(): string {
    return 'BigDecimal'
  }
}
// StringValue carries the same contract fields, no annotations, and
// renders 'String'; OffsetDateTimeValue self-declares its
// @JsonFormat and java.time import the same way.
```

**The `Nullable`-generic fields keep their full union.** `enums`,
`default`, and `example` are declared on the schema classes as
conditionals over the class's `Nullable` parameter (`Nullable extends
true ? (string | null)[] | undefined : string[] | undefined`). That
parameter defaults to `boolean | undefined`, so the conditional
distributes and never collapses — `.resolve()` does not pin it to
`false`. At every use site the type is the widened union, and it is
also exactly what the TypeSystem contract declares
(`TypeSystemString.enums` IS `string[] | (string | null)[] |
undefined`). So: copy the contract's declaration verbatim into your
snippet field. Simplifying it to the single arm you expect compiles
in your head and fails at `deno check` — which `skmtc bundle` will
not catch (esbuild does not typecheck). Filter at the point of use
instead, as `EnumClassValue` does
(`.flatMap(entry => (entry === null ? [] : [entry]))`), not by
narrowing the field.

The rule is general — the trio above is not the whole list.
**`OasObject.properties` is the same conditional shape**
(`Record<…> | null | undefined` at use sites), so a presence guard
must clear the `null` arm too: `Object.keys(properties)` behind a
bare `!== undefined` check fails `deno check`; guard with
`properties && Object.keys(properties).length` (truthiness clears
both arms). Before assuming any schema field is plain
`T | undefined`, check its appendix declaration for the `Nullable`
conditional.

```ts fragment
// Consumer side — the object snippet's CONSTRUCTOR makes every
// per-parameter decision, fills the entries array, and builds the
// KtParameterList ONCE, sharing the SAME array instance — so
// generate-time removals (the oneOf recipe) are visible at render.
// No `.type` anywhere: not on schemas, not on routed values.
const entries: KtDataClassParameter[] = []
this.parameters = entries // the KtValueFields slot a union parent may edit
for (const [wireName, property] of Object.entries(properties ?? {})) {
  const isRequired = (required ?? []).includes(wireName)
  const value = toKtValue({ context, schema: property, destinationPath, required: isRequired })
  const inherentDefault = value.defaultValue // e.g. 'emptyMap()'
  entries.push({
    wireName, // kept for the union recipe's generate-time removal
    name: sanitizePropertyName(wireName),
    type: value,
    // Non-required is nullable UNLESS the type carries its own zero value.
    nullable: !isRequired && inherentDefault === undefined,
    annotations: [...toPositionAnnotations(wireName), ...value.annotations],
    defaultValue: isRequired ? undefined : (inherentDefault ?? 'null')
  })
}
this.parameterList = new KtParameterList(entries)
```

```ts fragment
// toString() — pure interpolation of settled state. NOTHING is
// constructed here: no snippets, no KtParameterList wrap, no Error
// (refusals throw from the constructor). The structural eval's
// tostring-purity check flags any `new` inside toString.
override toString(): string {
  return `${this.parameterList}`
}
```

One more placement rule the split implies: **facts are declared in
place — no policy module.** The `decimal` branch declares the money
serde annotations where it branches; the `date-time` branch its
`@JsonFormat`; the enum snippet its fallback. A central `policy.ts`
collecting serializer class names, format patterns, and fallback
values re-centralizes what the mapping distributes — a parallel
dispatch table keyed by comments instead of code. A constant used
once belongs at its use site (plain string literals are free
everywhere; hoisting them to another module buys nothing).

Forking *within* a router case on schema facts is the same license
the string case's `format`/`enums` forks use — the case reads a
schema fact and CHOOSES a snippet; it is never a second `.type`
dispatch. The canonical instance: an `additionalProperties`-only
object is a Kotlin `Map`, not a data class, and the split is a
`properties`-presence check — a schema fact, not a type dispatch.
Unlike the string forks (whose targets render different Kotlin types
and are therefore separate snippet modules), the object fork stays
ONE snippet for the whole case, and the stock shape dissolves the
where-do-the-child-snippets-live question: **the TypeSystem contract
fields themselves hold the child snippets** — `objectProperties`
and `recordProperties` are slots the `'object'` output type demands
anyway, each nullable, each holding the snippet that renders that
half. No wrapper, no mirroring: the contract slot IS where the
child snippet lives. (This shape is already worked in full in this
skill — no need to open gen-zod's source to re-derive it.)

```ts fragment
case 'object':
  return new ObjectValue({ context, objectSchema: schema, destinationPath, modifiers })
```

```ts fragment
// The skeleton's DataClassValue, generalized (gen-zod's ZodObject
// shape). Contract fields hold the child snippets; toString branches
// on its OWN nullable fields — own state, never schema.type.
export class ObjectValue extends KtSnippet {
  type = 'object' as const
  // DataClassParameters must ALSO carry a bare `properties:
  // Record<string, TypeSystemValue>` field (fill it in the same
  // per-property loop that builds `parameters`) — the router returns
  // this value as `TypeSystemValue & KtValueFields`, and the contract's
  // `TypeSystemObjectProperties` shape requires it structurally or
  // `deno check` rejects the 'object' case.
  objectProperties: DataClassParameters | null // the parameter-list snippet
  recordProperties: MapValue | null            // the Map<String, V> snippet
  modifiers: Modifiers
  annotations: KtAnnotation[] = []
  defaultValue?: Stringable
  parameters: KtDataClassParameter[] | undefined // KtValueFields slot (same array the parameter-list snippet renders)

  constructor({ context, objectSchema, destinationPath, modifiers }: Args) {
    super({ context })
    this.modifiers = modifiers
    const { properties, required, additionalProperties } = objectSchema
    this.objectProperties = properties && Object.keys(properties).length
      ? new DataClassParameters({ context, properties, required, destinationPath })
      : null
    this.parameters = this.objectProperties?.parameters // reference-share upward for the oneOf recipe
    this.recordProperties = additionalProperties
      ? new MapValue({ context, schema: additionalProperties, destinationPath })
      : null
    if (this.objectProperties && this.recordProperties) {
      // zod composes this case with .and(…); Kotlin has no clean
      // data-class ∩ Map form — refuse loudly AT GENERATE (the
      // constructor), never at render: toString stays a pure read.
      throw new Error('object with both properties and additionalProperties is not mapped')
    }
    if (!this.objectProperties && this.recordProperties) this.defaultValue = 'emptyMap()'
  }

  override toString(): string {
    return `${this.objectProperties ?? this.recordProperties ?? 'Map<String, Any?>'}`
  }
}
```

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
  for any language. Keep the convention — including when replacing a
  hand-written file: Kotlin resolves by **package**, not filename, so
  `Dtos.generated.kt` replaces a hand-written `Dtos.kt` without
  touching the app, and the engine-owned marker survives. An exact
  filename genuinely matters only when something outside Kotlin keys
  on it (a build script, a TS import); only then set
  `client.json#settings.generatedSuffix: ""` rather than fighting the
  suffix in the path policy. Class names come from the refName; the
  engine's cache keys on `(identifier.name, exportPath)`.

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
  eval's method-discipline check counts accessors), a **copy**
  (`this.annotations = [...this.value.annotations]` — a second array,
  two facts that will drift), or **reassigning an aliased name**
  (`this.annotations = []` after the alias — silently splits the two
  names onto different arrays). What IS sanctioned is
  reference-sharing: `this.annotations = this.value.annotations` in
  the constructor points the projection's protocol slot at the routed
  value's own array — one array, two names — and is the canonical
  wiring (§4); after that line, push, never replace.
- **Re-deriving schema facts outside the router** — an annotation or
  default-value helper that takes a schema and asks
  `resolved.type === 'string'` (or narrows a routed value with
  `value.type === 'object'`) after the router already dispatched. The
  mapping extracted that fact once; policy consumes it as a protocol
  field (`annotations` / `defaultValue` — §4) or an `in` fact-read,
  never by a second dispatch. The single-dispatch check flags every
  such site.
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

The full `deno doc` surface for the packages this skill covers lives
in [`appendix.md`](appendix.md), in this skill's directory —
generated from framework source at `71ef53bc`, signatures and
field docs only. It is **authoritative**: when the prose above does
not carry the exact constructor or field shape you need, Read (or
grep) `appendix.md` instead of diving into package source. Do not
guess signatures. For a symbol not listed there,
`deno doc <file> <Symbol>` against the framework source beats
grepping it.

<!-- api-appendix:end -->
