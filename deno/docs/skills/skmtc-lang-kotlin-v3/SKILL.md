---
name: skmtc-lang-kotlin-v3
version: 0.1.0
description: >
  The Kotlin target-language layer for SKMTC generators (@skmtc/lang-kotlin).
  Covers declaring Kotlin as a generator's target (toKtModelProjectionBase /
  toKtOasOperationProjectionBase, KtSnippet), the register call shapes, the
  seven identifier entity kinds, the emitted-Kotlin import model (packages
  from paths, symbol-level sorted imports, same-package suppression, no
  type-only imports, no re-exports), the head+value render model,
  value-composition classes (KtParameterList, KtPrimaryConstructor,
  KtFunctionSignature, KtAnnotation), serialization-annotation placement,
  naming/sanitization (backticks, hard keywords), and a worked example. Use
  ALONGSIDE skmtc-generator-v3 whenever a generator emits Kotlin — that
  skill carries engine rules; this one carries the concrete classes.
  Section headings mirror skmtc-lang-typescript-v3 (the lang-skill template).
---

# The Kotlin layer (@skmtc/lang-kotlin)

Read `skmtc-generator-v3` first — this skill assumes its mental model and
only covers what is Kotlin-specific.

> **Version note (2026-07-31).** The API of record is the workspace
> `skmtc/deno/lang-kotlin` (0.9.14 line) and its tests. The shipped Kotlin
> generators (`gen-kotlin-kotlinx`, `gen-kotlin-spring`, `gen-kotlin-sdk`)
> are **architecturally canonical but API-stale** in places — they predate
> the 0.9.11 flattening. Concretely: they call `new KtAnnotation('Name',
> [args])` positionally, but the current constructor takes object args and
> self-registers its import; they import `isKtAnnotated`/`isKtSupertyped`,
> which are no longer exported (`KtSupertyped` was dissolved — supertype
> clauses are now rendered inline by the value). Copy their *structure*,
> not their lang-API call shapes; this skill shows the current shapes.

## 1. Declaring the language

Exactly as in TypeScript: the declaration is the **import graph**. Your
`src/base.ts` imports a projection-base factory from `@skmtc/lang-kotlin`;
the returned class extends `KtSnippet`; `KtSnippet` carries
`static lang = kotlin`; Drivers read it off the class pre-construction.

```ts
import { toKtModelProjectionBase } from '@skmtc/lang-kotlin'

export const KtModelBase = toKtModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  toIdentifierName({ refName, enrichments }) {
    return enrichments?.subject?.name ?? capitalize(camelCase(refName))
  },
  // Kotlin's identifier kind depends on the SCHEMA SHAPE, so this one may
  // read context (it runs only on the cache-miss path; the name stays pure):
  toIdentifierType(refName, context) {
    return { type: toKtModelShape(context, peekSchema(context, refName)) }
  },
  toExportPath({ refName, enrichments }) {
    const name = enrichments?.subject?.name ?? capitalize(camelCase(refName))
    return join('@', ...enrichments.generator.basePackage.split('.'), `${name}.generated.kt`)
  }
})
```

Two factories: `toKtModelProjectionBase`, `toKtOasOperationProjectionBase`
(no GraphQL/webhook veneers yet). Snippets extend `KtSnippet`.

Note the pattern above: **the export path spells out the package** — its
`@/`-relative directory segments ARE the Kotlin package (§4). A
`basePackage` is typically a **required generator-scope enrichment** with
no default (a silently-wrong `com.example` helps nobody); validate its
segments with `isKtIdentifierName` + `ktHardKeywords`.

## 2. The register call shapes

Same family as TypeScript, same asymmetry:

| Caller | Call | Destination |
|---|---|---|
| Projection | `this.register(args)` | its own export file |
| Projection | `this.registerInto(path, args)` | explicit file |
| Snippet | `this.register({ ...args, destinationPath })` | required — snippets have no file |

Free functions: `register(context, args)` and `defineAndRegister(context,
{ identifier, value, destinationPath, description })`. `defineAndRegister`
does **no cache check** — wrap with `context.findDefinition` where dedup is
wanted (the accumulator get-or-create idiom), and it has **no `noExport`**:
visibility is the identifier's fact — pass `exported: false` to the
identifier factory.

`KtRegisterArgs` differences from TS, both deliberate compile-time facts:

- **No `reExports` field** — Kotlin has no re-exports; registering one is a
  type error, not a runtime no-op.
- **No `type` tag on import names** — Kotlin has no type-only imports.
  `KtImportNameArg = string | { name, alias? }`.

