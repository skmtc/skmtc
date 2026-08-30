# Appendix — generated API reference

> Generated from framework source by
> `deno run --allow-read --allow-write --allow-run=deno,git .scripts/generate-skill-api-appendix.ts`
> (from `deno/`). **Authoritative** for signatures, fields, and doc
> comments — trust it instead of re-reading package source. JSDoc
> `@example` blocks are stripped at generation. For a symbol not
> listed here, `deno doc <file> <Symbol>` against the framework
> source beats grepping it.

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

Defined in deno/lang-kotlin/src/createIdentifier.ts:97:14

function createDataClass(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates a `data class` identifier.

Defined in deno/lang-kotlin/src/createIdentifier.ts:110:14

function createEnumClass(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates an `enum class` identifier.

Defined in deno/lang-kotlin/src/createIdentifier.ts:123:14

function createInterface(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates an `interface` identifier.

Defined in deno/lang-kotlin/src/createIdentifier.ts:136:14

function createSealedInterface(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates a `sealed interface` identifier.

Defined in deno/lang-kotlin/src/createIdentifier.ts:152:14

function createTypeAlias(name: string, args: CreateKtIdentifierArgs): KtIdentifier
  Creates a `typealias` identifier.

Defined in deno/lang-kotlin/src/createIdentifier.ts:172:14

function createValue(name: string, args: CreateValueArgs): KtIdentifier
  Creates a top-level `val` identifier — Kotlin's distinctive file-scope
  value.

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

Defined in deno/lang-kotlin/src/KtAnnotation.ts:149:14

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

Defined in deno/lang-kotlin/src/KtAnnotation.ts:72:1

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

  constructor({context, name, args, target, packageName, destinationPath}: KtAnnotationArgs)
  name: string
  args: Stringable[]
  target: KtAnnotationTarget | undefined
  toString(): string

Defined in deno/lang-kotlin/src/KtAnnotation.ts:132:1

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

Defined in deno/lang-kotlin/src/KtAnnotation.ts:107:1

type KtAnnotated = { annotations: KtAnnotation[]; }
  The protocol by which a Definition's VALUE supplies class-level
  annotations to {@link import('./KtDefinition.ts').KtDefinition}.

  `Lang.toDefinition`'s neutral signature has no annotations slot, so
  annotations ride on the value: a generator's projection sets an
  `annotations` field, and `KtDefinition.toString()` collects it via
  {@link toKtAnnotations} and renders the annotations above the
  declaration head.

Defined in deno/lang-kotlin/src/KtAnnotation.ts:23:1

type KtAnnotationArgs = { context: GenerateContextType; name: string; args?: Stringable[]; target?: KtAnnotationTarget; packageName?: string; destinationPath: string; }
  Constructor arguments for {@link KtAnnotation}.

Defined in deno/lang-kotlin/src/KtAnnotation.ts:8:1

type KtAnnotationTarget = "field" | "get" | "set" | "param" | "property" | "receiver" | "setparam" | "delegate" | "file" | "all"
  Kotlin's annotation use-site targets — the `field:` in
  `@field:JsonAnySetter`. Grammar-level, so the set is closed and owned
  here; WHICH target a generator picks is its policy.

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