`custom` is the file banner slot, rendered **above** the `package`
directive (only comments may precede `package`); last non-`undefined`
write wins.

## 3. Identifiers: seven entity kinds, seven factories

```ts
type KtEntityType = 'class' | 'data-class' | 'enum-class' | 'interface'
                  | 'sealed-interface' | 'typealias' | 'val'
```

Factories: `createClass`, `createDataClass`, `createEnumClass`,
`createInterface`, `createSealedInterface`, `createTypeAlias`,
`createValue` (only `createValue` takes a `typeName`; all take
`{ exported?: boolean }`, default true — `exported: false` renders
`private `). Deferred kinds (`object`, `fun`, `var`, `const-val`) make
`toKtEntityType` throw — a loud signal, by design, that an identifier built
for another language (or a future milestone) reached the Kotlin renderer.

Unlike TypeScript, the entity kind does **not** drive import form — every
Kotlin import is `import pkg.Name`. What the kind drives is the render
shell (§5).

**Kotlin identifier kinds depend on schema shape**, so stock practice puts
the dispatch in one deterministic function (`toKtModelShape`-style) read by
BOTH `toIdentifierType` and the projection constructor — the kind and the
value can then never disagree, and dispatch stays deterministic per
`(document, schema)`, which the cache-key path needs:

- object with properties → `data-class`; empty/record-only → `typealias`
- string with enums → `enum-class`; plain → `typealias`
- qualifying discriminated union → `sealed-interface`; else `typealias`
- ref and everything else → `typealias`

## 4. The emitted-Kotlin import model

- **Packages come from paths.** `toPackageName(path, packages?)`: strip
  `@/`, strip the longest matching configured `rootPath`, take the dirname,
  join segments with `.`. `@/com/example/api/User.generated.kt` →
  `package com.example.api`. Root-level files get the default package (no
  `package` line). Segments are **validated, never sanitized** — a segment
  that is not a plain identifier or is a hard keyword (`@/com/object/…`)
  **throws**: package layout is generator path policy, fix the policy.
- **One import statement per symbol**, `import pkg.Name` (no brace
  grouping), `as` aliases supported. Imports render **sorted** — not style
  but determinism: byte-identical output regardless of registration order.
- **Same-package suppression is central**: register imports
  unconditionally; `KtFile` drops any import whose resolved package equals
  the file's own package at render time. Peer references within one package
  render bare.
- Two module-key forms, routed by shape: a dotted package
  (`'kotlinx.serialization'`) for libraries, an `@/`-export path for
  project files (what the Driver passes when stitching peer imports).
- **Importing from the default package throws** — a root-level artifact
  referenced from a packaged one is a path-policy bug surfaced loudly.

## 5. The render model: head + value

A Kotlin definition renders as **identifier-head + value**, switched on the
identifier kind:

- Assignment kinds (`typealias`, `val`): `<head> = <value>` — e.g.
  `typealias UserId = String`.
- Declaration kinds (everything else): `<head><value>` — the head is
  `[private ]<keyword> <Name>`, and the value renders **everything after
  it**: the primary-constructor parameter list (parens included), inline
  ` : Parent` supertype clauses, ` { … }` bodies. A value that renders
  nothing yields the bodyless idiom (`sealed interface Animal`).

Two things ride *outside* the head+value line via value-carried protocols,
because the neutral `Lang.toDefinition` signature has no slot for them:

- **`KtAnnotated`** — `{ annotations: KtAnnotation[] }` on the value →
  rendered above the declaration (`@Serializable`).
- **`KtDocumented`** — `{ description?: string }` → the KDoc block.

**The mirroring gotcha (learn this one).** The Driver wraps the
*projection* as the definition's value — so if your projection delegates to
an inner value object, the protocols must be **mirrored on the projection**
(getters forwarding `this.value.annotations` / `.description`), or the
class-level annotations and KDoc silently vanish. The protocol check is
strict: `annotations` must be real `KtAnnotation` instances — a look-alike
array of strings is silently dropped.

File assembly: `custom` banner → `package` directive → sorted imports →
definitions (joined by blank lines, first write wins per identifier name —
Kotlin has no declaration merging).

## 6. Value composition classes

- **`KtParameterList(parameters)`** — the primary-constructor list,
  **parentheses included**. Each item:
  `{ name, type: Stringable, nullable?, defaultValue?, annotations?,
  visibility? }` → renders `    [@Anno\n    ][private ]val name: Type[?][ = default]`,
  annotations one per line, no trailing comma.
- **`KtPrimaryConstructor({ parameters, modifiers? })`** — exists for one
  grammar rule: modifiers force the explicit `constructor` keyword
  (`class C private constructor(...)`). Compose:
  `` `${new KtPrimaryConstructor({ parameters: new KtParameterList([...]) })} {\n …body… \n}` ``.
- **`KtFunctionSignature({ name, parameters, returnType?, annotations?,
  description?, body? })`** — method grammar for interface/class bodies;
  abstract by default, expression body only (block bodies deliberately
  unsupported). `KtFunctionParameter` is a *different* production from a
  constructor parameter — no `val`, annotations inline.
- **`KtAnnotation({ context, name, args?, packageName?, destinationPath })`**
  — a **registering leaf**: given `packageName` it registers
  `import <packageName>.<name>` itself, so the annotation and its import
  are one statement that cannot drift apart (register unconditionally —
  same-package suppression handles the rest). `args` are pre-quoted
  Stringables: `args: ['"user_id"']`, `args: ['Foo::class']`. It is
  deliberately NOT a `KtSnippet` subclass (module-cycle avoidance), so it
  needs `context` passed in. `KtAnnotations` renders a list one-per-line
  and `''` when empty, so it interpolates unconditionally.
- **`withDescription(value, { description })`** — KDoc: inline `/** … */`
  for one line, margined block for multi-line.

## 7. Naming and sanitization of emitted identifiers

- **`sanitizePropertyName(name)`** — three outcomes: plain identifier and
  not a hard keyword → unchanged; hard keyword or syntactically invalid →
  **backticked** (`` `object` ``, `` `user name` ``, `` `1st` ``);
  JVM-unescapable characters (`. ; : / \ [ ] < >` …) → **throws** with
  "rename it (camelCase + @SerialName) before registering". Returns a plain
  string — Kotlin has no quoted-property fallback.
- **Renames are not sanitization's job.** Wire-name mismatches are handled
  by serialization annotations. The two compose: a backticked keyword still
  *equals* its wire name, so `` `object` `` needs **no** `@SerialName`;
  a camelCased `user_id` → `userId` **does**. Decide the annotation by
  comparing the *unescaped* chosen name with the wire key.
- Hard keywords are the 28 Kotlin hard keywords only — soft keywords
  (`value`, `data`, `field`, `import`) and modifier keywords (`sealed`,
  `internal`) are legal identifiers and are not escaped.
- Casing lives generator-side with core's helpers: classes
  `capitalize(camelCase(refName))`; properties
  `sanitizePropertyName(camelCase(key))` (the canonical pairing); enum
  entries CONSTANT_CASE with deterministic disambiguation on collisions.
  Nested synthesized names chain the parent: `User` → `UserAddress` →
  `UserAddressItem`.

## 8. Worked example — a kotlinx-serialization data class

The projection dispatches on the shared shape function and stores one value
object (structure from `gen-kotlin-kotlinx`, call shapes current):

```ts
export class KtModelProjection extends KtModelBase {
  value: ModelValue

  constructor({ context, refName, settings, rootRef }: ModelProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, refName, settings })
    const schema = context.resolveSchemaRefOnce(refName, KtModelBase.id)
    const shape = toKtModelShape(context, schema)

    if (shape === 'data-class' && !schema.isRef() && schema.type === 'object') {
      this.value = new KtDataClassValue({
        context, objectSchema: schema,
        destinationPath: settings.exportPath,
        className: settings.identifier.name, rootRef
      })
    } else if (shape === 'enum-class' && ...) {
      this.value = new KtEnumEntries({ ... })
    } else {
      this.value = toKtValue({ schema, destinationPath: settings.exportPath,
        required: true, context, rootRef, fallbackName: settings.identifier.name })
    }
  }

  // MIRROR the value-carried protocols — the Driver wraps THIS object:
  get annotations(): KtAnnotation[] { return this.value.annotations ?? [] }
  get description(): string | undefined { return this.value.description }

  static schemaToValueFn: SchemaToValueFn = args => toKtValue({ ...args,
    fallbackName: args.rootRef ? capitalize(camelCase(args.rootRef)) : 'Inline' })
  static createIdentifier = createTypeAlias

  override toString() { return `${this.value}` }
}
```

Inside the data-class value, the per-property loop — objects stored, syntax
deferred, annotations decided by wire-name comparison:

```ts
const propertyName = sanitizePropertyName(camelCase(key))
const annotations: KtAnnotation[] = []
if (propertyName.replaceAll('`', '') !== key) {
  annotations.push(new KtAnnotation({
    context, destinationPath,
    name: 'SerialName', packageName: 'kotlinx.serialization', args: [`"${key}"`]
  }))
}
parameters.push({
  name: propertyName,
  type: value,                       // ← the SNIPPET, never `${value}`
  nullable: false,                   // the type expression owns the single `?`
  defaultValue: isRequired ? undefined : 'null',
  annotations
})
// later: this.parameterList = new KtParameterList(parameters)
```

Rendered result:

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

### Wrong vs right, with the failure it causes

```ts
// WRONG: pre-rendered text as the parameter type
parameters.push({ name, type: `${toKtValue({ schema, ... })}` })

// RIGHT: the snippet object
parameters.push({ name, type: toKtValue({ schema, ... }) })
```

Both typecheck (`type: Stringable`). The wrong one strands the snippet's
constructor side effects: the `import kotlinx.serialization.json.JsonElement`
it would have registered, the sibling data class it would have synthesized
for a nested object, and its provenance trail. The file compiles later or
never, far from the cause.

**Modifiers**: optional and nullable collapse into one `?` on the type
expression, and the type expression is its **single owner** —
`KtParameterList` never adds one on top (no `String??`). Optionality's
default value (`= null`) is the parameter layer's only rule.

**Serialization flavor is confined**: in gen-kotlin-kotlinx the entire
kotlinx-specific surface lives in three value files (data class, enum
entries, sealed interface). A Jackson/Moshi sibling generator replaces the
annotation construction in those files only — the lang package is
grammar-only (`grep kotlinx src/` in lang-kotlin returns nothing). This is
the customization seam for "same shapes, different serializer".

**Operation-side shapes** (both real): the *accumulator* (gen-kotlin-spring
— per tag, one file with a `<Tag>Service` interface and a `@RestController`
class; each operation appends a `KtFunctionSignature` into both via
`findDefinition ?? defineAndRegister`), and the *projection*
(gen-kotlin-sdk — `toKtOasOperationProjectionBase`, one class per
operation). An operation generator never names model classes — it calls the
model generator's exported router (`toKtValue` from
`@skmtc/gen-kotlin-kotlinx`, an ordinary exact-pinned dependency) and lets
the Driver register definitions and stitch imports.

## 9. Where plain strings are legitimate

- Kotlin syntax with **no grammar rule worth a class**: supertype clauses
  and braced bodies composed inside `toString()`
  (`` `${primaryConstructor} {\n${body}\n}` ``), expression bodies
  (`'service.getUsersId(id)'`).
- Terminal type expressions after `applyModifiers`: `'Int'`, `'Long'`,
  `` `List<${this.items}>` `` — leaves with nothing left to register.
- Pre-quoted annotation args (`'"user_id"'`, `'Foo::class'`) and import
  module keys (`'kotlinx.serialization'`).
- A cached peer *name* (from `settings.identifier.name` on a ref hit).

Mandatory objects: everything stored and rendered later — parameter
`type`s, annotation instances (`KtAnnotation`, not `'@Serializable'`),
identifiers (`KtIdentifier` via factories — a foreign identifier throws at
the Lang boundary), and anything that must register an import or be found
in the cache.

## 10. Kotlin-specific pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Class-level `@Serializable` / KDoc missing from output | Protocols not mirrored on the projection wrapper | Add `annotations` / `description` getters forwarding to `this.value` |
| Annotation silently dropped | Strings in the `annotations` array (protocol requires `KtAnnotation` instances) | Construct real `KtAnnotation`s |
| `segment 'x' is not a valid package name part` | Export path contains a non-identifier or keyword directory | Fix the path policy — packages are validated, never sanitized |
| Import appears in file body / duplicated | Import written in a template | `register` / annotation `packageName` (lint: `no-template-imports`) |
| `Kotlin cannot import from the default package` | Root-level artifact referenced from a packaged file | Give the artifact a packaged export path |
| `String??` or missing `?` | Two layers applying nullability | The type expression owns the single `?`; parameter layer only adds `= null` |
| `Unknown Kotlin entity type` throw | Identifier built with a TS kind, or a deferred kind (`object`, `fun`) | Use the seven Kotlin factories |
| `data class` with zero parameters throws | Empty object routed to data-class | Shape dispatch must send empty objects to `typealias` (`JsonObject`) |
| TDZ crash at module load (`… in the temporal dead zone`) | Module-init cycle: base ↔ router ↔ projection imports | Break the cycle with a leaf module (the `peekSchema` pattern); keep `KtAnnotation`-style leaves off `KtSnippet` |
| Generator behaves differently across runs | Module-level state or non-memoized document scans | Config via enrichments only; memoize scans in `WeakMap`s keyed on the document |
